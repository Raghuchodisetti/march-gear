"use server";

import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  brands,
  partnerBrands,
  partnerChangeRequests,
  partnerFiles,
  partnerOffers,
  partnerVehicles,
  partners,
  type OfferStatus,
  type PartnerStatus,
  type PartnerVehicleStatus,
} from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { PATTERNS } from "@/partner/application";
import { BRAND_STATUS_LABEL, DOC_KIND_LABEL, OFFER_STATUS_LABEL, PARTNER_STATUS_LABEL, VEHICLE_STATUS_LABEL, offerDisplayStatus } from "@/partner/labels";
import type { PartnerApplication } from "@/partner/types";
import { audit } from "@/server/audit";
import { requireStaff } from "@/server/auth";
import { expireCatalog, getCatalog } from "@/server/catalog";
import { decryptField, encryptField } from "@/server/partner/crypto";
import { syncPartnerEverywhere, syncPublicDealer, syncPublicVehicle } from "@/server/partner/public-sync";
import { catalogueOf } from "@/server/partner/inventory";
import { notifyPartner, recordApproval } from "@/server/partner/records";
import { invalid, isoDate, todayISO } from "@/server/validation";
import { KYC_DOC_KINDS, fieldLabel, isBankPath, partnerName, splitCorrection } from "@/components/admin/partner-ui";

/* ──────────────────────────────────────────────────────────────
   Staff decisions on the dealer partner workflows: the dealer
   account, its documents, brands and change requests, vehicle
   listings and offers. Every decision is written to the approval
   history (shown to the dealer), notifies the dealership and is
   recorded in the admin activity log.
   ────────────────────────────────────────────────────────────── */

const OFFLINE_RACE = "Someone else just updated this. Refresh to see the latest and try again.";
const id = z.coerce.number().int().positive();
const optionalRemarks = z
  .string()
  .trim()
  .max(2000, "Keep this under 2000 characters")
  .optional()
  .transform((v) => v || null);
const requiredRemarks = (message: string) => z.string({ error: message }).trim().min(5, message).max(2000, "Keep this under 2000 characters");

const touchAdmin = () => revalidatePath("/admin", "layout");
/** "address proof", "PAN card" — a document's name mid-sentence. */
const docName = (k: keyof typeof DOC_KIND_LABEL) => DOC_KIND_LABEL[k].replace(/^([A-Z])(?![A-Z])/, (c) => c.toLowerCase());
type Partner = typeof partners.$inferSelect;
const nameOf = (p: Pick<Partner, "tradeName" | "legalName" | "reference">) => partnerName(p);

/** "1 Dec 2026" in IST. */
const day = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
const plusDaysISO = (n: number) => new Date(Date.parse(`${todayISO()}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** A real calendar day ("2026-02-31" and "2026-13-01" are refused, not rolled over). */
const isRealDay = (v: string) => {
  const t = new Date(`${v.slice(0, 10)}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === v.slice(0, 10);
};
const calendarDay = isoDate.refine(isRealDay, "Choose a valid date");
/** A datetime-local value typed in IST ("2026-12-01T09:00") → Date. */
const istDateTime = z
  .string({ error: "Choose a date and time" })
  .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, "Choose a date and time")
  .refine(isRealDay, "Choose a valid date and time")
  .transform((v) => new Date(`${v}:00+05:30`));

/* ── Dealer account ─────────────────────────────────────────── */

const partnerDecision = z.discriminatedUnion("op", [
  z.object({ op: z.literal("under_review"), remarks: optionalRemarks }),
  z.object({
    op: z.literal("request_changes"),
    corrections: z.array(z.string().trim().min(3, "Describe the correction").max(300, "Keep each correction under 300 characters")).min(1, "Add at least one correction").max(20, "Add at most 20 corrections"),
    remarks: optionalRemarks,
  }),
  z.object({ op: z.literal("request_documents"), documents: z.array(z.enum(KYC_DOC_KINDS)).min(1, "Choose at least one document"), remarks: optionalRemarks }),
  z.object({ op: z.literal("approve"), approveBrands: z.boolean().default(false), remarks: optionalRemarks }),
  z.object({ op: z.literal("reject"), remarks: requiredRemarks("Tell the dealer why the application was rejected") }),
]);
type PartnerOp = z.infer<typeof partnerDecision>["op"];

const DECIDE_FROM: Record<PartnerOp, PartnerStatus[]> = {
  under_review: ["submitted", "pending_approval"],
  request_changes: ["submitted", "pending_approval", "under_review", "documents_required"],
  request_documents: ["submitted", "pending_approval", "under_review", "changes_requested"],
  approve: ["submitted", "pending_approval", "under_review", "documents_required", "changes_requested"],
  reject: ["submitted", "pending_approval", "under_review", "documents_required", "changes_requested"],
};
const DECIDE_TO: Record<PartnerOp, PartnerStatus> = {
  under_review: "under_review",
  request_changes: "changes_requested",
  request_documents: "documents_required",
  approve: "approved",
  reject: "rejected",
};
const DECIDE_ACTION: Record<PartnerOp, string> = {
  under_review: "under_review",
  request_changes: "changes_requested",
  request_documents: "documents_required",
  approve: "approved",
  reject: "rejected",
};

