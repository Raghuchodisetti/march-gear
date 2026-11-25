import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCatalog } from "@/server/catalog";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { NewsHub, NewsHubSkeleton } from "@/components/editorial/news-hub";
import { pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Car News: Launches, Reviews & Buying Advice",
  description: "The latest car launches in India, honest reviews and first drives, electric car news and practical buying advice from the MarchGear newsroom.",
  path: "/news",
});

export default async function NewsPage() {
  // Render per request so the filterable listing (it reads the URL's query) is server-rendered into the HTML, not a client-only skeleton.
  await connection();
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
