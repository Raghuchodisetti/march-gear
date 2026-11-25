import { deskRedirect, requireStaff } from "@/server/auth";

/** /admin/insurance → the insurance dashboard (on this desk). */
export default async function InsuranceAdminIndex() {
  await requireStaff("insurance");
  await deskRedirect("/admin/insurance/dashboard");
}
