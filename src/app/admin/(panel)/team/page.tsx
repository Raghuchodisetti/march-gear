import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth";
import { AccountList } from "@/components/admin/account-list";

export const metadata: Metadata = { title: "Staff & access" };

export default async function TeamPage({ searchParams }: PageProps<"/admin/team">) {
  await requireAdmin();
  return <AccountList kind="team" searchParams={await searchParams} />;
}
