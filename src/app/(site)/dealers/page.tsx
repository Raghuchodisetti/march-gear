import type { Metadata } from "next";
import { Suspense } from "react";
import { getCatalog } from "@/server/catalog";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/section-heading";
import { DealerDirectory } from "@/components/dealer/dealer-directory";
import { EnquiryButton } from "@/components/used/enquiry-button";

export const metadata: Metadata = {
  title: "Car dealers & showrooms near you",
  description:
    "Find authorised and multi-brand car showrooms across India. Compare ratings, hours and services, then contact the dealer or book a visit.",
};

function DirectorySkeleton() {
  return (
    <div className="container-x pb-14 md:pb-20" aria-busy="true" aria-label="Loading dealers">
      <div className="grid grid-cols-1 gap-3 border-b border-line pb-6 md:grid-cols-[220px_minmax(0,1fr)_200px]">
        <div className="skeleton h-12" />
        <div className="skeleton h-12" />
        <div className="skeleton h-12" />
      </div>
      <div className="flex gap-2 py-5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,500px)]">
        <div className="space-y-5">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="grid grid-cols-1 border border-line sm:grid-cols-[220px_minmax(0,1fr)]">
              <div className="skeleton aspect-[16/10] sm:aspect-auto sm:min-h-[232px]" />
              <div className="space-y-3 p-6">
                <div className="skeleton h-3 w-32" />
                <div className="skeleton h-6 w-48" />
                <div className="skeleton h-3 w-40" />
                <div className="skeleton mt-8 h-9 w-56" />
              </div>
            </div>
          ))}
        </div>
        <div className="skeleton hidden aspect-square lg:block" />
      </div>
    </div>
  );
}

export default async function DealersPage() {
  const { dealers } = await getCatalog();
  const cities = new Set(dealers.map((d) => d.city)).size;
  const avg = dealers.reduce((sum, d) => sum + d.rating, 0) / dealers.length;
  const reviews = dealers.reduce((sum, d) => sum + d.reviewCount, 0);

  const stats = [
    { label: "Partner showrooms", value: String(dealers.length) },
    { label: "Cities", value: String(cities) },
    { label: "Average rating", value: avg.toFixed(1) },
    { label: "Customer reviews", value: reviews.toLocaleString("en-IN") },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Dealer network"
        title={
          <>
            Showrooms worth the <span className="type-editorial">visit</span>.
          </>
        }
        description="Authorised and specialist pre-owned dealers, audited by March Gear. Compare ratings, hours and services, then reach out in one tap."
        crumbs={[{ label: "Dealers" }]}
        className="border-b-0"
      >
        <dl className="grid max-w-3xl grid-cols-2 gap-y-6 border-t border-line pt-6 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse justify-end sm:border-l sm:border-line sm:pl-6 sm:first:border-l-0 sm:first:pl-0">
              <dt className="mt-1 text-[12.5px] text-muted">{s.label}</dt>
              <dd className="type-h3 num">{s.value}</dd>
            </div>
          ))}
        </dl>
      </PageHeader>

      <Suspense fallback={<DirectorySkeleton />}>
        <DealerDirectory />
      </Suspense>

      <section className="bg-ink text-white" aria-labelledby="dealer-cta-title">
        <div className="container-x grid grid-cols-1 gap-10 py-16 md:py-20 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <Eyebrow tone="light">Buying pre-owned?</Eyebrow>
            <h2 id="dealer-cta-title" className="type-h2 mt-5 max-w-2xl text-balance">
              Every partner car comes with a <span className="type-editorial">200-point</span> report.
            </h2>
          </div>
          <div className="flex flex-col gap-6 lg:col-span-5 lg:items-end">
            <p className="max-w-md text-[15px] leading-relaxed text-white/65 lg:text-right">
              Browse verified inventory from these showrooms, or let an advisor shortlist cars for you.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button href="/used-cars?verified=1" arrow>
                Verified used cars
              </Button>
              <EnquiryButton kind="callback" subject="Help me find a car" variant="outline-light">
                Talk to an advisor
              </EnquiryButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
