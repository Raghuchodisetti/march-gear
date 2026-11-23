import type { Metadata } from "next";
import { CheckCircle2, Clock3, PenLine, ThumbsUp } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { getGarageModels, getMyReviews } from "@/server/customer/account";
import { PortalHeader } from "@/components/portal/ui";
import { PageTabs } from "@/components/portal/profile/kit";
import { MiniStat } from "@/components/portal/dashboard/sections";
import { Button } from "@/components/ui/button";
import type { CarOption } from "@/components/editorial/write-review-modal";
import { ReviewList } from "@/components/customer/reviews/review-list";
import { WriteReviewButton } from "@/components/customer/reviews/write-review";

export const metadata: Metadata = { title: "My reviews" };

export default async function MyReviewsPage(props: PageProps<"/account/reviews">) {
  const user = await requireUser("/account/reviews");
  const sp = await props.searchParams;
  const [reviews, garage, cat] = await Promise.all([getMyReviews(user.id), getGarageModels(user.id), getCatalog()]);

  // Same car list as the public owner-reviews page: published models with their variants.
  const options: CarOption[] = cat.cars
    .map((c) => ({ value: c.slug, label: `${cat.brandName(c.brand)} ${c.name}`, variants: [...new Set(c.variants.map((v) => v.name))] }))
    .sort((a, b) => a.label.localeCompare(b.label));
  // Cars in their garage that are in the catalogue and not reviewed yet.
  const reviewed = new Set(reviews.map((r) => r.carSlug));
  const toReview = garage.filter((g) => cat.getCar(g.model) && !reviewed.has(g.model)).slice(0, 3);

  const published = reviews.filter((r) => r.status === "approved");
  const pending = reviews.filter((r) => r.status === "pending");
  const rejected = reviews.filter((r) => r.status === "rejected");
  const helpful = published.reduce((n, r) => n + r.helpful, 0);

  return (
    <>
      <PortalHeader
        title="My reviews"
        description="Owner reviews you've written while signed in, and where each one is in moderation."
        actions={reviews.length ? <WriteReviewButton cars={options} /> : undefined}
      />

      {toReview.length > 0 && (
        <section aria-label="Review your car" className="mb-6 flex flex-col gap-4 border border-line bg-white p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red">From your garage</p>
            <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.01em]">How&apos;s life with your {toReview.map((g) => `${g.brandName} ${g.modelName}`).join(" and ")}?</p>
            <p className="mt-0.5 text-[12.5px] text-muted">Your review helps other buyers — fuel bills, service visits, comfort and the little things a test drive never shows.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {toReview.map((g) => (
              <WriteReviewButton key={g.model} cars={options} defaultCar={g.model} label={toReview.length > 1 ? `Review the ${g.modelName}` : "Write your review"} variant="outline" />
            ))}
          </div>
        </section>
      )}

      {reviews.length === 0 ? (
        <section className="grid grid-cols-1 overflow-hidden border border-line bg-white md:grid-cols-[minmax(0,1fr)_300px]">
          <div className="p-6 md:p-8">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
              <PenLine aria-hidden className="size-5 text-red" />
            </span>
            <h2 className="mt-5 text-[19px] font-semibold tracking-[-0.015em]">You haven&apos;t written a review yet</h2>
            <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-muted">
              Own a car? Tell other buyers what it&apos;s really like to live with. Reviews you write while signed in appear here, and our team checks each one before it&apos;s published.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <WriteReviewButton cars={options} defaultCar={toReview[0]?.model} />
              <Button href="/reviews/owners" variant="ghost" size="sm">
                Read owner reviews
              </Button>
            </div>
          </div>
          <ol className="space-y-4 border-t border-line bg-mist/50 p-6 text-[13px] md:border-l md:border-t-0 md:p-8">
            {[
              ["Write", "Rate your car and share the good and the bad."],
              ["Moderation", "We check every review, usually within two working days."],
              ["Published", "It appears on the car's page with your name and city."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white text-[11px] font-semibold num">{i + 1}</span>
                <span>
                  <span className="block font-medium">{t}</span>
                  <span className="text-muted">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <>
          <section aria-label="Summary" className="mb-6 flex flex-wrap gap-px overflow-hidden border border-line bg-line">
            <MiniStat icon={<CheckCircle2 className="size-4" />} label="Published" value={published.length} />
            <MiniStat icon={<Clock3 className="size-4" />} label="Awaiting moderation" value={pending.length} />
            <MiniStat icon={<ThumbsUp className="size-4" />} label="Helpful votes" value={helpful} />
          </section>
          <PageTabs
            initial={typeof sp.tab === "string" ? sp.tab : "all"}
            items={[
              { value: "all", label: "All", count: reviews.length },
              { value: "published", label: "Published", count: published.length },
              { value: "pending", label: "Awaiting moderation", count: pending.length },
              ...(rejected.length ? [{ value: "rejected", label: "Not published", count: rejected.length }] : []),
            ]}
            panels={{
              all: <ReviewList reviews={reviews} empty="No reviews yet." />,
              published: <ReviewList reviews={published} empty="None of your reviews is published yet." />,
              pending: <ReviewList reviews={pending} empty="Nothing waiting for moderation." />,
              rejected: <ReviewList reviews={rejected} empty="Nothing here." />,
            }}
          />
          <p className="mt-6 text-[12px] leading-relaxed text-muted">
            Reviews written before you signed in, or while signed out, aren&apos;t linked to your account and don&apos;t appear here.
          </p>
        </>
      )}
    </>
  );
}
