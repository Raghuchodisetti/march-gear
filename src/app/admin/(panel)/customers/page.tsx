import type { Metadata } from "next";
import { AccountList } from "@/components/admin/account-list";

export const metadata: Metadata = { title: "Customer accounts" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  return <AccountList kind="customer" searchParams={await searchParams} />;
}
