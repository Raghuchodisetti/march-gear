"use server";

import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { leads, users, type LeadStatus, type LeadType } from "@/db/schema";
import { DEFAULT_PREFERENCES, type ActionResult, type UserPreferences } from "@/lib/action-result";
import { getSessionUser } from "@/server/auth";

export interface MyRequest {
  reference: string;
  type: LeadType;
  status: LeadStatus;
  subject: string | null;
  carSlug: string | null;
  usedCarId: string | null;
  dealerId: string | null;
  details: Record<string, string | number | boolean | null> | null;
  createdAt: string;
}

/** The signed-in customer's enquiries and bookings, newest first. */
export async function myRequestsAction(): Promise<ActionResult<{ requests: MyRequest[] }>> {
  const me = await getSessionUser();
  if (!me) return { ok: false, error: "Please sign in again." };
  const rows = await getDb()
    .select({
      reference: leads.reference,
      type: leads.type,
      status: leads.status,
      subject: leads.subject,
      carSlug: leads.carSlug,
      usedCarId: leads.usedCarId,
      dealerId: leads.dealerId,
      details: leads.details,
      createdAt: leads.createdAt,
    })
    .from(leads)
    // Only requests made while signed in — emails aren't verified, so matching by email would leak other people's requests.
    .where(eq(leads.userId, me.id))
    .orderBy(desc(leads.createdAt))
    .limit(50);
  return { ok: true, requests: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) };
}

/* ── Preferences ────────────────────────────────────────────── */

const preferencesSchema = z.object({
  alerts: z.object({ price: z.boolean(), launch: z.boolean(), digest: z.boolean(), whatsapp: z.boolean() }),
  contact: z.enum(["call", "whatsapp", "email"]),
});

export async function myPreferencesAction(): Promise<ActionResult<{ preferences: UserPreferences }>> {
  const me = await getSessionUser();
  if (!me) return { ok: false, error: "Please sign in again." };
  const [row] = await getDb().select({ preferences: users.preferences }).from(users).where(eq(users.id, me.id));
  return { ok: true, preferences: row?.preferences ?? DEFAULT_PREFERENCES };
}

export async function savePreferencesAction(input: unknown): Promise<ActionResult> {
  const me = await getSessionUser();
  if (!me) return { ok: false, error: "Please sign in again." };
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid preferences" };
  await getDb().update(users).set({ preferences: parsed.data }).where(eq(users.id, me.id));
  return { ok: true };
}
