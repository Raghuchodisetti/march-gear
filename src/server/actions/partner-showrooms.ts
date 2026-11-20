"use server";

import { z } from "zod";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { media, partnerShowrooms, partners } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { PATTERNS } from "@/partner/application";
import { planById } from "@/partner/plans";
import { INDIAN_STATES } from "@/partner/schemas";
import { getCatalog } from "@/server/catalog";
import { isActionError, partnerAction, type PartnerContext } from "@/server/partner/context";
import { syncPublicDealer } from "@/server/partner/public-sync";
import { logPartnerActivity } from "@/server/partner/records";
import { invalid } from "@/server/validation";
import { dayHoursSchema, mediaId, mediaUrl } from "@/components/portal/showrooms/shared";

/* Showrooms and branches. Changes publish straight away (no re-approval) and re-sync the public dealer page. */

const filled = (msg: string, min = 2, max = 160) => z.string().trim().min(min, msg).max(max);

const showroomSchema = z
  .object({
    id: z.number().int().positive().nullable(),
    name: filled("Enter the showroom name"),
    address: filled("Enter the full street address", 8, 300),
    state: z.string().refine((v) => (INDIAN_STATES as readonly string[]).includes(v), "Choose the state"),
    district: filled("Enter the district", 2, 64),
    city: filled("Enter the city or town", 2, 64),
    pin: z.string().trim().regex(PATTERNS.pin, "Enter a valid 6-digit PIN code"),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    phone: z
      .string()
      .trim()
      .transform((v) => v.replace(/[^\d+]/g, ""))
      .refine((v) => !v || /^\+?\d{10,13}$/.test(v), "Enter a valid phone number"),
    hours: dayHoursSchema.refine((h) => h.some((d) => !d.closed), "Open on at least one day"),
    photos: z.array(mediaUrl).max(8, "Up to 8 photos per showroom"),
    serviceCentre: z.boolean(),
  })
  .superRefine((s, c) => {
    if ((s.lat === null) !== (s.lng === null)) c.addIssue({ code: "custom", path: ["location"], message: "Enter both latitude and longitude, or clear both" });
    else if (s.lat !== null && s.lng !== null && (s.lat < 6 || s.lat > 37.5 || s.lng < 68 || s.lng > 97.5)) c.addIssue({ code: "custom", path: ["location"], message: "These coordinates are outside India" });
  });

async function showroomLimit(ctx: PartnerContext) {
  const plans = (await getCatalog()).content.partnerPlans.plans;
  const plan = plans.find((p) => p.id === ctx.partner.plan);
  return { limit: plan ? plan.showrooms : planById(ctx.partner.plan).limits.showrooms, name: plan?.name ?? planById(ctx.partner.plan).name };
}

async function activeCount(partnerId: number) {
  const [{ n }] = await getDb()
    .select({ n: count() })
    .from(partnerShowrooms)
    .where(and(eq(partnerShowrooms.partnerId, partnerId), eq(partnerShowrooms.isActive, true)));
  return n;
}

async function afterChange(ctx: PartnerContext) {
  // Keep the denormalised city/state in step with the primary branch.
  const db = getDb();
  const [primary] = await db
    .select({ city: partnerShowrooms.city, state: partnerShowrooms.state })
    .from(partnerShowrooms)
    .where(and(eq(partnerShowrooms.partnerId, ctx.partner.id), eq(partnerShowrooms.isPrimary, true), eq(partnerShowrooms.isActive, true)))
    .limit(1);
  if (primary) await db.update(partners).set({ city: primary.city, state: primary.state }).where(eq(partners.id, ctx.partner.id));
  const publicId = await syncPublicDealer(ctx.partner.id);
  revalidatePath("/dealer", "layout");
  if (publicId) revalidatePath(`/dealers/${publicId}`);
}

