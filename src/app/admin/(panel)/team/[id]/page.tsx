import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth";
import { AccountDetail } from "@/components/admin/account-detail";

export const metadata: Metadata = { title: "Staff account" };

export default async function StaffAccountPage({ params }: PageProps<"/admin/team/[id]">) {
  await requireAdmin();
  return <AccountDetail id={(await params).id} kinds={["staff", "admin"]} />;
}
