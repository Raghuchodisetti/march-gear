import type { Metadata } from "next";
import { Suspense } from "react";
import { getCatalog } from "@/server/catalog";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { NewsHub, NewsHubSkeleton } from "@/components/editorial/news-hub";

export const metadata: Metadata = {
  title: "Car News & Reviews",
  description: "The latest car launches, honest reviews, test drives, electric car news and buying tips — explained simply.",
};

export default async function NewsPage() {
  const cat = await getCatalog();
  return (
    <>
      <section className="border-b border-line">
        <div className="container-x pb-10 pt-8 md:pb-12 md:pt-10">
          <Breadcrumbs items={[{ label: "News & Media" }]} />
          <div className="mt-10 max-w-3xl animate-rise md:mt-14">
            <h1 className="type-h1 text-balance">Car news & reviews</h1>
            <p className="type-lead mt-5 text-muted">
              The latest launches, honest reviews, test drives and money-saving tips — explained in simple words. Pick a topic or search for a car.
            </p>
          </div>
        </div>
      </section>

      <Suspense fallback={<NewsHubSkeleton />}>
        <NewsHub stories={cat.articles} />
      </Suspense>
    </>
  );
}
