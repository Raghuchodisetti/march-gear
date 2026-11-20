import type { Metadata } from "next";
import Link from "next/link";
import { BadgePercent, CalendarClock, FileText, PlayCircle } from "lucide-react";
import { OFFER_STATUS } from "@/db/enums";
import { OFFER_CATEGORY_LABEL, OFFER_STATUS_LABEL, PARTNER_STATUS_LABEL, offerDisplayStatus } from "@/partner/labels";
import { getOfferReview, listPartnerOffers, OFFERS_PAGE_SIZE, type OfferReview } from "@/server/admin/partners";
import { requireStaff } from "@/server/auth";
import { AdminHeader, FilterForm, FilterSelect, Pagination, Panel, SearchInput, formatDateTime, hrefWith, pageParam, strParam } from "@/components/admin/ui";
import { BannerPreview, OfferActions, ReviewDrawer } from "@/components/admin/partner-review";
import { HistoryList } from "@/components/admin/partner-history";
import { EmptyState, Facts, LinkTabs, OfferPill, PartnerPill, StatusPill, discountSummary, overdue, rupees, waitingLabel } from "@/components/admin/partner-ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Offer approvals" };

const categoryLabel = (c: string) => OFFER_CATEGORY_LABEL[c as keyof typeof OFFER_CATEGORY_LABEL] ?? c;

const dayFmt = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

