import type { Metadata } from "next";
import { AccountDetail } from "@/components/admin/account-detail";

export const metadata: Metadata = { title: "Customer account" };

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  return <AccountDetail id={(await params).id} kinds={["customer"]} />;
}