async function loadPartner(partnerId: unknown) {
  const pid = id.safeParse(partnerId);
  if (!pid.success) return null;
  const [p] = await getDb().select().from(partners).where(eq(partners.id, pid.data));
  return p ?? null;
}

/** Moves a dealer application through review: under review, corrections, documents, approve, reject. */
export async function partnerDecisionAction(partnerId: unknown, input: unknown): Promise<ActionResult<{ status: PartnerStatus; publicDealerId: string | null }>> {
  const me = await requireStaff("dealers");
  const parsed = partnerDecision.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const p = await loadPartner(partnerId);
  if (!p) return { ok: false, error: "This dealer no longer exists." };
  const d = parsed.data;
  if (!DECIDE_FROM[d.op].includes(p.status)) return { ok: false, error: `This application is ${PARTNER_STATUS_LABEL[p.status].toLowerCase()}, so that decision isn't available. Refresh to see the latest.` };

  const db = getDb();
  const to = DECIDE_TO[d.op];
  const name = nameOf(p);
  const now = new Date();
  let remarks = d.remarks ?? null;
  let corrections: string[] | null = null;
  const set: Partial<typeof partners.$inferInsert> = { status: to };
  let note: { title: string; body: string; href: string };

  switch (d.op) {
    case "under_review":
      set.requiredCorrections = null;
      set.adminRemarks = remarks;
      note = { title: "Your application is under review", body: remarks ?? "A MarchGear partner manager is reviewing your application and documents. We'll let you know as soon as there's a decision.", href: "/dealer/application-status" };
      break;
    case "request_changes":
      corrections = d.corrections;
      set.requiredCorrections = corrections;
      set.adminRemarks = remarks ?? `Please make ${corrections.length === 1 ? "this correction" : `these ${corrections.length} corrections`} and resubmit your application.`;
      remarks = [remarks, ...corrections.map((c) => `• ${splitCorrection(c).text}`)].filter(Boolean).join("\n");
      note = { title: "Corrections needed on your application", body: `${corrections.length} item${corrections.length === 1 ? "" : "s"} to fix: ${corrections.map((c) => splitCorrection(c).text).join("; ")}`, href: "/dealer/application-status" };
      break;
    case "request_documents": {
      // Prefixed with the wizard area so the dealer's "Fix now" link opens the Documents step.
      corrections = d.documents.map((k) => `documents: Upload your ${docName(k)}`);
      set.requiredCorrections = corrections;
      const list = d.documents.map((k, i) => (i ? docName(k) : DOC_KIND_LABEL[k])).join(", ");
      set.adminRemarks = remarks ?? `Please upload: ${list}.`;
      note = { title: "Documents needed for your application", body: `${remarks ? `${remarks} ` : ""}Please upload: ${list}.`, href: "/dealer/application-status" };
      remarks = [remarks, `Documents requested: ${list}`].filter(Boolean).join("\n");
      break;
    }
    case "approve": {
      const renews = plusDaysISO(30);
      Object.assign(set, { approvedAt: now, decidedBy: me.id, planStatus: "trial", planRenewsAt: renews, requiredCorrections: null, adminRemarks: remarks });
      note = {
        title: "Welcome to MarchGear — your dealership is approved",
        body: `${remarks ? `${/[.!?]$/.test(remarks) ? remarks : `${remarks}.`} ` : ""}Your partner portal is fully unlocked and your public showroom page is live. Your free trial runs until ${day(new Date(`${renews}T00:00:00+05:30`))}.`,
        href: "/dealer/dashboard",
      };
      break;
    }
    case "reject":
      Object.assign(set, { decidedBy: me.id, requiredCorrections: null, adminRemarks: d.remarks });
      note = { title: "Your partner application was not approved", body: d.remarks, href: "/dealer/application-status" };
      break;
  }

  const [res] = await db.update(partners).set(set).where(and(eq(partners.id, p.id), eq(partners.status, p.status)));
  if (!res.affectedRows) return { ok: false, error: OFFLINE_RACE };

  await recordApproval({ partnerId: p.id, target: "partner", targetId: p.id, action: DECIDE_ACTION[d.op], fromStatus: p.status, toStatus: to, remarks, actorUserId: me.id, actorSide: "admin" });

  let brandsApproved = 0;
  if (d.op === "approve" && d.approveBrands) {
    const pending = await db.select({ id: partnerBrands.id, brand: partnerBrands.brand }).from(partnerBrands).where(and(eq(partnerBrands.partnerId, p.id), eq(partnerBrands.status, "pending")));
    brandsApproved = pending.length;
    if (pending.length) {
      await db.update(partnerBrands).set({ status: "approved" }).where(inArray(partnerBrands.id, pending.map((b) => b.id)));
      for (const b of pending) await recordApproval({ partnerId: p.id, target: "brand", targetId: b.id, action: "approved", fromStatus: "pending", toStatus: "approved", remarks: "Approved with the application", actorUserId: me.id, actorSide: "admin" });
    }
  }

  let publicDealerId: string | null = p.publicDealerId;
  if (d.op === "approve" || d.op === "reject") {
    await syncPartnerEverywhere(p.id);
    const [fresh] = await db.select({ publicDealerId: partners.publicDealerId }).from(partners).where(eq(partners.id, p.id));
    publicDealerId = fresh?.publicDealerId ?? null;
  }
  await notifyPartner(p.id, { kind: "application", ...note });
  const brandsNote = brandsApproved ? ` with ${brandsApproved} brand authorisation${brandsApproved === 1 ? "" : "s"}` : "";
  await audit(me.id, "status", "partner", p.id, `${PARTNER_STATUS_LABEL[p.status]} → ${PARTNER_STATUS_LABEL[to]}: ${name} (${p.reference})${brandsNote}`);
  touchAdmin();
  return { ok: true, status: to, publicDealerId };
}

