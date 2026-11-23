import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { customerNotifications } from "@/db/schema";
import { notifyCustomer, type CustomerNotificationKind } from "@/server/customer/notify";

/* ──────────────────────────────────────────────────────────────
   Reading a customer's notifications (/account/notifications, the
   overview and the account sidebar badge). Rows are written with
   notifyCustomer() in src/server/customer/notify.ts. Every query is
   scoped to the customer's own user id.
   ────────────────────────────────────────────────────────────── */

export interface CustomerNotification {
  id: number;
  kind: CustomerNotificationKind | (string & {});
  title: string;
  body: string | null;
  /** Only ever a path on this site (anything else is dropped). */
  href: string | null;
  /** ISO */
  createdAt: string;
  read: boolean;
}

/** Notifications link inside the site only — never to an external URL. */
export const safeHref = (h: string | null | undefined) => (h && h.startsWith("/") && !h.startsWith("//") && !h.startsWith("/\\") ? h : null);

const mine = (userId: number, unreadOnly?: boolean) =>
  unreadOnly ? and(eq(customerNotifications.userId, userId), isNull(customerNotifications.readAt)) : eq(customerNotifications.userId, userId);

/** Newest first. `offset` is for pagination. */
export async function getCustomerNotifications(userId: number, opts: { limit?: number; unreadOnly?: boolean; offset?: number } = {}): Promise<CustomerNotification[]> {
  const rows = await getDb()
    .select()
    .from(customerNotifications)
    .where(mine(userId, opts.unreadOnly))
    .orderBy(desc(customerNotifications.createdAt), desc(customerNotifications.id))
    .limit(Math.min(Math.max(1, opts.limit ?? 20), 200))
    .offset(Math.max(0, opts.offset ?? 0));
  return rows.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, href: safeHref(n.href), createdAt: n.createdAt.toISOString(), read: Boolean(n.readAt) }));
}

export async function countUnreadCustomerNotifications(userId: number): Promise<number> {
  const [{ n }] = await getDb().select({ n: count() }).from(customerNotifications).where(mine(userId, true));
  return Number(n);
}

/** All of the customer's notifications (or just the unread ones), for pagination. */
export async function countCustomerNotifications(userId: number, opts: { unreadOnly?: boolean } = {}): Promise<number> {
  const [{ n }] = await getDb().select({ n: count() }).from(customerNotifications).where(mine(userId, opts.unreadOnly));
  return Number(n);
}

/* ── Insurance and review updates (called by the vendor and admin actions) ── */

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const day = (iso: string) => {
  const d = new Date(`${iso}T12:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
};

/** An insurance vendor sent a quote on the customer's enquiry. Says whether it's indicative or insurer-authorised. */
export async function notifyCustomerOfQuote(n: {
  userId: number | null;
  vendorName: string;
  car: string | null;
  quote: { reference: string; total: number; authorization: "indicative" | "insurer_authorised"; insurerQuoteRef: string | null; validUntil: string };
  token: string;
}) {
  const q = n.quote;
  const label =
    q.authorization === "insurer_authorised"
      ? `Insurer-authorised quotation${q.insurerQuoteRef ? ` (insurer ref ${q.insurerQuoteRef})` : ""} · ${rupees(q.total)}`
      : `Indicative quote · ${rupees(q.total)} — an estimate, not an insurer quotation; the insurer sets the final premium`;
  await notifyCustomer(n.userId, {
    kind: "insurance",
    title: `New insurance quote from ${n.vendorName}`,
    body: `${n.car ? `${n.car} · ` : ""}${label}. Valid until ${day(q.validUntil)} · ${q.reference}.`,
    href: `/insurance/quote/${encodeURIComponent(n.token)}`,
  });
}

/** The vendor reported that the customer's policy was issued (MarchGear verifies conversions separately). */
export async function notifyCustomerOfPolicyIssued(n: { userId: number | null; vendorName: string; car: string | null; issuedOn: string }) {
  await notifyCustomer(n.userId, {
    kind: "insurance",
    title: "Policy reported as issued",
    body: `${n.vendorName} reported that your ${n.car ? `${n.car} ` : ""}policy was issued on ${day(n.issuedOn)}. This is reported by the insurer and not yet verified by MarchGear — your policy documents come from the insurer.`,
    href: "/account/insurance",
  });
}

/** MarchGear staff published or declined an owner review the customer wrote. */
export async function notifyCustomerOfReviewDecision(n: { userId: number | null; title: string; car: string | null; status: "approved" | "rejected" }) {
  const on = n.car ? ` on the ${n.car}` : "";
  await notifyCustomer(
    n.userId,
    n.status === "approved"
      ? { kind: "review", title: "Your review is live", body: `“${n.title}”${on} is now published. Thanks for helping other buyers.`, href: "/account/reviews" }
      : { kind: "review", title: "Your review wasn't published", body: `“${n.title}”${on} didn't meet our review guidelines, so it isn't shown on the site. You're welcome to write a new one.`, href: "/account/reviews" },
  );
}
