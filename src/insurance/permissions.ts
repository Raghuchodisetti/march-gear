import type { InsRole } from "@/db/enums";

/* What each person at an insurance vendor may do in the portal. Client-safe. */

export const INS_PERMISSIONS = {
  "dashboard.view": "See the dashboard",
  "profile.manage": "Edit the company profile and branches",
  "products.view": "See products, coverage and add-ons",
  "products.manage": "Create, edit and submit products, coverage and add-ons",
  "enquiries.view_all": "See every enquiry",
  "enquiries.view_own": "See enquiries assigned to them",
  "enquiries.manage": "Update enquiries, add notes and reminders",
  "enquiries.assign": "Assign enquiries to team members",
  "quotes.manage": "Create and send quotations",
  "renewals.manage": "Manage renewals",
  "campaigns.manage": "Create and submit promotional campaigns",
  "ads.manage": "Book advertising and upload creatives",
  "analytics.view": "See analytics and reports",
  "billing.manage": "See plans, invoices and payments",
  "team.manage": "Add and manage team members",
  "support.use": "Raise support tickets",
  "settings.manage": "Change company settings",
} as const;

export type InsPermission = keyof typeof INS_PERMISSIONS;
export const ALL_INS_PERMISSIONS = Object.keys(INS_PERMISSIONS) as InsPermission[];

const SALES: InsPermission[] = ["dashboard.view", "products.view", "enquiries.view_own", "enquiries.manage", "quotes.manage", "renewals.manage", "support.use"];

export const INS_ROLE_PERMISSIONS: Record<InsRole, InsPermission[]> = {
  owner: ALL_INS_PERMISSIONS,
  admin: ALL_INS_PERMISSIONS.filter((p) => p !== "billing.manage"),
  manager: [...SALES, "enquiries.view_all", "enquiries.assign", "analytics.view"],
  executive: SALES,
  marketing: ["dashboard.view", "products.view", "campaigns.manage", "ads.manage", "analytics.view", "support.use"],
  finance: ["dashboard.view", "billing.manage", "analytics.view", "support.use"],
};

/** A member's effective permissions: their custom list when set, otherwise their role's defaults. Owners always have everything. */
export function insPermissionsFor(member: { role: InsRole; permissions: string[] | null }): InsPermission[] {
  if (member.role === "owner") return ALL_INS_PERMISSIONS;
  const custom = member.permissions?.filter((p): p is InsPermission => p in INS_PERMISSIONS);
  return custom ?? INS_ROLE_PERMISSIONS[member.role];
}
