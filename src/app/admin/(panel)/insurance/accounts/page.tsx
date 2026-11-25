import type { Metadata } from "next";
import { AccountList } from "@/components/admin/account-list";

export const metadata: Metadata = { title: "Vendor logins" };

export default async function VendorAccountsPage({ searchParams }: PageProps<"/admin/insurance/accounts">) {
  return <AccountList kind="insurer" searchParams={await searchParams} />;
}
