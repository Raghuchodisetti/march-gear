"use server";

import { randomInt } from "node:crypto";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cars, leads, ownerReviews, subscribers, type LeadType } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { getSessionUser } from "@/server/auth";
import { HOUR, allowFromIp } from "@/server/rate-limit";
import { isDuplicate } from "@/server/db-errors";
import { routeSiteLead } from "@/server/partner/lead-routing";
import { email, invalid, isoDate, mobile, name, optionalText, todayISO } from "@/server/validation";

/* ──────────────────────────────────────────────────────────────
   Every public form posts here. Each lead type has its own rules;
   everything lands in the `leads` table for the admin panel.
   ────────────────────────────────────────────────────────────── */

const futureDate = isoDate.refine((d) => d >= todayISO(), "Pick a date from today onwards");
const detail = z.union([z.string().max(300), z.number(), z.boolean(), z.null()]);
const extraDetails = z
  .record(z.string().max(40), detail)
  .refine((o) => Object.keys(o).length <= 15, "Too many details")
  .optional();
const TOO_MANY = "Too many requests from your network. Please try again in a little while.";

/**
 * Consent at the point of collection (DPDP Act, 2023): every form sends `consent: true` from an unticked checkbox
 * whose text names who may contact the visitor and why. Requests without it are refused; the time it was given is
 * stored with the lead (`details.consentAt`).
 */
const CONSENT_REQUIRED = "Please tick the consent box so we can act on your request";
const consent = z.literal(true, { error: CONSENT_REQUIRED });

const common = {
  name,
  phone: mobile,
  email: email.optional(),
  city: optionalText(64),
  subject: optionalText(200),
  carSlug: optionalText(120),
  usedCarId: optionalText(64),
  dealerId: optionalText(64),
  message: optionalText(2000),
  source: optionalText(200),
  consent,
  /** Honeypot — real people never fill this in; filled-in submissions are silently dropped. */
  website: z.string().max(500).optional(),
};

const leadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("test_drive"), ...common, details: z.object({ date: futureDate, slot: z.enum(["morning", "afternoon", "evening"]) }) }),
  z.object({ type: z.literal("inspection"), ...common, details: z.object({ date: futureDate, slot: z.enum(["morning", "afternoon", "evening"]) }) }),
  z.object({ type: z.literal("best_price"), ...common, details: z.object({ timeline: z.enum(["week", "month", "later"]) }) }),
  z.object({ type: z.literal("contact_dealer"), ...common, details: extraDetails }),
  z.object({ type: z.literal("callback"), ...common, details: extraDetails }),
  z.object({
    type: z.literal("pdi_booking"),
    ...common,
    city: z.string().trim().min(2, "Choose your city").max(64),
    subject: z.string().trim().min(2, "Choose the car you're buying").max(200),
    details: z.object({
      plan: z.string().min(2).max(40),
      dealer: z.string().trim().min(2, "Enter the dealership name").max(200),
      deliveryDate: futureDate,
    }),
  }),
  z.object({
    type: z.literal("pdi_checklist"),
    ...common,
    // Optional: the checklist downloads in the browser — no email is sent, so we don't insist on an address.
    details: z.object({
      brand: z.string().trim().min(2, "Enter the brand name").max(80),
      model: z.string().trim().min(1, "Enter the model name").max(120),
      fuel: z.enum(["Petrol", "Diesel", "CNG", "Hybrid", "Electric"]),
      deliveryDate: futureDate,
    }),
  }),
  z.object({
    type: z.literal("sell_car"),
    ...common,
    city: z.string().trim().min(2, "Choose your city").max(64),
    details: z.object({
      brand: z.string().max(80),
      model: z.string().max(120),
      year: z.number().int().min(1990).max(2100),
      fuel: z.string().max(20),
      transmission: z.string().max(20),
      km: z.number().int().min(0).max(2_000_000),
      estimate: z.string().max(80).optional(),
    }),
  }),
  z.object({
    type: z.literal("used_car"),
    ...common,
    name: name.optional(),
    usedCarId: z.string().min(1).max(64),
    details: z.object({ offer: z.number().int().positive(), askingPrice: z.number().int().positive() }),
  }),
  z.object({
    type: z.literal("contact"),
    ...common,
    email,
    phone: z.union([z.literal("").transform(() => undefined), mobile]).optional(),
    subject: z.string().trim().min(2, "Choose what your message is about").max(200),
    message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(2000),
  }),
]);

