"use server";

import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { insCompanies, insCovers, insProducts, insVendors, type InsCoverStatus, type InsProductStatus } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { INS_COVER_STATUS_LABEL, INS_PRODUCT_STATUS_LABEL, INS_VENDOR_STATUS_LABEL } from "@/insurance/labels";
import { audit } from "@/server/audit";
import { requireStaff } from "@/server/auth";
import { insurerPlanFor, publishedProductCount } from "@/server/insurance/catalog-limits";
import { notifyInsurer, recordInsApproval } from "@/server/insurance/records";
import { invalid } from "@/server/validation";
import { insVendorName } from "@/components/admin/insurance/ui";

/* ──────────────────────────────────────────────────────────────
   Staff decisions on insurance products and on the coverage items
   and add-on covers they use. A product can't be approved while a
   cover it uses isn't approved (staff can approve the pending ones
   together). Every decision is written to the approval history,
   notifies the vendor and is recorded in the admin activity log.
   ────────────────────────────────────────────────────────────── */

const RACE = "Someone else just updated this. Refresh to see the latest and try again.";
const id = z.coerce.number().int().positive();
const optionalRemarks = z
  .string()
  .trim()
  .max(2000, "Keep this under 2000 characters")
  .optional()
  .transform((v) => v || null);
const requiredRemarks = (message: string) => z.string({ error: message }).trim().min(5, message).max(2000, "Keep this under 2000 characters");
const touch = () => {
  revalidatePath("/admin", "layout");
  revalidatePath("/insurance", "layout");
};
const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

/* ── Products ───────────────────────────────────────────────── */

const productDecision = z.discriminatedUnion("op", [
  z.object({ op: z.literal("approve"), approveCovers: z.boolean().default(false), remarks: optionalRemarks }),
  z.object({ op: z.literal("approve_publish"), approveCovers: z.boolean().default(false), remarks: optionalRemarks }),
  z.object({ op: z.literal("publish"), remarks: optionalRemarks }),
  z.object({ op: z.literal("unpublish"), remarks: optionalRemarks }),
  z.object({
    op: z.literal("request_changes"),
    corrections: z.array(z.string().trim().min(3, "Describe the change").max(300, "Keep each item under 300 characters")).min(1, "Add at least one change").max(20, "Add at most 20 changes"),
    remarks: optionalRemarks,
  }),
  z.object({ op: z.literal("reject"), remarks: requiredRemarks("Tell the vendor why the product was rejected (at least 5 characters)") }),
  z.object({ op: z.literal("suspend"), remarks: requiredRemarks("Tell the vendor why the product was suspended (at least 5 characters)") }),
  z.object({ op: z.literal("reinstate"), approveCovers: z.boolean().default(false), remarks: optionalRemarks }),
]);
type ProductOp = z.infer<typeof productDecision>["op"];

const PRODUCT_FROM: Record<ProductOp, InsProductStatus[]> = {
  approve: ["submitted", "pending_approval", "changes_requested", "rejected"],
  approve_publish: ["submitted", "pending_approval", "changes_requested", "rejected", "approved"],
  publish: ["approved"],
  unpublish: ["published"],
  request_changes: ["submitted", "pending_approval", "approved", "published"],
  reject: ["submitted", "pending_approval", "changes_requested", "approved", "published"],
  suspend: ["submitted", "pending_approval", "changes_requested", "approved", "published"],
  reinstate: ["suspended"],
};
const PRODUCT_TO: Record<ProductOp, InsProductStatus> = {
  approve: "approved",
  approve_publish: "published",
  publish: "published",
  unpublish: "approved",
  request_changes: "changes_requested",
  reject: "rejected",
  suspend: "suspended",
  reinstate: "approved",
};
const PRODUCT_ACTION: Record<ProductOp, string> = {
  approve: "approved",
  approve_publish: "approved_published",
  publish: "published",
  unpublish: "unpublished",
  request_changes: "changes_requested",
  reject: "rejected",
  suspend: "suspended",
  reinstate: "reinstated",
};

