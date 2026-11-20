import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { and, eq, isNull, notInArray, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { insActivity, insApprovals, insNotifications } from "@/db/schema";
import type { InsApprovalTarget } from "@/db/enums";
import type { InsPermission } from "@/insurance/permissions";
import type { InsurerContext } from "./context";

/* Reference numbers, vendor notifications, the vendor activity log and the approval history. */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * e.g. insReference("PRD") → "PRD-7KQ2X9". Callers retry on a (very unlikely) duplicate.
 * INS vendor · PRD product · ENQ enquiry · QTE quote · REN renewal · CMP campaign · ADS ad campaign · ITK ticket.
 */
export const insReference = (prefix: "INS" | "PRD" | "ENQ" | "QTE" | "REN" | "CMP" | "ADS" | "ITK") =>
  `${prefix}-${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;

/** Unguessable token for a customer's quote link. */
export const shareToken = () => randomBytes(24).toString("base64url");

/** A notification in the vendor portal (bell + /insurance-vendor/notifications). `userId` null = everyone at the vendor. Never throws. */
export async function notifyInsurer(vendorId: number, n: { kind: string; title: string; body?: string; href?: string; userId?: number | null }) {
  try {
    await getDb()
      .insert(insNotifications)
      .values({ vendorId, userId: n.userId ?? null, kind: n.kind.slice(0, 40), title: n.title.slice(0, 200), body: n.body?.slice(0, 500) ?? null, href: n.href ?? null });
  } catch (err) {
    console.error("[insurance] notification failed", err);
  }
}

/** Company-wide notification kinds that need a permission to see (they name customers, money or work the person can't open). */
const NOTIFICATION_PERM: Record<string, InsPermission> = {
  enquiry: "enquiries.view_all",
  quote: "enquiries.view_all",
  conversion: "enquiries.view_all",
  billing: "billing.manage",
  advertising: "ads.manage",
  campaign: "campaigns.manage",
  product: "products.view",
  cover: "products.view",
  support: "support.use",
};

/** The notifications this person may see: those addressed to them, plus company-wide ones their permissions cover. */
export function insNotificationScope(ctx: Pick<InsurerContext, "vendor" | "user" | "can">): SQL {
  const hidden = Object.entries(NOTIFICATION_PERM)
    .filter(([, perm]) => !ctx.can(perm))
    .map(([kind]) => kind);
  return and(eq(insNotifications.vendorId, ctx.vendor.id), or(eq(insNotifications.userId, ctx.user.id), and(isNull(insNotifications.userId), hidden.length ? notInArray(insNotifications.kind, hidden) : undefined)))!;
}

/** The vendor's own activity log (/insurance-vendor/settings → activity). Never throws. */
export async function logInsurerActivity(vendorId: number, userId: number | null, action: string, entity: string, entityId: string | number | null, summary: string) {
  try {
    await getDb()
      .insert(insActivity)
      .values({ vendorId, userId, action: action.slice(0, 30), entity: entity.slice(0, 40), entityId: entityId === null ? null : String(entityId).slice(0, 64), summary: summary.slice(0, 300) });
  } catch (err) {
    console.error("[insurance] activity log failed", err);
  }
}

/**
 * One step in an approval workflow — shown to the vendor (except action "internal_note") and in the admin history.
 * Throws on failure: call it inside the same flow as the status change.
 */
export async function recordInsApproval(e: {
  vendorId: number;
  target: InsApprovalTarget;
  targetId?: number | null;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  remarks?: string | null;
  actorUserId: number | null;
  actorSide: "vendor" | "admin" | "system";
}) {
  await getDb()
    .insert(insApprovals)
    .values({
      vendorId: e.vendorId,
      target: e.target,
      targetId: e.targetId ?? null,
      action: e.action.slice(0, 30),
      fromStatus: e.fromStatus ?? null,
      toStatus: e.toStatus ?? null,
      remarks: e.remarks ?? null,
      actorUserId: e.actorUserId,
      actorSide: e.actorSide,
    });
}
