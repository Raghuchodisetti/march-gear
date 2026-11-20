import type { Metadata } from "next";
import { requireInsurer } from "@/server/insurance/context";
import { CoverPage } from "@/components/insurance/vendor/covers/cover-page";

export const metadata: Metadata = { title: "Coverage" };

export default async function CoveragePage(props: PageProps<"/insurance-vendor/coverage">) {
  const ctx = await requireInsurer({ perm: "products.view", next: "/insurance-vendor/coverage" });
  return <CoverPage ctx={ctx} type="coverage" searchParams={await props.searchParams} />;
}
