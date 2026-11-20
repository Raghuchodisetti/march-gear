import "server-only";
import { randomInt } from "node:crypto";
import { getDb } from "@/db";
import { partnerActivity, partnerApprovals, partnerNotifications } from "@/db/schema";
import type { ApprovalTarget } from "@/db/enums";

/* Reference numbers, notifications, the dealer activity log and the approval history. */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** e.g. reference("VEH") → "VEH-7KQ2X9". Callers retry on a (very unlikely) duplicate. */
export const reference = (prefix: "DLR" | "VEH" | "OFF" | "LD" | "TD" | "TKT") =>
  `${prefix}-${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;

/** A notification in the dealer portal (bell + /dealer/notifications). `userId` null = everyone at the dealership. */
export async function notifyPartner(partnerId: number, n: { kind: string; title: string; body?: string; href?: string; userId?: number | null }) {
  try {
    await getDb()
      .insert(partnerNotifications)
      .values({ partnerId, userId: n.userId ?? null, kind: n.kind, title: n.title.slice(0, 200), body: n.body?.slice(0, 500) ?? null, href: n.href ?? null });
  } catch (err) {
    console.error("[partner] notification failed", err);
  }
}

/** The dealership's own activity log (/dealer/settings → activity). Never throws. */
export async function logPartnerActivity(partnerId: number, userId: number | null, action: string, entity: string, entityId: string | number | null, summary: string) {
  try {
    await getDb()
      .insert(partnerActivity)
      .values({ partnerId, userId, action: action.slice(0, 30), entity: entity.slice(0, 40), entityId: entityId === null ? null : String(entityId).slice(0, 64), summary: summary.slice(0, 300) });
  } catch (err) {
    console.error("[partner] activity log failed", err);
  }
}

/** One step in an approval workflow — shown to the dealer and in /admin/approval-history. */
export async function recordApproval(e: {
  partnerId: number;
  target: ApprovalTarget;
  targetId?: number | null;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  remarks?: string | null;
  actorUserId: number | null;
  actorSide: "dealer" | "admin" | "system";
}) {
  await getDb()
    .insert(partnerApprovals)
    .values({
      partnerId: e.partnerId,
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