const accountChange = z.object({
  op: z.enum(["suspend", "reactivate", "deactivate"]),
  remarks: z.string().trim().max(2000, "Keep this under 2000 characters").optional().transform((v) => v || null),
});
const ACCOUNT_FROM: Record<"suspend" | "reactivate" | "deactivate", PartnerStatus[]> = {
  suspend: ["approved"],
  reactivate: ["suspended", "deactivated"],
  deactivate: ["approved", "suspended", "rejected"],
};

/** Admins only: suspend, reactivate or deactivate a partner. Hides or restores the public listing and mirrored used cars. */
export async function partnerAccountAction(partnerId: unknown, input: unknown): Promise<ActionResult<{ status: PartnerStatus }>> {
  const me = await requireStaff("admin");
  const parsed = accountChange.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { op, remarks } = parsed.data;
  if (op !== "reactivate" && (!remarks || remarks.length < 5)) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { remarks: "Give the dealer a reason (at least 5 characters)" } };
  const p = await loadPartner(partnerId);
  if (!p) return { ok: false, error: "This dealer no longer exists." };
  if (!ACCOUNT_FROM[op].includes(p.status)) return { ok: false, error: `This dealer is ${PARTNER_STATUS_LABEL[p.status].toLowerCase()}, so it can't be ${op === "suspend" ? "suspended" : op === "reactivate" ? "reactivated" : "deactivated"}.` };
  const to: PartnerStatus = op === "suspend" ? "suspended" : op === "reactivate" ? "approved" : "deactivated";
  const db = getDb();
  const [res] = await db
    .update(partners)
    .set({ status: to, decidedBy: me.id, adminRemarks: remarks, ...(op === "reactivate" && !p.approvedAt ? { approvedAt: new Date() } : {}) })
    .where(and(eq(partners.id, p.id), eq(partners.status, p.status)));
  if (!res.affectedRows) return { ok: false, error: OFFLINE_RACE };
  const action = op === "suspend" ? "suspended" : op === "reactivate" ? "reactivated" : "deactivated";
  await recordApproval({ partnerId: p.id, target: "partner", targetId: p.id, action, fromStatus: p.status, toStatus: to, remarks, actorUserId: me.id, actorSide: "admin" });
  await syncPartnerEverywhere(p.id);
  await notifyPartner(p.id, {
    kind: "account",
    title: op === "suspend" ? "Your dealership has been suspended" : op === "reactivate" ? "Your dealership is active again" : "Your dealership account has been deactivated",
    body: remarks ?? (op === "reactivate" ? "Your public showroom page and live listings are visible again." : undefined),
    href: op === "reactivate" ? "/dealer/dashboard" : "/dealer/application-status",
  });
  await audit(me.id, "status", "partner", p.id, `${action[0].toUpperCase()}${action.slice(1)} dealer ${nameOf(p)} (${p.reference})`);
  touchAdmin();
  return { ok: true, status: to };
}

/** Admins only: the full bank account number, decrypted on the server. Every reveal is logged. */
export async function revealBankAccountAction(partnerId: unknown): Promise<ActionResult<{ accountNumber: string }>> {
  const me = await requireStaff("admin");
  const p = await loadPartner(partnerId);
  if (!p) return { ok: false, error: "This dealer no longer exists." };
  const stored = p.application.bank?.accountNumber ?? "";
  if (!stored) return { ok: false, error: "No bank account number on file." };
  let accountNumber: string;
  try {
    accountNumber = decryptField(stored);
  } catch {
    return { ok: false, error: "The stored account number couldn't be decrypted — check PARTNER_DATA_KEY." };
  }
  await audit(me.id, "note", "partner", p.id, `Revealed the full bank account number of ${nameOf(p)} (${p.reference})`);
  return { ok: true, accountNumber };
}

