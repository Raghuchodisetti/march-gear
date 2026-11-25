import type { UserRole } from "@/db/enums";
import type { Access } from "@/lib/staff-access";

/* Each kind of account is managed in its own place in the back office, by whoever has that section:
   customers under Customers, dealer logins under Dealer partners, insurance vendor logins under Insurance,
   and staff and admins under Staff & access (admins only). */

export const ACCOUNT_KINDS: Record<UserRole, { label: string; list: string; listLabel: string; access: Access }> = {
  customer: { label: "Customer", list: "/admin/customers", listLabel: "Customer accounts", access: "customers" },
  dealer: { label: "Dealer partner", list: "/admin/dealer-accounts", listLabel: "Dealer logins", access: "dealers" },
  insurer: { label: "Insurance vendor", list: "/admin/insurance/accounts", listLabel: "Vendor logins", access: "insurance" },
  staff: { label: "Staff", list: "/admin/team", listLabel: "Staff & access", access: "admin" },
  admin: { label: "Admin", list: "/admin/team", listLabel: "Staff & access", access: "admin" },
};

/** An account's page in the back office (/admin/… — links follow the desk). */
export const accountHref = (role: UserRole, id: number) => `${ACCOUNT_KINDS[role].list}/${id}`;
