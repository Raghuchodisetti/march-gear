import { redirect } from "next/navigation";
import { requireStaff } from "@/server/auth";

/** /admin/insurance → the insurance dashboard. */
export default async function InsuranceAdminIndex() {
  await requireStaff();
  redirect("/admin/insurance/dashboard");
}