export async function productDecisionAction(productId: unknown, input: unknown): Promise<ActionResult<{ status: InsProductStatus; coversApproved: number }>> {
  const me = await requireStaff();
  const parsed = productDecision.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const pid = id.safeParse(productId);
  if (!pid.success) return { ok: false, error: "Product not found" };
  const db = getDb();
  const [row] = await db
    .select({ p: insProducts, vendorStatus: insVendors.status, vendorPlan: insVendors.plan, reference: insVendors.reference, brandName: insVendors.brandName, legalName: insVendors.legalName, companyActive: insCompanies.isActive, companyName: insCompanies.name })
    .from(insProducts)
    .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
    .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
    .where(eq(insProducts.id, pid.data));
  if (!row) return { ok: false, error: "This product no longer exists." };
  const p = row.p;
  const d = parsed.data;
  if (!PRODUCT_FROM[d.op].includes(p.status)) return { ok: false, error: `This product is ${INS_PRODUCT_STATUS_LABEL[p.status].toLowerCase()}, so that action isn't available. Refresh to see the latest.` };
  const to = PRODUCT_TO[d.op];
  // Only an approved vendor's products can be approved or go live (a suspended or rejected vendor's stay as they are).
  if ((to === "approved" || to === "published") && d.op !== "unpublish" && row.vendorStatus !== "approved")
    return { ok: false, error: `The vendor is ${INS_VENDOR_STATUS_LABEL[row.vendorStatus].toLowerCase()}, so its products can't be approved or published. Review the vendor's account first.` };

  // Covers it uses must be the vendor's own and approved before it can be approved or go live.
  const needsCovers = to === "approved" || to === "published";
  let toApprove: { id: number; name: string; type: string; status: InsCoverStatus }[] = [];
  if (needsCovers && d.op !== "unpublish") {
    const coverIds = [...new Set([...(p.coverage?.coverIds ?? []), ...(p.addOns ?? []).map((a) => a.coverId)])];
    const covers = coverIds.length ? await db.select({ id: insCovers.id, vendorId: insCovers.vendorId, name: insCovers.name, type: insCovers.type, status: insCovers.status }).from(insCovers).where(inArray(insCovers.id, coverIds)) : [];
    const own = covers.filter((c) => c.vendorId === p.vendorId);
    if (own.length < coverIds.length) return { ok: false, error: "This product uses a cover that no longer exists. Request changes so the vendor can fix it." };
    const notApproved = own.filter((c) => c.status !== "approved");
    const pending = notApproved.filter((c) => c.status === "pending_approval");
    const blocked = notApproved.filter((c) => c.status !== "pending_approval");
    if (blocked.length) return { ok: false, error: `Its ${blocked.map((c) => `“${c.name}” (${INS_COVER_STATUS_LABEL[c.status].toLowerCase()})`).join(", ")} ${blocked.length === 1 ? "isn't" : "aren't"} approved. Request changes, or approve ${blocked.length === 1 ? "it" : "them"} on the Coverage / Add-ons pages first.` };
    if (pending.length) {
      if (!("approveCovers" in d) || !d.approveCovers)
        return { ok: false, error: `${pending.length} cover${pending.length === 1 ? "" : "s"} this product uses ${pending.length === 1 ? "is" : "are"} still pending approval: ${pending.map((c) => c.name).join(", ")}. Tick “Approve its pending covers too” or review them first.`, fieldErrors: { approveCovers: "Approve the pending covers too, or review them first" } };
      toApprove = pending;
    }
  }

  if (to === "published") {
    if (!row.companyActive) return { ok: false, error: `${row.companyName} is inactive, so its products can't go live. Reactivate the company first.` };
    // The same plan rule (and unknown-plan fallback) as the vendor's own "Publish".
    const [plan, live] = await Promise.all([insurerPlanFor(row.vendorPlan), publishedProductCount(p.vendorId, p.id)]);
    if (plan.products !== null && live >= plan.products)
      return { ok: false, error: `The vendor's ${plan.name} plan allows ${plan.products} published product${plan.products === 1 ? "" : "s"} and ${live} ${live === 1 ? "is" : "are"} live. Approve without publishing, or ask the vendor to unpublish one or upgrade.` };
  }

  const now = new Date();
  let remarks = d.remarks ?? null;
  const set: Partial<typeof insProducts.$inferInsert> = { status: to, decidedBy: me.id, adminRemarks: remarks };
  if (d.op === "request_changes") {
    set.requiredCorrections = d.corrections;
    set.adminRemarks = remarks ?? `Please make ${d.corrections.length === 1 ? "this change" : `these ${d.corrections.length} changes`} and resubmit the product.`;
    remarks = [remarks, ...d.corrections.map((c) => `• ${c}`)].filter(Boolean).join("\n");
  } else if (to === "approved" || to === "published") set.requiredCorrections = null;
  if (d.op === "approve" || d.op === "approve_publish" || (d.op === "reinstate" && !p.approvedAt)) set.approvedAt = now;
  if (to === "published") set.publishedAt = now;

  const [res] = await db.update(insProducts).set(set).where(and(eq(insProducts.id, p.id), eq(insProducts.status, p.status)));
  if (!res.affectedRows) return { ok: false, error: RACE };

  for (const c of toApprove) {
    const [claim] = await db.update(insCovers).set({ status: "approved", decidedBy: me.id, adminRemarks: null }).where(and(eq(insCovers.id, c.id), eq(insCovers.status, "pending_approval")));
    if (claim.affectedRows) await recordInsApproval({ vendorId: p.vendorId, target: "cover", targetId: c.id, action: "approved", fromStatus: "pending_approval", toStatus: "approved", remarks: `Approved with ${p.reference} · ${p.name}`, actorUserId: me.id, actorSide: "admin" });
  }
  await recordInsApproval({ vendorId: p.vendorId, target: "product", targetId: p.id, action: PRODUCT_ACTION[d.op], fromStatus: p.status, toStatus: to, remarks, actorUserId: me.id, actorSide: "admin" });

  const titles: Record<ProductOp, string> = {
    approve: `${p.name} approved`,
    approve_publish: `${p.name} is live on MarchGear`,
    publish: `${p.name} is live on MarchGear`,
    unpublish: `${p.name} was unpublished`,
    request_changes: `Changes needed on ${p.name}`,
    reject: `${p.name} was not approved`,
    suspend: `${p.name} was suspended`,
    reinstate: `${p.name} was reinstated`,
  };
  const bodies: Record<ProductOp, string> = {
    approve: "It's approved but not live yet — publish it from your products when you're ready.",
    approve_publish: "Customers can now find it and request quotes.",
    publish: "Customers can now find it and request quotes.",
    unpublish: "It's no longer shown on MarchGear. You can publish it again from your products.",
    request_changes: `${d.op === "request_changes" ? d.corrections.join("; ") : ""}`,
    reject: "",
    suspend: "It's hidden from MarchGear and locked for editing until MarchGear reinstates it.",
    reinstate: "It's approved again but not live — publish it when you're ready.",
  };
  const covers = toApprove.length ? ` ${toApprove.length} cover${toApprove.length === 1 ? "" : "s"} approved with it.` : "";
  await notifyInsurer(p.vendorId, { kind: "product", title: titles[d.op], body: `${d.remarks ? `${sentence(d.remarks)} ` : ""}${bodies[d.op]}${covers}`.trim() || `${p.reference} is now ${INS_PRODUCT_STATUS_LABEL[to].toLowerCase()}.`, href: "/insurance-vendor/products" });
  await audit(me.id, "status", "ins_product", p.id, `${INS_PRODUCT_STATUS_LABEL[p.status]} → ${INS_PRODUCT_STATUS_LABEL[to]}: ${p.reference} ${p.name} (${insVendorName(row)})${covers}`);
  touch();
  return { ok: true, status: to, coversApproved: toApprove.length };
}

