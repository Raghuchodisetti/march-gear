"use server";

import { z } from "zod";
import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { insCompanies, insProducts, insVendors } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import type { CompanyClaimInfo } from "@/insurance/types";
import { audit } from "@/server/audit";
import { requireStaff } from "@/server/auth";
import { isDuplicate } from "@/server/db-errors";
import { notifyInsurer, recordInsApproval } from "@/server/insurance/records";
import { invalid } from "@/server/validation";

/* ──────────────────────────────────────────────────────────────
   Insurance configuration that isn't a content block: the
   insurance companies (underwriters) customers see as providers.
   Pricing, marketplace settings and vendor plans are content
   blocks saved with saveContentAction (src/server/actions/content.ts).
   ────────────────────────────────────────────────────────────── */

const id = z.coerce.number().int().positive();
const thisYear = () => new Date().getFullYear();

const optional = (max: number, label = "This") =>
  z
    .string()
    .trim()
    .max(max, `${label} must be under ${max} characters`)
    .nullish()
    .transform((v) => v || null);
const phone = (label: string) =>
  optional(30, label).refine((v) => v === null || /^[0-9+()\-\s]{6,30}$/.test(v), `Enter a valid ${label.toLowerCase()} (digits, spaces, + and -)`);
const optionalInt = (label: string, min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? Number(v) : v),
    z.number({ error: `Enter the ${label} as a number` }).int(`Enter the ${label} as a whole number`).min(min, `The ${label} can't be below ${min}`).max(max, `The ${label} can't be above ${max}`).nullable(),
  );

const companySchema = z
  .object({
    name: z.string({ error: "Enter the company name" }).trim().min(2, "Enter the company name").max(160, "Keep the name under 160 characters"),
    slug: z
      .string({ error: "Enter a URL slug" })
      .trim()
      .toLowerCase()
      .min(2, "Enter a URL slug")
      .max(80, "Keep the slug under 80 characters")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case letters, numbers and single dashes"),
    shortName: optional(60, "The short name"),
    logo: optional(300, "The logo URL").refine((v) => v === null || /^(\/media\/|https:\/\/)/.test(v), "Choose an image from the media library"),
    about: optional(3000, "About"),
    website: optional(300, "The website").refine((v) => v === null || /^https:\/\/[^\s]+\.[^\s]+/.test(v), "Use a full https:// address"),
    regulatorRegNo: optional(60, "The registration number"),
    headquarters: optional(120, "Headquarters"),
    establishedYear: optionalInt("established year", 1800, thisYear()),
    garageCount: optionalInt("garage count", 0, 100_000),
    garageNote: optional(200, "The note"),
    supportPhone: phone("Support phone"),
    claimsPhone: phone("Claims phone"),
    claimsEmail: optional(190, "The email").refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email address"),
    isActive: z.boolean().default(true),
    vendorId: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), id.nullable()),
    claim: z
      .object({
        settlementRatio: z.preprocess(
          (v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? Number(v) : v),
          z.number({ error: "Enter the ratio as a number" }).min(0, "The ratio can't be below 0%").max(100, "The ratio can't be above 100%").nullable(),
        ),
        year: optional(40, "The year"),
        source: optional(300, "The source"),
        process: z
          .array(z.string())
          .default([])
          .transform((a) => a.map((s) => s.trim()).filter(Boolean))
          .pipe(z.array(z.string().max(300, "Keep each step under 300 characters")).max(15, "Add at most 15 steps")),
        verified: z.boolean().default(false),
      })
      .default({ settlementRatio: null, year: null, source: null, process: [], verified: false }),
  })
  .superRefine((v, ctx) => {
    if (v.claim.verified) {
      if (v.claim.settlementRatio === null) ctx.addIssue({ code: "custom", path: ["claim", "settlementRatio"], message: "Enter the verified ratio" });
      if (!v.claim.year) ctx.addIssue({ code: "custom", path: ["claim", "year"], message: "Enter the year the figure is for" });
      if (!v.claim.source) ctx.addIssue({ code: "custom", path: ["claim", "source"], message: "Say where the figure comes from" });
    }
  });

