import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customerNotifications, leads, partnerLeads, users } from "@/db/schema";

/* ──────────────────────────────────────────────────────────────
   Notifications for website customers (/account/notifications).
   Dealers, insurers and MarchGear staff call these when something
   happens on a customer's request. Customers only ever see their
   own rows, and never anyone's internal notes.
   ────────────────────────────────────────────────────────────── */

export const CUSTOMER_NOTIFICATION_KINDS = ["enquiry", "test_drive", "insurance", "review", "account", "reminder"] as const;
export type CustomerNotificationKind = (typeof CUSTOMER_NOTIFICATION_KINDS)[number];

/** Tells a customer about something. No-op without a user (e.g. a guest request). Never throws. */
export async function notifyCustomer(userId: number | null | undefined, n: { kind: CustomerNotificationKind; title: string; body?: string; href?: string }) {
  if (!userId) return;
  try {
    const db = getDb();
    // Only real customer accounts get customer notifications.
    const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (u?.role !== "customer") return;
    await db.insert(customerNotifications).values({ userId, kind: n.kind, title: n.title.slice(0, 200), body: n.body?.slice(0, 500) ?? null, href: n.href?.slice(0, 300) ?? null });
  } catch (err) {
    console.error("[customer] notification failed", err);
  }
}

/** The customer account behind a website lead, if it was made while signed in. */
export async function customerOfSiteLead(siteLeadId: number | null | undefined): Promise<number | null> {
  if (!siteLeadId) return null;
  const [r] = await getDb().select({ userId: leads.userId }).from(leads).where(eq(leads.id, siteLeadId));
  return r?.userId ?? null;
}

/** The customer account behind a dealer CRM enquiry (via the website lead it came from), if any. */
export async function customerOfPartnerLead(partnerLeadId: number | null | undefined): Promise<number | null> {
  if (!partnerLeadId) return null;
  const [r] = await getDb()
    .select({ userId: leads.userId })
    .from(partnerLeads)
    .innerJoin(leads, eq(leads.id, partnerLeads.siteLeadId))
    .where(eq(partnerLeads.id, partnerLeadId));
  return r?.userId ?? null;
}