/* ── Coverage items and add-ons ─────────────────────────────── */

const coverDecision = z.discriminatedUnion("op", [
  z.object({ op: z.literal("approve"), remarks: optionalRemarks }),
  z.object({ op: z.literal("request_changes"), remarks: requiredRemarks("Tell the vendor what to change (at least 5 characters)") }),
  z.object({ op: z.literal("reject"), remarks: requiredRemarks("Tell the vendor why the cover was rejected (at least 5 characters)") }),
]);
type CoverOp = z.infer<typeof coverDecision>["op"];
const COVER_FROM: Record<CoverOp, InsCoverStatus[]> = {
  approve: ["pending_approval", "changes_requested", "rejected"],
  request_changes: ["pending_approval", "approved"],
  reject: ["pending_approval", "changes_requested", "approved"],
};
const COVER_TO: Record<CoverOp, InsCoverStatus> = { approve: "approved", request_changes: "changes_requested", reject: "rejected" };
const COVER_ACTION: Record<CoverOp, string> = { approve: "approved", request_changes: "changes_requested", reject: "rejected" };
const coverHref = (type: string) => (type === "addon" ? "/insurance-vendor/add-ons" : "/insurance-vendor/coverage");
const coverNoun = (type: string) => (type === "addon" ? "Add-on" : "Coverage item");