/** A staff-only note on a dealer — kept in the approval history, never shown to the dealer. */
export async function addInternalNoteAction(partnerId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff("dealers");
  const parsed = z.object({ note: z.string({ error: "Write a note" }).trim().min(2, "Write a note").max(2000, "Keep this under 2000 characters") }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const p = await loadPartner(partnerId);
  if (!p) return { ok: false, error: "This dealer no longer exists." };
  await recordApproval({ partnerId: p.id, target: "partner", targetId: p.id, action: "internal_note", remarks: parsed.data.note, actorUserId: me.id, actorSide: "admin" });
  await audit(me.id, "note", "partner", p.id, `Internal note on ${nameOf(p)} (${p.reference})`);
  return { ok: true };
}

/* ── Documents, brands, change requests ─────────────────────── */

const docReview = z.discriminatedUnion("status", [
  z.object({ status: z.literal("verified"), remarks: optionalRemarks }),
  z.object({ status: z.literal("rejected"), remarks: requiredRemarks("Tell the dealer what's wrong with this document") }),
  z.object({ status: z.literal("pending"), remarks: optionalRemarks }),
]);

export async function reviewDocumentAction(fileId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff("dealers");
  const parsed = docReview.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const fid = id.safeParse(fileId);
  if (!fid.success) return { ok: false, error: "Document not found" };
  const db = getDb();
  const [f] = await db
    .select({ id: partnerFiles.id, partnerId: partnerFiles.partnerId, kind: partnerFiles.kind, status: partnerFiles.status, reference: partners.reference, tradeName: partners.tradeName, legalName: partners.legalName })
    .from(partnerFiles)
    .innerJoin(partners, eq(partners.id, partnerFiles.partnerId))
    .where(eq(partnerFiles.id, fid.data));
  if (!f) return { ok: false, error: "This document no longer exists." };
  if (!(KYC_DOC_KINDS as readonly string[]).includes(f.kind)) return { ok: false, error: "Only account documents are reviewed here." };
  const { status, remarks } = parsed.data;
  if (status === f.status && !remarks) return { ok: true };
  await db.update(partnerFiles).set({ status, remarks }).where(eq(partnerFiles.id, f.id));
  const label = DOC_KIND_LABEL[f.kind as keyof typeof DOC_KIND_LABEL] ?? f.kind;
  await recordApproval({ partnerId: f.partnerId, target: "document", targetId: f.id, action: status === "pending" ? "reset" : status, fromStatus: f.status, toStatus: status, remarks, actorUserId: me.id, actorSide: "admin" });
  if (status !== "pending")
    await notifyPartner(f.partnerId, {
      kind: "document",
      title: status === "verified" ? `${label} verified` : `${label} needs attention`,
      body: remarks ?? (status === "verified" ? "MarchGear has checked and verified this document." : undefined),
      href: "/dealer/application-status",
    });
  await audit(me.id, "status", "partner", f.partnerId, `${label} ${status === "pending" ? "reset to pending" : status} for ${nameOf(f)} (${f.reference})`);
  return { ok: true };
}

const brandReview = z
  .object({
    status: z.enum(["approved", "rejected", "expired", "pending"]),
    remarks: optionalRemarks,
    validUntil: z.union([calendarDay, z.literal("")]).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.status === "rejected" && (!v.remarks || v.remarks.length < 5)) ctx.addIssue({ code: "custom", path: ["remarks"], message: "Tell the dealer why (at least 5 characters)" });
    if (v.status === "approved" && v.validUntil && v.validUntil < todayISO()) ctx.addIssue({ code: "custom", path: ["validUntil"], message: "This date has passed — mark it expired instead" });
  });

export async function reviewBrandAction(brandId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff("dealers");
  const parsed = brandReview.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const bid = id.safeParse(brandId);
  if (!bid.success) return { ok: false, error: "Brand authorisation not found" };
  const db = getDb();
  const [b] = await db
    .select({ id: partnerBrands.id, partnerId: partnerBrands.partnerId, slug: partnerBrands.brand, brandName: brands.name, status: partnerBrands.status, validUntil: partnerBrands.validUntil, partnerStatus: partners.status, reference: partners.reference, tradeName: partners.tradeName, legalName: partners.legalName })
    .from(partnerBrands)
    .innerJoin(partners, eq(partners.id, partnerBrands.partnerId))
    .leftJoin(brands, eq(brands.slug, partnerBrands.brand))
    .where(eq(partnerBrands.id, bid.data));
  if (!b) return { ok: false, error: "This brand authorisation no longer exists." };
  const brand = b.brandName ?? b.slug;
  const { status, remarks } = parsed.data;
  const validUntil = parsed.data.validUntil === undefined ? b.validUntil : parsed.data.validUntil || null;
  await db.update(partnerBrands).set({ status, remarks, validUntil }).where(eq(partnerBrands.id, b.id));
  const changedDate = validUntil !== b.validUntil ? ` · valid until ${validUntil ?? "no date"}` : "";
  await recordApproval({ partnerId: b.partnerId, target: "brand", targetId: b.id, action: status === "pending" ? "reset" : status, fromStatus: b.status, toStatus: status, remarks: [remarks, changedDate.slice(3)].filter(Boolean).join("\n") || null, actorUserId: me.id, actorSide: "admin" });
  await notifyPartner(b.partnerId, {
    kind: "brand",
    title: `Brand authorisation for ${brand}: ${BRAND_STATUS_LABEL[status]}`,
    body: remarks ?? undefined,
    href: "/dealer/brands",
  });
  await audit(me.id, "status", "partner", b.partnerId, `Brand ${brand} ${BRAND_STATUS_LABEL[status].toLowerCase()} for ${nameOf(b)} (${b.reference})${changedDate}`);
  if (b.partnerStatus === "approved") await syncPublicDealer(b.partnerId);
  return { ok: true };
}

