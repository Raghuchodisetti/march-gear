import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CompareExperience } from "@/components/compare/compare-experience";
import { CompareSkeleton } from "@/components/compare/compare-skeleton";

export const metadata: Metadata = {
  title: "Compare cars side by side",
  description:
    "Compare up to four new cars on price, on-road cost, engine, efficiency, dimensions, safety and features — with differences highlighted and the best figure in every row flagged.",
};

export default function ComparePage() {
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
