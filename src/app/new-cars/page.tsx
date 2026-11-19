import type { Metadata } from "next";
import { Suspense } from "react";
import { cars } from "@/data/cars";
import { ListingHeader } from "@/components/listing/listing-header";
import { ListingSkeleton } from "@/components/listing/listing-skeleton";
import { NewCarsExplorer } from "@/components/listing/new-cars-explorer";

export const metadata: Metadata = {
  title: "New cars in India — prices, specs & comparisons",
  description: `Browse ${cars.length} new cars on sale in India. Filter by budget, body type, fuel, transmission, brand and seating, with indicative ex-showroom prices.`,
};

export default function NewCarsPage() {
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