const changeDecision = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), remarks: optionalRemarks }),
  z.object({ decision: z.literal("reject"), remarks: requiredRemarks("Tell the dealer why the change was rejected") }),
]);

const EDITABLE_ROOTS = new Set(["personal", "business", "bank"]);
const FORMAT: Record<string, { re: RegExp; label: string }> = {
  "business.gst": { re: PATTERNS.gst, label: "GST number" },
  "business.pan": { re: PATTERNS.pan, label: "PAN" },
  "bank.ifsc": { re: PATTERNS.ifsc, label: "IFSC" },
  "bank.accountNumber": { re: PATTERNS.account, label: "account number" },
  "personal.mobile": { re: PATTERNS.mobile, label: "mobile number" },
};

/** Applies "business.gst" → value style changes to a copy of the application. Only existing text fields under personal / business / bank. */
function applyFields(app: PartnerApplication, fields: Record<string, { from: string; to: string }>): { ok: true; app: PartnerApplication } | { ok: false; error: string } {
  const next = structuredClone(app) as unknown as Record<string, unknown>;
  for (const [path, change] of Object.entries(fields)) {
    const parts = path.split(".");
    if (parts.length < 2 || parts.length > 3 || !EDITABLE_ROOTS.has(parts[0]) || parts.some((s) => !/^[A-Za-z]+$/.test(s))) return { ok: false, error: `“${path}” can't be changed through a change request.` };
    let obj = next;
    for (const key of parts.slice(0, -1)) {
      const child = Object.hasOwn(obj, key) ? obj[key] : undefined;
      if (!child || typeof child !== "object" || Array.isArray(child)) return { ok: false, error: `“${fieldLabel(path)}” isn't a field of the application.` };
      obj = child as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1];
    if (!Object.hasOwn(obj, leaf) || typeof obj[leaf] !== "string") return { ok: false, error: `“${fieldLabel(path)}” isn't a text field of the application.` };
    let value = String(change?.to ?? "").trim();
    const fmt = FORMAT[path];
    if (fmt) {
      let plain = value;
      try {
        plain = decryptField(value);
      } catch {
        return { ok: false, error: `The new ${fmt.label} couldn't be read.` };
      }
      const check = path === "bank.accountNumber" ? plain.replace(/\s/g, "") : plain.toUpperCase();
      if (!fmt.re.test(check)) return { ok: false, error: `The new ${fmt.label} isn't valid — reject the request and ask the dealer to correct it.` };
      if (path !== "bank.accountNumber" && path !== "personal.mobile") value = check;
    }
    obj[leaf] = isBankPath(path) ? encryptField(value) : value;
  }
  return { ok: true, app: next as unknown as PartnerApplication };
}

/** Approves (applies) or rejects a dealer's request to change verified business details. */
export async function decideChangeRequestAction(requestId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff("dealers");
  const parsed = changeDecision.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const rid = id.safeParse(requestId);
  if (!rid.success) return { ok: false, error: "Change request not found" };
  const db = getDb();
  const [cr] = await db.select().from(partnerChangeRequests).where(eq(partnerChangeRequests.id, rid.data));
  if (!cr) return { ok: false, error: "This change request no longer exists." };
  if (cr.status !== "pending") return { ok: false, error: "This change request has already been decided." };
  const p = await loadPartner(cr.partnerId);
  if (!p) return { ok: false, error: "This dealer no longer exists." };
  const labels = Object.keys(cr.fields).map(fieldLabel);
  const { decision, remarks } = parsed.data;
  const now = new Date();

  if (decision === "approve") {
    const applied = applyFields(p.application, cr.fields);
    if (!applied.ok) return { ok: false, error: applied.error };
    const b = applied.app.business;
    const [claim] = await db.update(partnerChangeRequests).set({ status: "approved", remarks, decidedBy: me.id, decidedAt: now }).where(and(eq(partnerChangeRequests.id, cr.id), eq(partnerChangeRequests.status, "pending")));
    if (!claim.affectedRows) return { ok: false, error: OFFLINE_RACE };
    await db
      .update(partners)
      .set({ application: applied.app, legalName: b.legalName || p.legalName, tradeName: b.tradeName || p.tradeName, gst: b.gst || p.gst })
      .where(eq(partners.id, p.id));
    await syncPublicDealer(p.id);
  } else {
    const [claim] = await db.update(partnerChangeRequests).set({ status: "rejected", remarks, decidedBy: me.id, decidedAt: now }).where(and(eq(partnerChangeRequests.id, cr.id), eq(partnerChangeRequests.status, "pending")));
    if (!claim.affectedRows) return { ok: false, error: OFFLINE_RACE };
  }

  const what = labels.join(", ");
  await recordApproval({ partnerId: p.id, target: "profile_change", targetId: cr.id, action: decision === "approve" ? "approved" : "rejected", fromStatus: "pending", toStatus: decision === "approve" ? "approved" : "rejected", remarks: [`Fields: ${what}`, remarks].filter(Boolean).join("\n"), actorUserId: me.id, actorSide: "admin" });
  await notifyPartner(p.id, {
    kind: "profile_change",
    title: decision === "approve" ? "Your change request was approved" : "Your change request was not approved",
    body: decision === "approve" ? `Updated: ${what}.${remarks ? ` ${remarks}` : ""}` : remarks!,
    href: "/dealer/profile?tab=business",
  });
  await audit(me.id, "update", "partner", p.id, `${decision === "approve" ? "Approved" : "Rejected"} change request (${what}) for ${nameOf(p)} (${p.reference})`);
  touchAdmin();
  return { ok: true };
}

