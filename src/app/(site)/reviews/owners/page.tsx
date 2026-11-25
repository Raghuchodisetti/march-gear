import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCatalog } from "@/server/catalog";
import { IMG } from "@/data/images";
import { PageHeader } from "@/components/ui/page-header";
import { OwnerReviews, OwnerReviewsSkeleton } from "@/components/editorial/owner-reviews";
import type { CarOption } from "@/components/editorial/write-review-modal";
import { pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Owner Reviews: Real Owners Rate Their Cars",
  description: "Moderated reviews from car owners across India, with ratings for exterior, comfort, performance and value. Filter by model to read what owners say.",
  path: "/reviews/owners",
});

export default async function OwnerReviewsPage() {
  // Render per request so the filterable listing (it reads the URL's query) is server-rendered into the HTML, not a client-only skeleton.
  await connection();
  const { cars, brandName, ownerReviews } = await getCatalog();
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
