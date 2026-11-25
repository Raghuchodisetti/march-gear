import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCatalog } from "@/server/catalog";
import { IMG } from "@/data/images";
import { formatMonth } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Counter } from "@/components/ui/reveal";
import { Eyebrow } from "@/components/ui/section-heading";
import { ListingSkeleton } from "@/components/listing/listing-skeleton";
import { UpcomingTimeline } from "./_components/upcoming-timeline";
import { pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Upcoming Cars in India: Launch Calendar",
  description: "Expected car launches in India, month by month: teaser images, indicative prices and the highlights that matter. Set a launch alert for the cars you want.",
  path: "/upcoming-cars",
});

export default async function UpcomingCarsPage() {
  // Render per request so the filterable listing (it reads the URL's query) is server-rendered into the HTML, not a client-only skeleton.
  await connection();
  const { upcoming: upcomingCars } = await getCatalog();
  const months = Array.from(new Set(upcomingCars.map((c) => c.expectedLaunch))).sort();
  const electricCount = upcomingCars.filter((c) => c.fuel === "Electric").length;
  const brandCount = new Set(upcomingCars.map((c) => c.brand)).size;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "New cars", href: "/new-cars" }, { label: "Upcoming cars" }]}
        eyebrow="Launch calendar"
        title={
          <>
            What&rsquo;s coming, <span className="type-editorial font-normal">and when.</span>
          </>
        }
        description={`Expected launches from ${formatMonth(months[0])} to ${formatMonth(months[months.length - 1])}. Dates and prices are indicative mock data — set an alert and we'll tell you when it's official.`}
        image={IMG.monoSupercar}
        imageFocus="50% 50%"
      >
        <dl className="grid max-w-2xl grid-cols-3 border-t border-white/15">
          {[
            { label: "Expected launches", value: upcomingCars.length },
            { label: "Fully electric", value: electricCount },
            { label: "Brands", value: brandCount },
          ].map((s) => (
            <div key={s.label} className="border-l border-white/15 py-5 pl-4 first:border-l-0 first:pl-0 sm:pl-6">
              <dt className="text-[12px] text-white/55">{s.label}</dt>
              <dd className="mt-1.5 font-display text-[30px] font-semibold leading-none tracking-[-0.035em] num md:text-[40px]">
                <Counter to={s.value} />
              </dd>
            </div>
          ))}
        </dl>
      </PageHeader>

      <Suspense fallback={<ListingSkeleton cards={3} variant="row" />}>
        <UpcomingTimeline />
      </Suspense>

      <section className="border-t border-line bg-mist">
        <div className="container-x grid grid-cols-1 gap-8 py-14 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:py-20">
          <div>
            <Eyebrow>Can&rsquo;t wait?</Eyebrow>
            <h2 className="type-h2 mt-5 max-w-2xl text-balance">The newest cars you can drive home today.</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href="/new-cars?sort=latest" arrow>
              Latest launches
            </Button>
            <Button href="/electric-cars" variant="outline">
              Electric cars on sale
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