/* ── Vehicles ───────────────────────────────────────────────── */

const vehicleDecision = z.discriminatedUnion("op", [
  z.object({ op: z.literal("approve"), remarks: optionalRemarks }),
  z.object({ op: z.literal("approve_publish"), remarks: optionalRemarks }),
  z.object({ op: z.literal("publish"), remarks: optionalRemarks }),
  z.object({ op: z.literal("unpublish"), remarks: optionalRemarks }),
  z.object({ op: z.literal("reject"), remarks: requiredRemarks("Tell the dealer why the listing was rejected") }),
  z.object({ op: z.literal("request_changes"), remarks: requiredRemarks("Tell the dealer what to change") }),
]);
type VehicleOp = z.infer<typeof vehicleDecision>["op"];
const VEHICLE_FROM: Record<VehicleOp, PartnerVehicleStatus[]> = {
  approve: ["pending_approval", "changes_requested", "rejected"],
  approve_publish: ["pending_approval", "changes_requested", "rejected", "approved", "unpublished"],
  publish: ["approved", "unpublished"],
  unpublish: ["published"],
  reject: ["pending_approval", "changes_requested", "approved", "published", "unpublished"],
  request_changes: ["pending_approval", "approved", "published", "unpublished"],
};
const VEHICLE_TO: Record<VehicleOp, PartnerVehicleStatus> = {
  approve: "approved",
  approve_publish: "published",
  publish: "published",
  unpublish: "unpublished",
  reject: "rejected",
  request_changes: "changes_requested",
};
/**
 * New-car listings don't go through approval — the dealer publishes them. Staff can unpublish (pause) a live one,
 * with remarks the dealer sees (required), and put a paused one back live.
 */
const NEW_CAR_FROM: Partial<Record<VehicleOp, PartnerVehicleStatus[]>> = {
  unpublish: ["published"],
  publish: ["unpublished", "approved", "pending_approval", "changes_requested", "rejected"],
};
const VEHICLE_ACTION: Record<VehicleOp, string> = {
  approve: "approved",
  approve_publish: "approved_published",
  publish: "published",
  unpublish: "unpublished",
  reject: "rejected",
  request_changes: "changes_requested",
};

