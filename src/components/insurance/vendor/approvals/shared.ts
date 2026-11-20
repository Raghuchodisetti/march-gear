import type { InsCoverStatus, InsProductStatus } from "@/db/enums";
import { INS_COVER_STATUS_LABEL, INS_PRODUCT_STATUS_LABEL, type Tone } from "@/insurance/labels";

/* ──────────────────────────────────────────────────────────────
   The approval history as the vendor sees it (products and covers).
   Rows come from ins_approvals — never with action "internal_note".
   Client-safe.
   ────────────────────────────────────────────────────────────── */

export interface HistoryEntry {
  id: number;
  target: "product" | "cover";
  targetId: number | null;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  remarks: string | null;
  actorSide: "vendor" | "admin" | "system";
  actorName: string | null;
  createdAt: string;
}

const LABEL: Record<string, string> = {
  submitted: "Submitted for approval",
  resubmitted: "Resubmitted for approval",
  withdrawn: "Withdrawn from review",
  edited: "Edited after approval",
  archived: "Archived to draft",
  approved: "Approved",
  approved_published: "Approved and published",
  published: "Published",
  unpublished: "Unpublished",
  rejected: "Rejected",
  changes_requested: "Changes requested",
  suspended: "Suspended",
  reactivated: "Reactivated",
  duplicated: "Created as a copy",
};

export const historyLabel = (action: string) => LABEL[action] ?? action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function historyTone(action: string): Tone {
  if (/^(approved|approved_published|published|reactivated)$/.test(action)) return "green";
  if (/^(rejected|suspended)$/.test(action)) return "red";
  if (action === "changes_requested") return "amber";
  if (/^(submitted|resubmitted)$/.test(action)) return "blue";
  return "neutral";
}

/** A status label for either workflow (history rows store plain strings). */
export function statusText(target: "product" | "cover", s: string | null) {
  if (!s) return null;
  if (target === "product") return s in INS_PRODUCT_STATUS_LABEL ? INS_PRODUCT_STATUS_LABEL[s as InsProductStatus] : s;
  return s in INS_COVER_STATUS_LABEL ? INS_COVER_STATUS_LABEL[s as InsCoverStatus] : s;
}

/** "3 h", "2 days" since a date — for "waiting" figures. */
export function waitingFor(since: string | Date | null, now = Date.now()) {
  if (!since) return "";
  const h = Math.max(0, Math.round((now - new Date(since).getTime()) / 3_600_000));
  if (h < 1) return "under an hour";
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}
