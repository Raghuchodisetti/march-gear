import type { Metadata } from "next";
import { AccountDetail } from "@/components/admin/account-detail";

export const metadata: Metadata = { title: "Vendor login" };

export default async function VendorAccountPage({ params }: PageProps<"/admin/insurance/accounts/[id]">) {
  return <AccountDetail id={(await params).id} kinds={["insurer"]} />;
}
