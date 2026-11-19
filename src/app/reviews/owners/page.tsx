import type { Metadata } from "next";
import { Suspense } from "react";
import { cars } from "@/data/cars";
import { brandName } from "@/data/brands";
import { ownerReviews } from "@/data/reviews";
import { IMG } from "@/data/images";
import { PageHeader } from "@/components/ui/page-header";
import { OwnerReviews, OwnerReviewsSkeleton } from "@/components/editorial/owner-reviews";
import type { CarOption } from "@/components/editorial/write-review-modal";

export const metadata: Metadata = {
  title: "Owner reviews",
  description:
    "Moderated reviews from real owners across India — ratings for exterior, comfort, performance and value, filterable by model.",
};

export default function OwnerReviewsPage() {
  const options: CarOption[] = cars
    .map((c) => ({
      value: c.slug,
      label: `${brandName(c.brand)} ${c.name}`,
      variants: [...new Set(c.variants.map((v) => v.name))],
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <>
      <PageHeader
        eyebrow="Owner reviews"
        title={
          <>
            Real owners. <span className="type-editorial">Real kilometres.</span>
          </>
        }
        description="Honest, moderated reviews from people who live with their cars every day — on fuel bills, service visits, comfort and the little things a test drive never reveals."
        crumbs={[{ label: "Reviews", href: "/reviews" }, { label: "Owner reviews" }]}
        image={IMG.wheelHands}
        imageFocus="50% 60%"
      />
      <div className="container-x pb-20 pt-6 md:pb-28 md:pt-8">
        <Suspense fallback={<OwnerReviewsSkeleton />}>
          <OwnerReviews reviews={ownerReviews} cars={options} />
        </Suspense>
      </div>
    </>
  );
}
