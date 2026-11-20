import type { Metadata } from "next";
import { requireStaff } from "@/server/auth";
import { CoversPage } from "@/components/admin/insurance/covers/covers-page";

export const metadata: Metadata = { title: "Add-on covers" };

export default async function AddOnsAdminPage({ searchParams }: PageProps<"/admin/insurance/add-ons">) {
  await requireStaff();
  return <CoversPage type="addon" searchParams={await searchParams} />;
}