export async function vehicleDecisionAction(vehicleId: unknown, input: unknown): Promise<ActionResult<{ status: PartnerVehicleStatus; publicUsedCarId: string | null }>> {
  const me = await requireStaff("dealers");
  const parsed = vehicleDecision.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const vid = id.safeParse(vehicleId);
  if (!vid.success) return { ok: false, error: "Vehicle not found" };
  const db = getDb();
  const [row] = await db
    .select({ v: partnerVehicles, partnerStatus: partners.status, reference: partners.reference, tradeName: partners.tradeName, legalName: partners.legalName })
    .from(partnerVehicles)
    .innerJoin(partners, eq(partners.id, partnerVehicles.partnerId))
    .where(eq(partnerVehicles.id, vid.data));
  if (!row) return { ok: false, error: "This vehicle no longer exists." };
  const v = row.v;
  const { op, remarks } = parsed.data;
  const isNew = v.kind === "new";
  const from = isNew ? NEW_CAR_FROM[op] : VEHICLE_FROM[op];
  if (!from) return { ok: false, error: "New-car listings don't need approval — you can unpublish (pause) a live one, with remarks for the dealer." };
  if (!from.includes(v.status)) return { ok: false, error: `This listing is ${VEHICLE_STATUS_LABEL[v.status].toLowerCase()}, so that action isn't available. Refresh to see the latest.` };
  if (isNew && op === "unpublish" && !remarks) return { ok: false, error: "Tell the dealer why the listing is paused.", fieldErrors: { remarks: "Tell the dealer why the listing is paused" } };
  const to = VEHICLE_TO[op];
  if (to === "published" && row.partnerStatus !== "approved") return { ok: false, error: `The dealership is ${PARTNER_STATUS_LABEL[row.partnerStatus].toLowerCase()}, so its listings can't go live. Approve it first, or just approve the listing for now.` };
  if (to === "published" && !catalogueOf(v, await getCatalog()).ok)
    return { ok: false, error: "This listing's model or variant isn't in the MarchGear catalogue, so it can't go live. Add the model in the catalogue, or ask the dealer to pick it again." };
  const now = new Date();
  const set: Partial<typeof partnerVehicles.$inferInsert> = { status: to, adminRemarks: remarks };
  if (op === "approve" || op === "approve_publish") set.approvedAt = now;
  if (to === "published") set.publishedAt = now;
  const [res] = await db.update(partnerVehicles).set(set).where(and(eq(partnerVehicles.id, v.id), eq(partnerVehicles.status, v.status)));
  if (!res.affectedRows) return { ok: false, error: OFFLINE_RACE };

  const label = `${v.reference} · ${v.model} ${v.variant}`;
  await recordApproval({ partnerId: v.partnerId, target: "vehicle", targetId: v.id, action: VEHICLE_ACTION[op], fromStatus: v.status, toStatus: to, remarks, actorUserId: me.id, actorSide: "admin" });
  const publicUsedCarId = await syncPublicVehicle(v.id);
  if (v.kind === "used" && row.partnerStatus === "approved" && (to === "published" || v.status === "published")) await syncPublicDealer(v.partnerId);
  expireCatalog();
  const titles: Record<VehicleOp, string> = {
    approve: `${v.model} ${v.variant} approved`,
    approve_publish: `${v.model} ${v.variant} is live on MarchGear`,
    publish: `${v.model} ${v.variant} is live on MarchGear`,
    unpublish: isNew ? `MarchGear paused ${v.reference} · ${v.model} ${v.variant}` : `${v.model} ${v.variant} was unpublished`,
    reject: `${v.model} ${v.variant} was rejected`,
    request_changes: `Changes needed on ${v.model} ${v.variant}`,
  };
  await notifyPartner(v.partnerId, {
    kind: "vehicle",
    title: titles[op],
    body: remarks ?? `Listing ${v.reference} is now ${VEHICLE_STATUS_LABEL[to].toLowerCase()}.`,
    href: isNew || op === "request_changes" || op === "reject" ? `/dealer/inventory/${v.id}` : "/dealer/inventory",
  });
  await audit(me.id, "status", "partner_vehicle", v.id, `${VEHICLE_STATUS_LABEL[v.status]} → ${VEHICLE_STATUS_LABEL[to]}: ${label} (${nameOf(row)})`);
  touchAdmin();
  return { ok: true, status: to, publicUsedCarId: publicUsedCarId ?? null };
}

/* ── Offers & campaigns ─────────────────────────────────────── */

