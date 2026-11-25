import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CompareExperience } from "@/components/compare/compare-experience";
import { CompareSkeleton } from "@/components/compare/compare-skeleton";
import { pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Compare Cars Side by Side: Prices & Specs",
  description: "Compare up to four new cars on price, on-road cost, engine, efficiency, dimensions, safety and features, with every difference and best figure highlighted.",
  path: "/compare",
});

export default async function ComparePage() {
  // Render per request so the filterable listing (it reads the URL's query) is server-rendered into the HTML, not a client-only skeleton.
  await connection();
  return (
    <>
      <PageHeader
        crumbs={[{ label: "New cars", href: "/new-cars" }, { label: "Compare" }]}
        eyebrow="Compare"
        title={
          <>
            Side by side, <span className="type-editorial font-normal">spec by spec.</span>
          </>
        }
        description="Line up to four cars and let the numbers talk — price in your city, performance, running costs, space, safety and every feature, with the strongest figure in each row marked."
      />
      <Suspense fallback={<CompareSkeleton />}>
        <CompareExperience />
      </Suspense>
    </>
  );
}