/** Creates (companyId null) or updates an insurance company. */
export async function saveInsCompanyAction(companyId: unknown, input: unknown): Promise<ActionResult<{ id: number }>> {
  const me = await requireStaff();
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const db = getDb();
  const editing = companyId === null || companyId === undefined ? null : id.safeParse(companyId);
  if (editing && !editing.success) return { ok: false, error: "Company not found" };
  const [prev] = editing ? await db.select().from(insCompanies).where(eq(insCompanies.id, editing.data)) : [];
  if (editing && !prev) return { ok: false, error: "This company no longer exists." };

  // A linked vendor must be an insurer, and each insurer vendor maps to one company.
  if (v.vendorId) {
    const [vendor] = await db.select({ id: insVendors.id, category: insVendors.category }).from(insVendors).where(eq(insVendors.id, v.vendorId));
    if (!vendor) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { vendorId: "That vendor no longer exists" } };
    if (vendor.category !== "insurer") return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { vendorId: "Only insurer vendors can be linked to a company" } };
    const [other] = await db
      .select({ name: insCompanies.name })
      .from(insCompanies)
      .where(and(eq(insCompanies.vendorId, v.vendorId), ...(prev ? [ne(insCompanies.id, prev.id)] : [])))
      .limit(1);
    if (other) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { vendorId: `This vendor is already linked to ${other.name}` } };
  }

  const before = prev?.claimInfo ?? null;
  const figuresChanged = !before || before.settlementRatio !== v.claim.settlementRatio || (before.year || null) !== v.claim.year || (before.source || null) !== v.claim.source;
  const reverify = v.claim.verified && (!before?.verified || figuresChanged);
  const hasClaim = v.claim.verified || v.claim.settlementRatio !== null || v.claim.year || v.claim.source || v.claim.process.length;
  const claimInfo: CompanyClaimInfo | null = hasClaim
    ? {
        settlementRatio: v.claim.settlementRatio,
        year: v.claim.year ?? "",
        source: v.claim.source ?? "",
        process: v.claim.process,
        verified: v.claim.verified,
        verifiedAt: v.claim.verified ? (reverify ? new Date().toISOString() : (before?.verifiedAt ?? new Date().toISOString())) : null,
        verifiedBy: v.claim.verified ? (reverify ? me.id : (before?.verifiedBy ?? me.id)) : null,
      }
    : null;

  const values = {
    name: v.name,
    slug: v.slug,
    shortName: v.shortName,
    logo: v.logo,
    about: v.about,
    website: v.website,
    regulatorRegNo: v.regulatorRegNo,
    headquarters: v.headquarters,
    establishedYear: v.establishedYear,
    garageCount: v.garageCount,
    garageNote: v.garageNote,
    supportPhone: v.supportPhone,
    claimsPhone: v.claimsPhone,
    claimsEmail: v.claimsEmail,
    isActive: v.isActive,
    vendorId: v.vendorId,
    claimInfo,
  };

  let savedId: number;
  try {
    if (prev) {
      await db.update(insCompanies).set(values).where(eq(insCompanies.id, prev.id));
      savedId = prev.id;
    } else {
      const [res] = await db.insert(insCompanies).values(values);
      savedId = res.insertId;
    }
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { slug: "Another company already uses this slug" } };
    throw err;
  }

  // Linking a vendor shows in its history; going inactive hides every product under the company.
  if (v.vendorId && v.vendorId !== prev?.vendorId) {
    await recordInsApproval({ vendorId: v.vendorId, target: "company", targetId: savedId, action: "linked", remarks: `Linked to the insurance company ${v.name}`, actorUserId: me.id, actorSide: "admin" });
  }
  if (prev && prev.isActive !== v.isActive) {
    const vendors = await db.selectDistinct({ vendorId: insProducts.vendorId }).from(insProducts).where(eq(insProducts.companyId, prev.id));
    for (const { vendorId } of vendors)
      await notifyInsurer(vendorId, {
        kind: "company",
        title: v.isActive ? `${v.name} is active again on MarchGear` : `${v.name} is no longer listed on MarchGear`,
        body: v.isActive ? "Your published products underwritten by this insurer are visible again." : "Products underwritten by this insurer are hidden from the website until MarchGear reactivates it.",
        href: "/insurance-vendor/products",
      });
  }
  const verifyNote = reverify ? " · claim figures verified" : before?.verified && !v.claim.verified ? " · claim figures unverified" : "";
  await audit(me.id, prev ? "update" : "create", "ins_company", savedId, `${prev ? "Updated" : "Created"} insurance company ${v.name}${prev && prev.isActive !== v.isActive ? (v.isActive ? " · reactivated" : " · deactivated") : ""}${verifyNote}`);
  revalidatePath("/admin/insurance", "layout");
  revalidatePath("/insurance", "layout");
  return { ok: true, id: savedId };
}

/** Admins only: deletes a company that no product uses. */
export async function deleteInsCompanyAction(companyId: unknown): Promise<ActionResult> {
  const me = await requireStaff(["admin"]);
  const cid = id.safeParse(companyId);
  if (!cid.success) return { ok: false, error: "Company not found" };
  const db = getDb();
  const [c] = await db.select({ id: insCompanies.id, name: insCompanies.name }).from(insCompanies).where(eq(insCompanies.id, cid.data));
  if (!c) return { ok: false, error: "This company no longer exists." };
  const [{ n }] = await db.select({ n: count() }).from(insProducts).where(eq(insProducts.companyId, c.id));
  if (n > 0) return { ok: false, error: `${n} product${n === 1 ? " uses" : "s use"} ${c.name}, so it can't be deleted. Deactivate it instead.` };
  try {
    await db.delete(insCompanies).where(eq(insCompanies.id, c.id));
  } catch {
    return { ok: false, error: `${c.name} is still referenced elsewhere, so it can't be deleted. Deactivate it instead.` };
  }
  await audit(me.id, "delete", "ins_company", c.id, `Deleted insurance company ${c.name}`);
  revalidatePath("/admin/insurance", "layout");
  return { ok: true };
}