const offerDecision = z.discriminatedUnion("op", [
  z.object({ op: z.literal("approve"), remarks: optionalRemarks }),
  z.object({ op: z.literal("schedule"), startsAt: istDateTime, endsAt: istDateTime, remarks: optionalRemarks }),
  z.object({ op: z.literal("reject"), remarks: requiredRemarks("Tell the dealer why the offer was rejected") }),
  z.object({ op: z.literal("request_changes"), remarks: requiredRemarks("Tell the dealer what to change") }),
  z.object({ op: z.literal("pause"), remarks: optionalRemarks }),
  z.object({ op: z.literal("resume"), remarks: optionalRemarks }),
  z.object({ op: z.literal("cancel"), remarks: requiredRemarks("Tell the dealer why the campaign was cancelled") }),
  z.object({ op: z.literal("extend"), endsAt: istDateTime, remarks: optionalRemarks }),
]);
type OfferOp = z.infer<typeof offerDecision>["op"];
const OFFER_FROM: Record<OfferOp, OfferStatus[]> = {
  approve: ["submitted", "pending_approval", "changes_requested", "rejected"],
  schedule: ["submitted", "pending_approval", "changes_requested", "rejected", "approved", "paused"],
  reject: ["submitted", "pending_approval", "changes_requested", "approved", "paused"],
  request_changes: ["submitted", "pending_approval", "approved", "paused"],
  pause: ["approved"],
  resume: ["paused"],
  cancel: ["submitted", "pending_approval", "changes_requested", "approved", "paused"],
  extend: ["approved", "paused"],
};
const OFFER_TO: Record<Exclude<OfferOp, "extend">, OfferStatus> = {
  approve: "approved",
  schedule: "approved",
  reject: "rejected",
  request_changes: "changes_requested",
  pause: "paused",
  resume: "approved",
  cancel: "cancelled",
};
const OFFER_ACTION: Record<OfferOp, string> = {
  approve: "approved",
  schedule: "scheduled",
  reject: "rejected",
  request_changes: "changes_requested",
  pause: "paused",
  resume: "resumed",
  cancel: "cancelled",
  extend: "extended",
};
const fmtWhen = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export async function offerDecisionAction(offerId: unknown, input: unknown): Promise<ActionResult<{ display: string }>> {
  const me = await requireStaff("dealers");
  const parsed = offerDecision.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const oid = id.safeParse(offerId);
  if (!oid.success) return { ok: false, error: "Offer not found" };
  const db = getDb();
  const [row] = await db
    .select({ o: partnerOffers, reference: partners.reference, tradeName: partners.tradeName, legalName: partners.legalName, partnerStatus: partners.status })
    .from(partnerOffers)
    .innerJoin(partners, eq(partners.id, partnerOffers.partnerId))
    .where(eq(partnerOffers.id, oid.data));
  if (!row) return { ok: false, error: "This offer no longer exists." };
  const o = row.o;
  const d = parsed.data;
  const shown = offerDisplayStatus(o);
  if (!OFFER_FROM[d.op].includes(o.status)) return { ok: false, error: `This offer is ${OFFER_STATUS_LABEL[shown].toLowerCase()}, so that action isn't available. Refresh to see the latest.` };
  const now = new Date();
  const set: Partial<typeof partnerOffers.$inferInsert> = {};
  let remarks = d.remarks ?? null;

  switch (d.op) {
    case "approve":
      if (o.endsAt < now) return { ok: false, error: "This offer's end date has passed. Use Schedule to approve it with new dates." };
      Object.assign(set, { status: "approved", approvedAt: now, adminRemarks: remarks });
      break;
    case "schedule": {
      if (d.endsAt <= d.startsAt) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { endsAt: "The end must be after the start" } };
      if (d.endsAt <= now) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { endsAt: "The end must be in the future" } };
      Object.assign(set, { status: "approved", startsAt: d.startsAt, endsAt: d.endsAt, adminRemarks: remarks, ...(o.approvedAt ? {} : { approvedAt: now }) });
      remarks = [`Scheduled ${fmtWhen(d.startsAt)} – ${fmtWhen(d.endsAt)} (was ${fmtWhen(o.startsAt)} – ${fmtWhen(o.endsAt)})`, remarks].filter(Boolean).join("\n");
      break;
    }
    case "extend":
      if (d.endsAt <= o.endsAt) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { endsAt: "Choose a date after the current end" } };
      if (d.endsAt <= now) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { endsAt: "The new end must be in the future" } };
      set.endsAt = d.endsAt;
      remarks = [`End moved from ${fmtWhen(o.endsAt)} to ${fmtWhen(d.endsAt)}`, remarks].filter(Boolean).join("\n");
      break;
    case "pause":
      if (o.endsAt < now) return { ok: false, error: "This campaign has already ended." };
      Object.assign(set, { status: "paused", adminRemarks: remarks });
      break;
    default:
      Object.assign(set, { status: OFFER_TO[d.op], adminRemarks: remarks });
  }

  const [res] = await db.update(partnerOffers).set(set).where(and(eq(partnerOffers.id, o.id), eq(partnerOffers.status, o.status)));
  if (!res.affectedRows) return { ok: false, error: OFFLINE_RACE };
  const after = { status: (set.status ?? o.status) as OfferStatus, startsAt: set.startsAt ?? o.startsAt, endsAt: set.endsAt ?? o.endsAt };
  const display = offerDisplayStatus(after);
  await recordApproval({ partnerId: o.partnerId, target: "offer", targetId: o.id, action: OFFER_ACTION[d.op], fromStatus: o.status, toStatus: after.status, remarks, actorUserId: me.id, actorSide: "admin" });
  expireCatalog();
  const when = display === "scheduled" ? ` It goes live on ${fmtWhen(after.startsAt)}.` : display === "active" ? ` It's live until ${fmtWhen(after.endsAt)}.` : "";
  const titles: Record<OfferOp, string> = {
    approve: `Offer approved: ${o.title}`,
    schedule: `Offer scheduled: ${o.title}`,
    reject: `Offer rejected: ${o.title}`,
    request_changes: `Changes needed on your offer: ${o.title}`,
    pause: `Campaign paused: ${o.title}`,
    resume: `Campaign resumed: ${o.title}`,
    cancel: `Campaign cancelled: ${o.title}`,
    extend: `Campaign extended: ${o.title}`,
  };
  await notifyPartner(o.partnerId, { kind: "offer", title: titles[d.op], body: `${d.remarks ?? `${o.reference} is now ${OFFER_STATUS_LABEL[display].toLowerCase()}.`}${when}`.trim(), href: "/dealer/offers" });
  await audit(me.id, "status", "partner_offer", o.id, `${OFFER_STATUS_LABEL[shown]} → ${OFFER_STATUS_LABEL[display]}: ${o.reference} ${o.title} (${nameOf(row)})`);
  touchAdmin();
  return { ok: true, display: OFFER_STATUS_LABEL[display] };
}
