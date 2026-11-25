import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCatalog } from "@/server/catalog";
import { ListingHeader } from "@/components/listing/listing-header";
import { ListingSkeleton } from "@/components/listing/listing-skeleton";
import { NewCarsExplorer } from "@/components/listing/new-cars-explorer";
import { pageMetadata } from "@/components/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { cars, brands } = await getCatalog();
  return pageMetadata({
    title: "New Cars in India: Prices, Specs & Brands",
    description: `Browse ${cars.length} new cars from ${brands.length} brands on sale in India. Filter by budget, body type, fuel, gearbox and seats, with indicative ex-showroom prices.`,
    path: "/new-cars",
  });
}

export default async function NewCarsPage() {
  // Render per request so the filterable listing (it reads the URL's query) is server-rendered into the HTML, not a client-only skeleton.
  await connection();
  return (
    <Suspense fallback={<NewCarsFallback />}>
      <NewCarsExplorer />
    </Suspense>
  );
}

function NewCarsFallback() {
  return (
    <>
      <ListingHeader
        crumbs={[{ label: "New cars" }]}
        eyebrow="New cars"
        title="New cars"
        description="Every model on sale in India, by brand, with indicative ex-showroom prices, claimed efficiency and safety ratings."
      />
      <ListingSkeleton />
    </>
  );
}
