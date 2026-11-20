import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { ExternalLink, Star } from "lucide-react";
import { getDb } from "@/db";
import { dealerReviews, dealers } from "@/db/schema";
import { requirePartner } from "@/server/partner/context";
import { Panel, PortalHeader } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/ui/rating";
import { ReviewsView, type ReviewItem } from "@/components/portal/reviews/reviews-view";

export const metadata: Metadata = { title: "Reviews & ratings" };

export default async function Page() {
  const ctx = await requirePartner({ perm: "reviews.reply" });
  const dealerId = ctx.partner.publicDealerId;

  if (!dealerId)
    return (
      <>
        <PortalHeader title="Reviews & ratings" description="What customers say about your showroom." />
        <Panel>
          <p className="text-[14px] text-muted">Your public showroom page isn&apos;t live yet. Once it is, approved customer reviews appear here and you can reply to them publicly.</p>
        </Panel>
      </>
    );

  const db = getDb();
  const [rows, [dealer]] = await Promise.all([
    db
      .select()
      .from(dealerReviews)
      .where(and(eq(dealerReviews.dealerId, dealerId), eq(dealerReviews.status, "approved")))
      .orderBy(desc(dealerReviews.date), desc(dealerReviews.createdAt))
      .limit(1000),
    db.select({ name: dealers.name, isActive: dealers.isActive }).from(dealers).where(eq(dealers.id, dealerId)),
  ]);

  const reviews: ReviewItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    visit: r.visit,
    date: r.date,
    rating: r.rating,
    title: r.title,
    body: r.body,
    reply: r.reply,
    repliedAt: r.repliedAt?.toISOString() ?? null,
  }));
  const total = reviews.length;
  const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => {
    const c = reviews.filter((r) => Math.round(r.rating) === n).length;
    return { n, c, pct: total ? Math.round((c / total) * 100) : 0 };
  });
  const replied = reviews.filter((r) => r.reply).length;
  const lowUnreplied = reviews.filter((r) => !r.reply && r.rating <= 3).length;
  const name = dealer?.name ?? ctx.partner.tradeName ?? "Your showroom";

  return (
    <>
      <PortalHeader
        title="Reviews & ratings"
        description="Approved customer reviews of your MarchGear showroom page. Replies are public and appear under the review."
        actions={
          dealer?.isActive ? (
            <Button href={`/dealers/${dealerId}#reviews-title`} target="_blank" variant="outline" size="sm" icon={<ExternalLink className="size-4" aria-hidden />}>
              View public page
            </Button>
          ) : undefined
        }
      />

      <section aria-label="Rating summary" className="mb-6 grid grid-cols-1 border border-line bg-white lg:grid-cols-[280px_minmax(0,1fr)_260px]">
        <div className="border-b border-line p-6 lg:border-b-0 lg:border-r">
          <p className="text-[12px] text-muted">Average rating</p>
          <div className="mt-3 flex items-end gap-4">
            <p className="font-display text-[56px] font-semibold leading-[0.85] tracking-[-0.04em] num">{total ? avg.toFixed(1) : "—"}</p>
            <div className="pb-1">
              <Stars value={avg} size={15} />
              <p className="mt-1.5 text-[12.5px] text-muted num">
                {total} review{total === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>
        <dl className="space-y-2.5 border-b border-line p-6 lg:border-b-0 lg:border-r">
          {dist.map((d) => (
            <div key={d.n} className="grid grid-cols-[36px_minmax(0,1fr)_64px] items-center gap-3 text-[12.5px]" title={`${d.n} stars: ${d.c} review${d.c === 1 ? "" : "s"} (${d.pct}%)`}>
              <dt className="inline-flex items-center gap-1 text-muted num">
                {d.n} <Star aria-hidden className="size-3 fill-current" />
              </dt>
              <dd className="h-[6px] rounded-full bg-mist" aria-hidden>
                <div className="h-full rounded-full bg-ink transition-[width] duration-700 ease-[var(--ease-premium)]" style={{ width: `${d.pct}%` }} />
              </dd>
              <dd className="text-right text-muted num">
                {d.c} · {d.pct}%
              </dd>
            </div>
          ))}
        </dl>
        <div className="grid grid-cols-2 lg:grid-cols-1">
          <div className="border-r border-line p-6 lg:border-b lg:border-r-0">
            <p className="text-[12px] text-muted">Reply rate</p>
            <p className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.03em] num">{total ? Math.round((replied / total) * 100) : 0}%</p>
            <p className="mt-1.5 text-[12px] text-muted num">
              {replied} of {total} replied
            </p>
          </div>
          <div className="p-6">
            <p className="text-[12px] text-muted">Critical, unanswered</p>
            <p className={`mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.03em] num ${lowUnreplied ? "text-red" : ""}`}>{lowUnreplied}</p>
            <p className="mt-1.5 text-[12px] text-muted">3 stars or fewer</p>
          </div>
        </div>
      </section>

      <ReviewsView reviews={reviews} dealerName={name} />
    </>
  );
}
