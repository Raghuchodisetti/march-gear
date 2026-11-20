import type { Metadata } from "next";
import { requireStaff } from "@/server/auth";
import { CoversPage } from "@/components/admin/insurance/covers/covers-page";

export const metadata: Metadata = { title: "Coverage items" };

export default async function CoverageAdminPage({ searchParams }: PageProps<"/admin/insurance/coverage">) {
  await requireStaff();
  return <CoversPage type="coverage" searchParams={await searchParams} />;
}