export default async function OfferApprovalsPage({ searchParams }: PageProps<"/admin/offer-approvals">) {
  await requireStaff();
  const sp = await searchParams;
  const view = sp.view === "all" ? "all" : "queue";
  const partnerParam = strParam(sp.partner);
  const params = { view: view === "all" ? "all" : undefined, q: strParam(sp.q), status: view === "all" ? strParam(sp.status) : undefined, partner: partnerParam && /^\d+$/.test(partnerParam) ? partnerParam : undefined };
  const reviewId = strParam(sp.review);
  const [{ rows, total, page, queue, byStatus, now }, review] = await Promise.all([
    listPartnerOffers({ view, q: params.q, status: params.status, partner: params.partner ? Number(params.partner) : undefined, page: pageParam(sp.page) }),
    reviewId && /^\d+$/.test(reviewId) ? getOfferReview(Number(reviewId)) : Promise.resolve(null),
  ]);
  const all = Object.values(byStatus).reduce((a, b) => a + (b ?? 0), 0);
  const base = "/admin/offer-approvals";
  const listParams = { ...params, page: sp.page ? String(pageParam(sp.page)) : undefined };
  const hasFilters = Boolean(params.q || params.status || params.partner);

  return (
    <>
      <AdminHeader
        title="Offer approvals"
        description="Dealer offers and festival campaigns waiting for review. Approved offers go live and expire on their own dates."
        actions={
          <Link href="/admin/campaign-management" className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-ink/15 px-3.5 text-[13px] font-medium hover:border-ink">
            <CalendarClock aria-hidden className="size-4" /> Campaign management
          </Link>
        }
      />
      <LinkTabs
        active={view}
        items={[
          { key: "queue", label: "Waiting for review", count: queue, href: hrefWith(base, { q: params.q, partner: params.partner }, {}) },
          { key: "all", label: "All offers", count: all, href: hrefWith(base, { q: params.q, partner: params.partner }, { view: "all" }) },
        ]}
      />
      <FilterForm resetHref={hrefWith(base, { view: params.view }, {})} hasFilters={hasFilters}>
        {params.view && <input type="hidden" name="view" value="all" />}
        {params.partner && <input type="hidden" name="partner" value={params.partner} />}
        <SearchInput value={params.q} placeholder="Reference, title, campaign, dealer…" />
        {view === "all" && <FilterSelect name="status" label="Any status" value={params.status} options={OFFER_STATUS.map((s) => ({ value: s, label: `${OFFER_STATUS_LABEL[s]} (${byStatus[s] ?? 0})` }))} />}
      </FilterForm>
      {params.partner && (
        <p className="-mt-1 mb-3 text-[13px] text-muted">
          Showing one dealer&apos;s offers ·{" "}
          <Link href={hrefWith(base, { ...params, partner: undefined }, {})} className="font-medium text-red hover:underline">
            Show every dealer
          </Link>
        </p>
      )}

      {rows.length === 0 ? (
        <div className="border border-line bg-white">
          <EmptyState icon={<BadgePercent aria-hidden className="size-5" />} title={view === "queue" && !hasFilters ? "No offers waiting" : "No offers match"}>
            {view === "queue" && !hasFilters ? "Offers dealers submit for approval appear here, oldest first." : "Try another search or filter."}
          </EmptyState>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((o) => {
            const href = hrefWith(base, listParams, { review: String(o.id) });
            const shown = offerDisplayStatus(o);
            const willBe = offerDisplayStatus({ status: "approved", startsAt: o.startsAt, endsAt: o.endsAt });
            const pending = o.status === "submitted" || o.status === "pending_approval";
            return (
              <Link key={o.id} href={href} scroll={false} className={cn("group flex flex-col overflow-hidden border bg-white transition-colors hover:border-ink/40", review?.offer.id === o.id ? "border-ink" : "border-line")}>
                <span className="relative block aspect-[3/1] overflow-hidden bg-mist">
                  {o.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.thumbnail} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-muted">
                      <BadgePercent aria-hidden className="size-6" />
                    </span>
                  )}
                  <span className="absolute left-3 top-3">
                    <OfferPill offer={o} />
                  </span>
                </span>
                <span className="flex flex-1 flex-col p-4">
                  <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">{categoryLabel(o.category)}</span>
                  <span className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug group-hover:text-red">{o.title}</span>
                  <span className="mt-1 truncate text-[12.5px] text-muted">
                    {o.partnerName ?? o.partnerRef} · {o.reference}
                  </span>
                  <span className="mt-2 line-clamp-1 text-[12.5px]">{discountSummary(o.discount)}</span>
                  <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-[12px]">
                    <span className="text-muted">
                      {dayFmt(o.startsAt)} – {dayFmt(o.endsAt)}
                    </span>
                    {pending ? (
                      <span className={cn(overdue(o.submittedAt, now) ? "font-semibold text-red" : "text-muted")}>
                        Waiting {waitingLabel(o.submittedAt ?? o.createdAt, now)} · {o.endsAt.getTime() < now ? "already ended" : `would be ${OFFER_STATUS_LABEL[willBe].toLowerCase()}`}
                      </span>
                    ) : (
                      <span className="text-muted">{OFFER_STATUS_LABEL[shown]}</span>
                    )}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
      <Pagination base={base} params={params} page={page} pageSize={OFFERS_PAGE_SIZE} total={total} />

      {review && (
        <ReviewDrawer
          key={review.offer.id}
          title={review.offer.title}
          closeHref={hrefWith(base, listParams, {})}
          footer={<OfferActions now={now} id={review.offer.id} status={review.offer.status} startsAt={review.offer.startsAt.toISOString()} endsAt={review.offer.endsAt.toISOString()} title={review.offer.title} />}
        >
          <OfferReviewBody r={review} now={now} />
        </ReviewDrawer>
      )}
    </>
  );
}

function OfferReviewBody({ r, now }: { r: OfferReview; now: number }) {
  const o = r.offer;
  const d = o.discount;
  const shown = offerDisplayStatus(o);
  const willBe = offerDisplayStatus({ status: "approved", startsAt: o.startsAt, endsAt: o.endsAt });
  const days = Math.max(1, Math.round((o.endsAt.getTime() - o.startsAt.getTime()) / 86_400_000));
  const rooms = new Map(r.showrooms.map((s) => [s.id, `${s.name}, ${s.city}`]));
  const locations =
    o.locations.mode === "all"
      ? "All showrooms"
      : o.locations.mode === "branches"
        ? o.locations.showroomIds.map((id) => rooms.get(id) ?? `Showroom #${id}`).join("; ")
        : o.locations.mode === "cities"
          ? o.locations.cities.join(", ")
          : o.locations.states.join(", ");
  const pending = o.status === "submitted" || o.status === "pending_approval" || o.status === "changes_requested" || o.status === "rejected";

  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <OfferPill offer={o} />
        <span className="text-[13px] text-muted">
          {o.reference} · {categoryLabel(o.category)} · {o.campaignName}
        </span>
        <Link href={`/admin/dealers/details?id=${r.partner.id}`} className="text-[13px] font-medium hover:text-red">
          {r.partner.name}
        </Link>
        {r.partner.status !== "approved" && <PartnerPill status={r.partner.status} />}
      </div>

      <div className={cn("flex items-start gap-3 border px-4 py-3 text-[13px]", o.endsAt.getTime() < now ? "border-red/30 bg-red-50/40" : "border-line bg-mist/50")}>
        <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
        <div>
          <p className="font-medium">
            {formatDateTime(o.startsAt)} – {formatDateTime(o.endsAt)} <span className="font-normal text-muted">({days} day{days === 1 ? "" : "s"})</span>
          </p>
          <p className="mt-0.5 text-muted">
            {pending
              ? o.endsAt.getTime() < now
                ? "Its end date has passed — use Schedule to approve it with new dates."
                : `If approved now it shows as ${OFFER_STATUS_LABEL[willBe]}${willBe === "scheduled" ? " until its start date, then goes Active by itself" : " straight away"}.`
              : `Currently ${OFFER_STATUS_LABEL[shown]}.`}
          </p>
          {r.partner.status !== "approved" && o.status !== "cancelled" && o.status !== "rejected" && (
            <p className="mt-1 font-medium text-[#9a5b00]">
              Not shown on the website while the dealership is {PARTNER_STATUS_LABEL[r.partner.status].toLowerCase()}
              {shown === "active" || shown === "scheduled" || pending
                ? ` — it goes live (inside its dates) once the dealership is ${r.partner.status === "suspended" || r.partner.status === "deactivated" ? "reactivated" : "approved"}.`
                : "."}
            </p>
          )}
        </div>
      </div>

      {o.adminRemarks && (
        <p className="border-l-2 border-[#e09200] bg-[#fdf3e1]/60 px-4 py-2.5 text-[13px]">
          <span className="font-semibold">Last remarks to the dealer:</span> {o.adminRemarks}
        </p>
      )}

      <Panel title="Banners">
        <BannerPreview media={o.media} title={o.title} />
        {o.media.gallery.length > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {o.media.gallery.slice(0, 8).map((src) => (
              <a key={src} href={src} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden bg-mist">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-4 text-[13px]">
          {o.media.videoUrl && (
            <a href={o.media.videoUrl} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1.5 text-red hover:underline">
              <PlayCircle aria-hidden className="size-4" /> Campaign video
            </a>
          )}
          {o.media.brochure && (
            <a href={`/dealer/files/${o.media.brochure.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-red hover:underline">
              <FileText aria-hidden className="size-4" /> {o.media.brochure.filename}
            </a>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Panel title="Discount">
          <Facts
            className="-my-2.5"
            rows={(
              [
                ["Flat discount", d.flat ? rupees(d.flat) : null],
                ["Percentage", d.percentage ? `${d.percentage}%` : null],
                ["Cash discount", d.cash ? rupees(d.cash) : null],
                ["Exchange bonus", d.exchangeBonus ? rupees(d.exchangeBonus) : null],
                ["Corporate bonus", d.corporateBonus ? rupees(d.corporateBonus) : null],
                ["Loyalty bonus", d.loyaltyBonus ? rupees(d.loyaltyBonus) : null],
                ["Free accessories", d.freeAccessories || null],
                ["Free insurance", d.freeInsurance ? "Yes" : null],
                ["Finance benefit", d.financeBenefit || null],
                ["Maximum discount", d.maxDiscount ? rupees(d.maxDiscount) : null],
                ["Minimum purchase", d.minPurchase || null],
              ] as [string, string | null][]
            ).filter(([, v]) => v !== null)}
          />
          {discountSummary(d) === "No discount details" && <p className="text-[13px] text-muted">No discount details entered.</p>}
        </Panel>
        <Panel title="Applies to">
          <Facts
            className="-my-2.5"
            rows={[
              ["Vehicles", o.scope.vehicleType === "both" ? "New & used" : o.scope.vehicleType === "new" ? "New cars" : "Used cars"],
              ["Models", o.scope.allModels ? "All models" : [r.brandNames.join(", "), r.modelNames.join(", ")].filter(Boolean).join(" — ") || null],
              ["Variants", o.scope.variants.length ? `${o.scope.variants.length} selected` : o.scope.allModels ? "All" : null],
              ["Live matching listings", r.liveVehicles],
              ["Locations", locations || null],
              ["Limited stock", o.limitedStock],
              ["Redemptions", o.maxRedemptions ? `${o.redemptions} of ${o.maxRedemptions}` : o.redemptions || null],
            ]}
          />
        </Panel>
      </div>

      <Panel title="Offer copy">
        {o.tagline && <p className="text-[15px] font-semibold">{o.tagline}</p>}
        {o.description && <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed">{o.description}</p>}
        <h4 className="mt-4 text-[12.5px] font-semibold text-muted">Terms & conditions</h4>
        <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink/85">{o.terms || "No terms provided."}</p>
      </Panel>

      <div className="grid grid-cols-3 gap-3">
        {[
          ["Views", o.views],
          ["Enquiries", o.enquiries],
          ["Conversions", o.conversions],
        ].map(([k, v]) => (
          <div key={k} className="border border-line p-3">
            <p className="text-[12px] text-muted">{k}</p>
            <p className="mt-1 font-display text-[20px] font-semibold num">{Number(v).toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>

      <Panel title="Approval history">
        <HistoryList entries={r.history} showTarget={false} empty="No decisions on this offer yet." />
      </Panel>
      {o.status === "cancelled" && <StatusPill tone="neutral">Cancelled — no further actions</StatusPill>}
    </div>
  );
}
