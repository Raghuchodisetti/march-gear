import type { Metadata } from "next";
import { AccountList } from "@/components/admin/account-list";

export const metadata: Metadata = { title: "Dealer logins" };

export default async function DealerAccountsPage({ searchParams }: PageProps<"/admin/dealer-accounts">) {
  return <AccountList kind="dealer" searchParams={await searchParams} />;
}
