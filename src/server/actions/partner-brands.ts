"use server";

import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { partnerBrands, partnerFiles, partnerShowrooms } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { getCatalog } from "@/server/catalog";
import { isDuplicate } from "@/server/db-errors";
import { isActionError, partnerAction, type PartnerContext } from "@/server/partner/context";
import { syncPublicDealer } from "@/server/partner/public-sync";
import { logPartnerActivity, notifyPartner, recordApproval } from "@/server/partner/records";
import { invalid, todayISO } from "@/server/validation";

/* Brand authorisations (reviewed by MarchGear) and the models/variants a dealer sells (no review). */

const fileRef = z.object({ id: z.number().int().positive(), filename: z.string().max(200), mime: z.string().max(60), size: z.number().int().nonnegative() });

const brandFields = {
  certificate: fileRef.nullable().refine((v) => v !== null, "Upload the brand authorisation certificate"),
  validUntil: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Choose a date"),
  showroomIds: z.array(z.number().int().positive()).max(50),
};

const EXPIRED = { ok: false as const, error: "Please check the highlighted fields.", fieldErrors: { validUntil: "That date has passed — upload a current certificate with its new expiry date" } };

/** The certificate must be a brand-authorisation file this dealership uploaded; branches must be its own. */
async function checkRefs(ctx: PartnerContext, certificateId: number, showroomIds: number[]) {
  const db = getDb();
  const [file] = await db
    .select({ id: partnerFiles.id })
    .from(partnerFiles)
    .where(and(eq(partnerFiles.id, certificateId), eq(partnerFiles.partnerId, ctx.partner.id), eq(partnerFiles.kind, "brand_authorization")));
  if (!file) return { ok: false as const, fieldErrors: { certificate: "Upload the certificate again." }, error: "Please check the highlighted fields." };
  if (showroomIds.length) {
    const rooms = await db
      .select({ id: partnerShowrooms.id })
      .from(partnerShowrooms)
      .where(and(eq(partnerShowrooms.partnerId, ctx.partner.id), inArray(partnerShowrooms.id, showroomIds)));
    if (rooms.length !== new Set(showroomIds).size) return { ok: false as const, error: "One of the branches couldn't be found. Refresh the page and try again." };
  }
  return null;
}

async function done(ctx: PartnerContext) {
  const publicId = await syncPublicDealer(ctx.partner.id);
  revalidatePath("/dealer", "layout");
  if (publicId) revalidatePath(`/dealers/${publicId}`);
}

export async function addBrandAction(input: unknown): Promise<ActionResult<{ id: number }>> {
  const ctx = await partnerAction("brands.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = z.object({ brand: z.string().trim().min(1, "Choose a brand").max(80), ...brandFields }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const catalog = await getCatalog();
  const brand = catalog.getBrand(v.brand);
  if (!brand) return { ok: false, fieldErrors: { brand: "Choose a brand from the list" }, error: "Please check the highlighted fields." };
  if (v.validUntil && v.validUntil < todayISO()) return EXPIRED;
  const bad = await checkRefs(ctx, v.certificate!.id, v.showroomIds);
  if (bad) return bad;

  const db = getDb();
  try {
    const [res] = await db.insert(partnerBrands).values({
      partnerId: ctx.partner.id,
      brand: brand.slug,
      models: [],
      variants: [],
      certificate: v.certificate,
      validUntil: v.validUntil || null,
      status: "pending",
      showroomIds: [...new Set(v.showroomIds)],
    });
    await recordApproval({ partnerId: ctx.partner.id, target: "brand", targetId: res.insertId, action: "submitted", toStatus: "pending", actorUserId: ctx.user.id, actorSide: "dealer" });
    await notifyPartner(ctx.partner.id, { userId: ctx.user.id, kind: "brand", title: `${brand.name} authorisation sent for review`, body: "MarchGear will check the certificate and let you know.", href: "/dealer/brands" });
    await logPartnerActivity(ctx.partner.id, ctx.user.id, "submit", "brand", res.insertId, `Submitted ${brand.name} brand authorisation for review`);
    await done(ctx);
    return { ok: true, id: res.insertId };
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, fieldErrors: { brand: `${brand.name} is already on your list` }, error: "Please check the highlighted fields." };
    throw err;
  }
}

