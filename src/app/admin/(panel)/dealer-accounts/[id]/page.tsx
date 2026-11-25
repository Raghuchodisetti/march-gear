import type { Metadata } from "next";
import { AccountDetail } from "@/components/admin/account-detail";

export const metadata: Metadata = { title: "Dealer login" };

export default async function DealerAccountPage({ params }: PageProps<"/admin/dealer-accounts/[id]">) {
  return <AccountDetail id={(await params).id} kinds={["dealer"]} />;
}
