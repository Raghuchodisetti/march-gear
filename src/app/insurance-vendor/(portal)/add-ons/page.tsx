import type { Metadata } from "next";
import { requireInsurer } from "@/server/insurance/context";
import { CoverPage } from "@/components/insurance/vendor/covers/cover-page";

export const metadata: Metadata = { title: "Add-on covers" };

export default async function AddOnsPage(props: PageProps<"/insurance-vendor/add-ons">) {
  const ctx = await requireInsurer({ perm: "products.view", next: "/insurance-vendor/add-ons" });
  return <CoverPage ctx={ctx} type="addon" searchParams={await props.searchParams} />;
}