export async function updateBrandAction(input: unknown): Promise<ActionResult<{ resubmitted: boolean }>> {
  const ctx = await partnerAction("brands.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = z.object({ id: z.number().int().positive(), ...brandFields }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const db = getDb();
  const [row] = await db.select().from(partnerBrands).where(and(eq(partnerBrands.id, v.id), eq(partnerBrands.partnerId, ctx.partner.id)));
  if (!row) return { ok: false, error: "That brand couldn't be found." };
  if (v.validUntil && v.validUntil !== (row.validUntil ?? "") && v.validUntil < todayISO()) return EXPIRED;
  const bad = await checkRefs(ctx, v.certificate!.id, v.showroomIds);
  if (bad) return bad;

  const name = (await getCatalog()).brandName(row.brand);
  // A new certificate or expiry date goes back to MarchGear for review; branch mapping doesn't.
  const resubmit = row.certificate?.id !== v.certificate!.id || (row.validUntil ?? "") !== v.validUntil || row.status === "rejected";
  await db
    .update(partnerBrands)
    .set({ certificate: v.certificate, validUntil: v.validUntil || null, showroomIds: [...new Set(v.showroomIds)], ...(resubmit ? { status: "pending" as const } : {}) })
    .where(eq(partnerBrands.id, row.id));
  if (resubmit) {
    await recordApproval({ partnerId: ctx.partner.id, target: "brand", targetId: row.id, action: "resubmitted", fromStatus: row.status, toStatus: "pending", actorUserId: ctx.user.id, actorSide: "dealer" });
    await notifyPartner(ctx.partner.id, { userId: ctx.user.id, kind: "brand", title: `${name} authorisation sent for review`, body: "The updated certificate is with MarchGear for review.", href: "/dealer/brands" });
  }
  await logPartnerActivity(ctx.partner.id, ctx.user.id, resubmit ? "submit" : "update", "brand", row.id, resubmit ? `Resubmitted ${name} authorisation with an updated certificate` : `Updated branches for ${name}`);
  await done(ctx);
  return { ok: true, resubmitted: resubmit };
}

export async function removeBrandAction(id: unknown): Promise<ActionResult> {
  const ctx = await partnerAction("brands.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = z.coerce.number().int().positive().safeParse(id);
  if (!parsed.success) return { ok: false, error: "That brand couldn't be found." };
  const db = getDb();
  const [row] = await db.select().from(partnerBrands).where(and(eq(partnerBrands.id, parsed.data), eq(partnerBrands.partnerId, ctx.partner.id)));
  if (!row) return { ok: false, error: "That brand couldn't be found." };
  await db.delete(partnerBrands).where(eq(partnerBrands.id, row.id));
  const name = (await getCatalog()).brandName(row.brand);
  await recordApproval({ partnerId: ctx.partner.id, target: "brand", targetId: row.id, action: "withdrawn", fromStatus: row.status, toStatus: "removed", actorUserId: ctx.user.id, actorSide: "dealer" });
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "delete", "brand", row.id, `Removed ${name} from the dealership's brands`);
  await done(ctx);
  return { ok: true };
}

/** The models and variants this dealership sells for one of its brands — no review needed. */
export async function saveBrandModelsAction(input: unknown): Promise<ActionResult> {
  const ctx = await partnerAction("brands.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = z
    .object({ id: z.number().int().positive(), models: z.array(z.string().max(120)).max(200), variants: z.array(z.string().max(250)).max(2000) })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const db = getDb();
  const [row] = await db.select().from(partnerBrands).where(and(eq(partnerBrands.id, v.id), eq(partnerBrands.partnerId, ctx.partner.id)));
  if (!row) return { ok: false, error: "That brand couldn't be found." };
  if (row.status === "rejected") return { ok: false, error: "This brand authorisation was rejected. Update the certificate on the Brands page first." };

  const catalog = await getCatalog();
  const line = new Map(catalog.carsByBrand(row.brand).map((c) => [c.slug, new Set(c.variants.map((x) => x.slug))]));
  const models = [...new Set(v.models)].filter((m) => line.has(m));
  if (models.length !== new Set(v.models).size) return { ok: false, error: "Some models aren't in the MarchGear catalogue for this brand. Refresh the page and try again." };
  const variants = [...new Set(v.variants)].filter((key) => {
    const [car, variant] = key.split("/");
    return models.includes(car) && line.get(car)?.has(variant);
  });
  await db.update(partnerBrands).set({ models, variants }).where(eq(partnerBrands.id, row.id));
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "update", "brand_models", row.id, `Updated ${catalog.brandName(row.brand)} line-up: ${models.length} model${models.length === 1 ? "" : "s"}, ${variants.length} variant${variants.length === 1 ? "" : "s"}`);
  revalidatePath("/dealer", "layout");
  return { ok: true };
}
