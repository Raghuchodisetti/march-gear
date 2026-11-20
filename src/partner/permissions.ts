import type { PartnerRole } from "@/db/enums";

/* What each person at a dealership may do in the portal. Client-safe. */

export const PERMISSIONS = {
  "dashboard.view": "See the dashboard",
  "profile.manage": "Edit the dealership profile and showrooms",
  "brands.manage": "Manage brand authorisations and models",
  "inventory.view": "See inventory",
  "inventory.manage": "Add, edit and submit vehicles",
  "offers.view": "See offers and campaigns",
  "offers.manage": "Create, edit and submit offers",
  "leads.view_all": "See every enquiry",
  "leads.view_own": "See enquiries assigned to them",
  "leads.manage": "Update enquiries, add notes and reminders",
  "leads.assign": "Assign enquiries to staff",
  "test_drives.manage": "Manage test drives",
  "customers.view": "See customers",
  "reviews.reply": "Reply to reviews",
  "media.manage": "Upload and manage media",
  "analytics.view": "See analytics and reports",
  "staff.manage": "Add and manage staff",
  "billing.manage": "See plans, invoices and payments",
  "support.use": "Raise support tickets",
  "settings.manage": "Change dealership settings",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

const SALES: Permission[] = ["dashboard.view", "leads.view_own", "leads.manage", "test_drives.manage", "customers.view", "inventory.view", "offers.view", "support.use"];

export const ROLE_PERMISSIONS: Record<PartnerRole, Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter((p) => p !== "billing.manage"),
  sales_manager: [...SALES, "leads.view_all", "leads.assign", "analytics.view", "reviews.reply"],
  sales_executive: SALES,
  inventory_manager: ["dashboard.view", "inventory.view", "inventory.manage", "brands.manage", "media.manage", "offers.view", "support.use"],
  marketing_manager: ["dashboard.view", "offers.view", "offers.manage", "media.manage", "analytics.view", "inventory.view", "reviews.reply", "support.use"],
};

/** A member's effective permissions: their custom list when set, otherwise their role's defaults. Owners always have everything. */
export function permissionsFor(member: { role: PartnerRole; permissions: string[] | null }): Permission[] {
  if (member.role === "owner") return ALL_PERMISSIONS;
  const custom = member.permissions?.filter((p): p is Permission => p in PERMISSIONS);
  return custom ?? ROLE_PERMISSIONS[member.role];
}

export const can = (member: { role: PartnerRole; permissions: string[] | null }, perm: Permission) => permissionsFor(member).includes(perm);
