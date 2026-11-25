import { deskRedirect } from "@/server/auth";

/* Accounts are split by kind now: customers, dealer logins, vendor logins, and staff & access. */
export default async function UsersPage() {
  await deskRedirect("/admin/customers");
}