export async function saveShowroomAction(input: unknown): Promise<ActionResult<{ id: number }>> {
  const ctx = await partnerAction("profile.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = showroomSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...v } = parsed.data;
  const db = getDb();

  const ids = [...new Set(v.photos.map(mediaId))];
  if (ids.length) {
    const own = await db
      .select({ id: media.id })
      .from(media)
      .where(and(inArray(media.id, ids), eq(media.partnerId, ctx.partner.id)));
    if (own.length !== ids.length) return { ok: false, error: "One of the photos wasn't uploaded by your dealership. Upload it again." };
  }
  const values = { ...v, phone: v.phone || null };

  if (id) {
    const [row] = await db
      .select({ id: partnerShowrooms.id })
      .from(partnerShowrooms)
      .where(and(eq(partnerShowrooms.id, id), eq(partnerShowrooms.partnerId, ctx.partner.id)));
    if (!row) return { ok: false, error: "That showroom couldn't be found." };
    await db.update(partnerShowrooms).set(values).where(eq(partnerShowrooms.id, id));
    await logPartnerActivity(ctx.partner.id, ctx.user.id, "update", "showroom", id, `Updated showroom ${v.name}`);
    await afterChange(ctx);
    return { ok: true, id };
  }

  const [{ limit, name }, active] = await Promise.all([showroomLimit(ctx), activeCount(ctx.partner.id)]);
  if (limit !== null && active >= limit)
    return { ok: false, error: `Your ${name} plan includes ${limit} showroom${limit === 1 ? "" : "s"}. Upgrade under Subscription to add more branches, or deactivate one first.` };
  const [res] = await db.insert(partnerShowrooms).values({ ...values, partnerId: ctx.partner.id, isPrimary: active === 0 });
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "create", "showroom", res.insertId, `Added showroom ${v.name}`);
  await afterChange(ctx);
  return { ok: true, id: res.insertId };
}

const idSchema = z.coerce.number().int().positive();

export async function setShowroomActiveAction(input: unknown): Promise<ActionResult> {
  const ctx = await partnerAction("profile.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = z.object({ id: idSchema, active: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That showroom couldn't be found." };
  const { id, active } = parsed.data;
  const db = getDb();
  const [row] = await db.select().from(partnerShowrooms).where(and(eq(partnerShowrooms.id, id), eq(partnerShowrooms.partnerId, ctx.partner.id)));
  if (!row) return { ok: false, error: "That showroom couldn't be found." };
  if (row.isActive === active) return { ok: true };
  if (!active && row.isPrimary) return { ok: false, error: "This is your primary showroom. Make another branch primary before deactivating it." };
  if (active) {
    const [{ limit, name }, n] = await Promise.all([showroomLimit(ctx), activeCount(ctx.partner.id)]);
    if (limit !== null && n >= limit) return { ok: false, error: `Your ${name} plan includes ${limit} active showroom${limit === 1 ? "" : "s"}. Upgrade under Subscription or deactivate another branch first.` };
  }
  // Reactivating with no other active branch makes it primary again.
  const makePrimary = active && (await activeCount(ctx.partner.id)) === 0;
  await db.update(partnerShowrooms).set({ isActive: active, ...(makePrimary ? { isPrimary: true } : {}) }).where(eq(partnerShowrooms.id, id));
  await logPartnerActivity(ctx.partner.id, ctx.user.id, active ? "activate" : "deactivate", "showroom", id, `${active ? "Reactivated" : "Deactivated"} showroom ${row.name}`);
  await afterChange(ctx);
  return { ok: true };
}

export async function setPrimaryShowroomAction(id: unknown): Promise<ActionResult> {
  const ctx = await partnerAction("profile.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "That showroom couldn't be found." };
  const db = getDb();
  const [row] = await db.select().from(partnerShowrooms).where(and(eq(partnerShowrooms.id, parsed.data), eq(partnerShowrooms.partnerId, ctx.partner.id)));
  if (!row) return { ok: false, error: "That showroom couldn't be found." };
  if (!row.isActive) return { ok: false, error: "Reactivate this showroom before making it your primary branch." };
  await db.transaction(async (tx) => {
    await tx.update(partnerShowrooms).set({ isPrimary: false }).where(and(eq(partnerShowrooms.partnerId, ctx.partner.id), ne(partnerShowrooms.id, row.id)));
    await tx.update(partnerShowrooms).set({ isPrimary: true }).where(eq(partnerShowrooms.id, row.id));
  });
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "update", "showroom", row.id, `Made ${row.name} the primary showroom`);
  await afterChange(ctx);
  return { ok: true };
}
