import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCatalog } from "@/server/catalog";
import { formatPrice } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { UsedListing } from "@/components/used/used-listing";
import { SellBanner, UsedListingSkeleton, VerifiedStrip } from "@/components/used/listing-sections";
import { pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Used Cars for Sale: Inspected & Fairly Priced",
  description: "Browse pre-owned cars across India with 200-point inspection reports, a fair-price check and transparent EMI estimates. Filter by city, budget and body type.",
  path: "/used-cars",
});

export default async function UsedCarsPage() {
  // Render per request so the filterable listing (it reads the URL's query) is server-rendered into the HTML, not a client-only skeleton.
  await connection();
  const { usedCars } = await getCatalog();
  const verified = usedCars.filter((c) => c.verified).length;
  const cities = new Set(usedCars.map((c) => c.city)).size;
  const from = Math.min(...usedCars.map((c) => c.price));

  const stats = [
    { label: "Cars listed", value: String(usedCars.length) },
    { label: "Verified", value: String(verified) },
    { label: "Cities", value: String(cities) },
    { label: "Starting at", value: formatPrice(from) },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Pre-owned"
        title={
          <>
            Used cars, <span className="type-editorial">properly</span> inspected.
          </>
        }
        description="Every listing carries a condition report, a fair-price check and an honest EMI estimate — so the only surprise is how good it drives."
        crumbs={[{ label: "Used Cars" }]}
        className="border-b-0"
      >
        <dl className="grid max-w-3xl grid-cols-2 gap-y-6 border-t border-line pt-6 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse justify-end border-line sm:border-l sm:pl-6 sm:first:border-l-0 sm:first:pl-0">
              <dt className="mt-1 text-[12.5px] text-muted">{s.label}</dt>
              <dd className="type-h3 num">{s.value}</dd>
            </div>
          ))}
        </dl>
      </PageHeader>

      <VerifiedStrip />

      <Suspense fallback={<UsedListingSkeleton />}>
        <UsedListing />
      </Suspense>

      <SellBanner />
    </>
  );
}