export async function coverDecisionAction(coverId: unknown, input: unknown): Promise<ActionResult<{ status: InsCoverStatus }>> {
  const me = await requireStaff();
  const parsed = coverDecision.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const cid = id.safeParse(coverId);
  if (!cid.success) return { ok: false, error: "Cover not found" };
  const db = getDb();
  const [row] = await db
    .select({ c: insCovers, reference: insVendors.reference, brandName: insVendors.brandName, legalName: insVendors.legalName })
    .from(insCovers)
    .innerJoin(insVendors, eq(insVendors.id, insCovers.vendorId))
    .where(eq(insCovers.id, cid.data));
  if (!row) return { ok: false, error: "This cover no longer exists." };
  const c = row.c;
  const { op, remarks } = parsed.data;
  if (!COVER_FROM[op].includes(c.status)) return { ok: false, error: `This cover is ${INS_COVER_STATUS_LABEL[c.status].toLowerCase()}, so that action isn't available. Refresh to see the latest.` };
  const to = COVER_TO[op];
  const [res] = await db.update(insCovers).set({ status: to, decidedBy: me.id, adminRemarks: remarks }).where(and(eq(insCovers.id, c.id), eq(insCovers.status, c.status)));
  if (!res.affectedRows) return { ok: false, error: RACE };
  await recordInsApproval({ vendorId: c.vendorId, target: "cover", targetId: c.id, action: COVER_ACTION[op], fromStatus: c.status, toStatus: to, remarks, actorUserId: me.id, actorSide: "admin" });
  const titles: Record<CoverOp, string> = {
    approve: `${coverNoun(c.type)} approved: ${c.name}`,
    request_changes: `Changes needed on ${c.name}`,
    reject: `${coverNoun(c.type)} not approved: ${c.name}`,
  };
  await notifyInsurer(c.vendorId, {
    kind: "cover",
    title: titles[op],
    body: remarks ?? (op === "approve" ? "It can now appear on your published products and in estimates." : undefined),
    href: coverHref(c.type),
  });
  await audit(me.id, "status", "ins_cover", c.id, `${INS_COVER_STATUS_LABEL[c.status]} → ${INS_COVER_STATUS_LABEL[to]}: ${coverNoun(c.type).toLowerCase()} ${c.name} (${insVendorName(row)})`);
  touch();
  return { ok: true, status: to };
}

const bulkCovers = z.object({
  ids: z.array(id).min(1, "Choose at least one cover").max(100, "Approve at most 100 covers at a time"),
  remarks: optionalRemarks,
});

/** Approves every selected cover that's still waiting (pending approval). Others are skipped. */
export async function bulkApproveCoversAction(input: unknown): Promise<ActionResult<{ approved: number; skipped: number }>> {
  const me = await requireStaff();
  const parsed = bulkCovers.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const ids = [...new Set(parsed.data.ids)];
  const rows = await db.select({ id: insCovers.id, vendorId: insCovers.vendorId, name: insCovers.name, type: insCovers.type, status: insCovers.status }).from(insCovers).where(inArray(insCovers.id, ids));
  const remarks = parsed.data.remarks;
  const approved: typeof rows = [];
  for (const c of rows.filter((r) => r.status === "pending_approval")) {
    const [res] = await db.update(insCovers).set({ status: "approved", decidedBy: me.id, adminRemarks: remarks }).where(and(eq(insCovers.id, c.id), eq(insCovers.status, "pending_approval")));
    if (!res.affectedRows) continue;
    approved.push(c);
    await recordInsApproval({ vendorId: c.vendorId, target: "cover", targetId: c.id, action: "approved", fromStatus: "pending_approval", toStatus: "approved", remarks, actorUserId: me.id, actorSide: "admin" });
  }
  // One notification per vendor.
  const byVendor = new Map<number, typeof rows>();
  for (const c of approved) byVendor.set(c.vendorId, [...(byVendor.get(c.vendorId) ?? []), c]);
  for (const [vendorId, list] of byVendor)
    await notifyInsurer(vendorId, {
      kind: "cover",
      title: list.length === 1 ? `${coverNoun(list[0].type)} approved: ${list[0].name}` : `${list.length} covers approved`,
      body: `${remarks ? `${sentence(remarks)} ` : ""}${list.map((c) => c.name).join(", ")} can now appear on your published products.`,
      href: coverHref(list[0].type),
    });
  if (approved.length) await audit(me.id, "status", "ins_cover", approved.map((c) => c.id).join(","), `Bulk-approved ${approved.length} cover${approved.length === 1 ? "" : "s"}: ${approved.map((c) => c.name).join(", ")}`);
  touch();
  return { ok: true, approved: approved.length, skipped: ids.length - approved.length };
}
