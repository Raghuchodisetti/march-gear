/* Notification kinds are free text (each module picks its own) — these group them for filters and preferences. Client-safe. */

import type { Permission } from "@/partner/permissions";

export const NOTIFICATION_CATEGORIES = [
  { key: "enquiries", label: "Enquiries", match: /^(lead|enquir|crm|assign|follow)/ },
  { key: "test_drives", label: "Test drives", match: /^test.?drive/ },
  { key: "inventory", label: "Vehicles", match: /^(vehicle|inventory|listing|stock|used)/ },
  { key: "offers", label: "Offers & campaigns", match: /^(offer|campaign)/ },
  { key: "account", label: "Account & verification", match: /^(partner|application|approval|document|profile|brand|verification|kyc|staff|account|owner)/ },
  { key: "billing", label: "Billing", match: /^(invoice|payment|billing|plan|subscription)/ },
  { key: "support", label: "Support", match: /^(ticket|support)/ },
  { key: "reviews", label: "Reviews", match: /^review/ },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["key"] | "other";

export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  ...(Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c.key, c.label])) as Record<Exclude<NotificationCategory, "other">, string>),
  other: "Other",
};

export const ALL_CATEGORIES: NotificationCategory[] = [...NOTIFICATION_CATEGORIES.map((c) => c.key), "other"];

export function categoryOf(kind: string): NotificationCategory {
  const k = kind.toLowerCase();
  return NOTIFICATION_CATEGORIES.find((c) => c.match.test(k))?.key ?? "other";
}

/**
 * Dealership-wide notifications in these categories only reach people who can open what they link to — a sales
 * executive doesn't get billing updates or unassigned website enquiries. Personal notifications always show.
 */
const CATEGORY_NEEDS: Partial<Record<NotificationCategory, Permission[]>> = {
  enquiries: ["leads.view_all"],
  test_drives: ["leads.view_all"],
  inventory: ["inventory.view"],
  offers: ["offers.view"],
  billing: ["billing.manage"],
  support: ["support.use"],
  reviews: ["reviews.reply"],
};

export function notificationVisible(n: { kind: string; userId: number | null }, can: (p: Permission) => boolean) {
  if (n.userId !== null) return true;
  const needs = CATEGORY_NEEDS[categoryOf(n.kind)];
  return !needs || needs.some(can);
}

/** Per-person notification preferences, kept in users.preferences.dealer. */
export interface DealerNotificationPrefs {
  /** Categories hidden from the notifications list (they still count as unread until read). */
  muted: NotificationCategory[];
}

export const DEFAULT_DEALER_PREFS: DealerNotificationPrefs = { muted: [] };
/** Account & verification updates can't be muted — they can affect whether the dealership stays live. */
export const UNMUTABLE: NotificationCategory[] = ["account"];
