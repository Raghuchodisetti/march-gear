"use server";

import { randomInt } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/db";
import { leads, type LeadType } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { getSessionUser } from "@/server/auth";
import { HOUR, allowFromIp, take } from "@/server/rate-limit";
import { isDuplicate } from "@/server/db-errors";
import { email, invalid, isoDate, mobile, name, optionalText, todayISO } from "@/server/validation";
import { CALL_TIMES, CALL_TIME_LABEL, CAR_WHERE, CAR_WHERE_LABEL, CLAIM_KINDS, CLAIM_KIND_LABEL, HELP_TOPICS, HELP_TOPIC_LABEL } from "@/components/insurance/public/lead-options";

/* ──────────────────────────────────────────────────────────────
   Callback requests from the public insurance pages. Both land in
   the `leads` table for the staff admin (/admin/leads):

   - insurance_claim : "help me with a claim" (/insurance/claims)
   - insurance_help  : "talk to an expert" (/insurance and the
                       category pages)

   MarchGear doesn't file or settle claims — these are callbacks
   to explain the process, nothing more.
   ────────────────────────────────────────────────────────────── */

const TOO_MANY = "Too many requests from your network. Please try again in a little while.";


const place = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^[\p{L}\p{M} .'()&-]{2,64}$/u.test(v), "Enter a valid city name");

const optionalEmail = z
  .union([z.literal(""), email])
  .optional()
  .transform((v) => (v ? v : undefined));

const common = {
  name,
  phone: mobile,
  email: optionalEmail,
  city: place,
  message: optionalText(2000),
  source: optionalText(200),
  consent: z.literal(true, { error: "Please agree to be contacted about your request" }),
  /** Honeypot — real people never fill this in; filled-in submissions are silently dropped. */
  website: z.string().max(500).optional(),
};

const insuranceLeadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("insurance_claim"),
    ...common,
    details: z.object({
      kind: z.enum(CLAIM_KINDS, { error: "Choose what happened" }),
      where: z.enum(CAR_WHERE, { error: "Tell us where the car is now" }),
      incidentDate: isoDate.refine((d) => d <= todayISO(), "The date can't be in the future"),
      insurer: optionalText(120),
      policyNumber: optionalText(60),
      informedInsurer: z.boolean(),
    }),
  }),
  z.object({
    type: z.literal("insurance_help"),
    ...common,
    details: z.object({
      topic: z.enum(HELP_TOPICS, { error: "Choose what you'd like help with" }),
      callTime: z.enum(CALL_TIMES, { error: "Choose a time" }),
      car: optionalText(160),
    }),
  }),
]);

export type InsuranceLeadInput = z.input<typeof insuranceLeadSchema>;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const reference = () => `MG-${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;

export async function submitInsuranceLeadAction(input: InsuranceLeadInput): Promise<ActionResult<{ reference: string }>> {
  if (!(await allowFromIp("insurance-lead", 10, HOUR))) return { ok: false, error: TOO_MANY };
  const parsed = insuranceLeadSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { website, consent, ...lead } = parsed.data;
  void consent;
  // Bots get a convincing success and nothing is stored.
  if (website) return { ok: true, reference: reference() };
  // Per-number limit too (the IP limit is a no-op where the client IP can't be trusted).
  if (!take(`insurance-lead:${lead.phone}`, 5, HOUR)) return { ok: false, error: "You've sent several requests already — we'll be in touch soon." };

  // Stored with readable labels — the admin shows `details` as "Key: value" rows.
  let subject: string;
  let details: Record<string, string | number | boolean | null>;
  if (lead.type === "insurance_claim") {
    const d = lead.details;
    subject = `Claim help — ${CLAIM_KIND_LABEL[d.kind]}`;
    details = {
      whatHappened: CLAIM_KIND_LABEL[d.kind],
      carIsNow: CAR_WHERE_LABEL[d.where],
      incidentDate: d.incidentDate,
      insurer: d.insurer ?? null,
      policyNumber: d.policyNumber ?? null,
      informedInsurer: d.informedInsurer,
    };
  } else {
    const d = lead.details;
    subject = `Insurance help — ${HELP_TOPIC_LABEL[d.topic]}`;
    details = { topic: HELP_TOPIC_LABEL[d.topic], bestTimeToCall: CALL_TIME_LABEL[d.callTime], car: d.car ?? null };
  }

  const user = await getSessionUser("customer");
  const db = getDb();
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = reference();
    try {
      await db.insert(leads).values({
        type: lead.type as LeadType,
        reference: ref,
        name: lead.name,
        email: lead.email ?? user?.email ?? null,
        phone: lead.phone,
        city: lead.city ?? null,
        subject,
        message: lead.message ?? null,
        source: lead.source ?? null,
        details,
        userId: user?.id ?? null,
      });
      return { ok: true, reference: ref };
    } catch (err) {
      // Retry only on a (very unlikely) duplicate reference.
      if (!isDuplicate(err)) throw err;
    }
  }
  return { ok: false, error: "Something went wrong. Please try again." };
}