export type LeadInput = z.input<typeof leadSchema>;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const reference = (type: LeadType) =>
  `${type.startsWith("pdi") ? "PDI" : "MG"}-${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;

export async function submitLeadAction(input: LeadInput): Promise<ActionResult<{ reference: string }>> {
  if (!(await allowFromIp("lead", 20, HOUR))) return { ok: false, error: TOO_MANY };
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { website, consent: agreed, ...rest } = parsed.data;
  const { details, ...lead } = rest as typeof rest & { details?: Record<string, string | number | boolean | null> };
  // The consent record is kept with the lead: staff see it in /admin/leads, the customer on their request page.
  const recorded = { ...(details ?? {}), consent: agreed, consentAt: new Date().toISOString() };
  // Bots get a convincing success and nothing is stored.
  if (website) return { ok: true, reference: reference(lead.type) };

  const user = await getSessionUser("customer");
  const db = getDb();
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = reference(lead.type);
    try {
      const [inserted] = await db.insert(leads).values({
        ...lead,
        reference: ref,
        name: lead.name ?? user?.name ?? null,
        email: lead.email ?? (lead.type === "callback" || lead.type === "contact_dealer" ? user?.email : undefined) ?? null,
        phone: lead.phone ?? null,
        city: lead.city ?? null,
        subject: lead.subject ?? null,
        carSlug: lead.carSlug ?? null,
        usedCarId: lead.usedCarId ?? null,
        dealerId: lead.dealerId ?? null,
        message: lead.message ?? null,
        source: lead.source ?? null,
        details: recorded,
        userId: user?.id ?? null,
      });
      // Enquiries about a dealer partner's page, listing or offer also go to that dealer's CRM (never throws).
      await routeSiteLead(inserted.insertId);
      return { ok: true, reference: ref };
    } catch (err) {
      // Retry only on a (very unlikely) duplicate reference.
      if (!isDuplicate(err)) throw err;
    }
  }
  return { ok: false, error: "Something went wrong. Please try again." };
}

/* ── Newsletter ─────────────────────────────────────────────── */

/**
 * Newsletter sign-up. A separate, explicit opt-in (`consent: true` from its own unticked checkbox) — never bundled
 * into a lead or an account. The subscriber row's `created_at` is the time the opt-in was given.
 */
export async function subscribeAction(input: unknown): Promise<ActionResult> {
  if (!(await allowFromIp("subscribe", 10, HOUR))) return { ok: false, error: TOO_MANY };
  const parsed = z
    .object({ email, source: optionalText(200), consent: z.literal(true, { error: "Tick the box to confirm you'd like the newsletter" }) })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await getDb()
    .insert(subscribers)
    .ignore()
    .values({ email: parsed.data.email, source: parsed.data.source ?? null });
  return { ok: true };
}

/**
 * Withdraws newsletter consent. Always answers the same way, so it can't be used to find out whether an address
 * is subscribed; removing someone else's address only stops emails they'd be able to opt back into.
 */
export async function unsubscribeAction(input: unknown): Promise<ActionResult> {
  if (!(await allowFromIp("unsubscribe", 10, HOUR))) return { ok: false, error: TOO_MANY };
  const parsed = z.object({ email }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await getDb().delete(subscribers).where(eq(subscribers.email, parsed.data.email));
  return { ok: true };
}

/* ── Owner reviews (moderated before they appear) ───────────── */

const reviewSchema = z.object({
  carSlug: z.string().min(1, "Choose your car").max(120),
  variant: z.string().trim().min(1, "Choose your variant").max(120),
  rating: z.number().int().min(1, "Give an overall rating").max(5),
  ownedFor: z.string().trim().min(1).max(60),
  kmDriven: z.number().int().min(0).max(1_000_000),
  title: z.string().trim().min(4, "Add a short headline").max(200),
  body: z.string().trim().min(40, "Write at least 40 characters").max(5000),
  name,
  city: z.string().trim().min(2, "Enter your city").max(64),
  ratings: z.object({
    exterior: z.number().min(1).max(5),
    comfort: z.number().min(1).max(5),
    performance: z.number().min(1).max(5),
    value: z.number().min(1).max(5),
  }),
  /** "This is my own experience, and MarchGear may publish it with my display name and city." */
  consent: z.literal(true, { error: "Please confirm this is your own experience and that we may publish it" }),
});

export async function submitOwnerReviewAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await allowFromIp("review", 5, HOUR))) return { ok: false, error: TOO_MANY };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  // Published cars only, so drafts and embargoed launches aren't revealed.
  const [car] = await db
    .select({ slug: cars.slug })
    .from(cars)
    .where(and(eq(cars.slug, parsed.data.carSlug), eq(cars.status, "published")));
  if (!car) return { ok: false, fieldErrors: { carSlug: "Choose your car" } };
  const user = await getSessionUser("customer");
  const id = `or-${Date.now().toString(36)}${randomInt(36 ** 3).toString(36)}`;
  // The confirmation is required above; the review row itself has no column for it.
  const { consent, ...review } = parsed.data;
  void consent;
  await db.insert(ownerReviews).values({ ...review, id, date: todayISO(), status: "pending", userId: user?.id ?? null });
  return { ok: true, id };
}
