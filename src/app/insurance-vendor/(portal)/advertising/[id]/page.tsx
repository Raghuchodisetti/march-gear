import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, MessageSquareWarning, Package, ReceiptText } from "lucide-react";
import { AD_FORMAT_LABEL, INVOICE_STATUS_LABEL } from "@/insurance/labels";
import { requireInsurer, vendorName } from "@/server/insurance/context";
import { campaignHistory, getCampaign } from "@/server/ads/campaigns";
import { bookedRanges } from "@/server/ads/booking";
import { getPlacement } from "@/server/ads/placements";
import { dailySeries } from "@/server/ads/stats";
import { Panel, PortalHeader, StatCard, Table, Td, Th, formatDateTime } from "@/components/portal/ui";
import { EmptyState, Facts } from "@/components/admin/partner-ui";
import { InlineBar } from "@/components/portal/analytics/charts";
import { addDays, istDate, rupees } from "@/components/portal/billing/shared";
import { Callout } from "@/components/portal/offers/offer-ui";
import { AdHistory } from "@/components/ads/history";
import { AdStatusPill, InvoicePill } from "@/components/ads/status";
import { AdTrendChart } from "@/components/ads/trend-chart";
import { BOOKING_HORIZON_DAYS, BOOKING_LEAD_DAYS, ctr, dayLabel, n, productHref, rangeLabel } from "@/components/ads/shared";
import { BookingActions, CreativeManager } from "@/components/insurance/vendor/advertising/campaign-detail";

export const metadata: Metadata = { title: "Ad booking" };

export default async function AdBookingPage({ params }: PageProps<"/insurance-vendor/advertising/[id]">) {
  const ctx = await requireInsurer({ perm: "ads.manage" });
  const { id } = await params;
  if (!/^\d{1,10}$/.test(id)) notFound();
  const data = await getCampaign(Number(id), { vendorId: ctx.vendor.id });
  if (!data) notFound();
  const { item: c, creatives } = data;
  const today = istDate();
  const placement = await getPlacement(c.placement.id);
  const started = c.startsOn <= today;
  const statsTo = c.endsOn < today ? c.endsOn : today;
  const [history, series] = await Promise.all([
    campaignHistory(ctx.vendor.id, c.id, creatives),
    started ? dailySeries([c.id], c.startsOn, statsTo) : Promise.resolve([]),
  ]);

  const inReview = c.status === "pending_approval" || c.status === "changes_requested";
  const canEditDates = inReview;
  const canCancel = inReview || ((c.status === "approved" || c.status === "paused") && c.startsOn > today);
  const banner = c.placement.format === "banner";
  const closed = c.status === "rejected" || c.status === "cancelled";
  const ended = c.endsOn < today;
  const creativesEditable = banner && !closed && !ended;
  const firstDay = addDays(today, BOOKING_LEAD_DAYS);
  const lastDay = addDays(today, BOOKING_HORIZON_DAYS + (placement?.maxDays ?? 90));
  const booked = canEditDates && placement ? ((await bookedRanges([placement.id], firstDay, lastDay)).get(placement.id) ?? []) : [];
  const canBill = ctx.can("billing.manage");
  const remarksTone = c.status === "rejected" || c.status === "cancelled" ? "red" : c.status === "changes_requested" ? "amber" : "neutral";
  const target = c.productId ? (
    c.productRef ? (
      <a href={productHref(c.productRef)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:text-red">
        {c.productName} <ExternalLink aria-hidden className="size-3.5" />
      </a>
    ) : (
      "A product that's no longer available"
    )
  ) : c.targetUrl ? (
    <a href={c.targetUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 break-all font-medium hover:text-red">
      {c.targetUrl} <ExternalLink aria-hidden className="size-3.5 shrink-0" />
    </a>
  ) : null;

  return (
    <>
      <PortalHeader
        back={{ href: "/insurance-vendor/advertising", label: "Advertising" }}
        title={c.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12.5px] text-ink/70">{c.reference}</span>
            <AdStatusPill display={c.display} />
            <span className="text-muted">
              {c.placement.name} · {rangeLabel(c.startsOn, c.endsOn)}
            </span>
          </span>
        }
        actions={
          <BookingActions
            campaign={{ id: c.id, name: c.name, status: c.status, startsOn: c.startsOn, endsOn: c.endsOn, pricePerDay: c.pricePerDay, canCancel, canEditDates, canResubmit: c.status === "changes_requested", invoiced: Boolean(c.invoice) }}
            calendar={placement && canEditDates ? { placementId: placement.id, firstDay, lastDay, minDays: placement.minDays, maxDays: placement.maxDays, slots: placement.slots, booked } : null}
          />
        }
      />

      <div className="mb-6 space-y-3">
        {c.adminRemarks && (
          <Callout tone={remarksTone} icon={<MessageSquareWarning />} title={c.status === "changes_requested" ? "MarchGear asked for changes" : c.status === "rejected" ? "Rejected by MarchGear" : "Remarks from MarchGear"}>
            <p className="whitespace-pre-line">{c.adminRemarks}</p>
            {c.status === "changes_requested" && <p className="mt-1.5">Make the changes (dates or creatives) below, then choose Resubmit for review.</p>}
          </Callout>
        )}
        {c.display === "pending_approval" && (
          <Callout tone="blue" title="With MarchGear for review">
            MarchGear checks the booking and its creatives. You&apos;ll be notified when it&apos;s decided; an invoice for {rupees(c.total)} is raised on approval.
          </Callout>
        )}
        {c.display === "paused" && <Callout tone="amber" title="Paused by MarchGear">Your ad isn&apos;t shown while the booking is paused. Its dates don&apos;t change.</Callout>}
        {(c.display === "live" || c.display === "scheduled") && banner && c.creatives.approved === 0 && (
          <Callout tone="amber" title="No approved creative yet">
            The banner {c.display === "live" ? "isn't showing" : "won't show"} until MarchGear approves at least one creative.
          </Callout>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Impressions" value={n(c.stats.impressions)} />
            <StatCard label="Clicks" value={n(c.stats.clicks)} />
            <StatCard label="CTR" value={ctr(c.stats.clicks, c.stats.impressions)} />
            <StatCard label="Enquiries" value={n(c.stats.enquiries)} />
          </div>

          <Panel title="Daily performance">
            {series.length ? (
              <>
                <AdTrendChart series={series} title={rangeLabel(c.startsOn, statsTo)} height={220} />
                <div className="mt-6">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Day</Th>
                        <Th>Impressions</Th>
                        <Th className="text-right">Clicks</Th>
                        <Th className="text-right">CTR</Th>
                        <Th className="text-right">Enquiries</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...series].reverse().map((d) => (
                        <tr key={d.day}>
                          <Td className="whitespace-nowrap">{dayLabel(d.day)}</Td>
                          <Td>
                            <InlineBar value={d.impressions} max={Math.max(...series.map((s) => s.impressions))}>
                              {n(d.impressions)}
                            </InlineBar>
                          </Td>
                          <Td className="text-right num">{n(d.clicks)}</Td>
                          <Td className="text-right num">{ctr(d.clicks, d.impressions)}</Td>
                          <Td className="text-right num">{n(d.enquiries)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </>
            ) : (
              <EmptyState title={closed ? "This booking didn't run" : "Starts " + dayLabel(c.startsOn)}>
                {closed ? "There are no statistics for it." : "Impressions, clicks and enquiries appear here day by day once the campaign is live."}
              </EmptyState>
            )}
          </Panel>

          <Panel title={banner ? `Creatives (${creatives.length})` : "Sponsored product"}>
            {banner ? (
              <CreativeManager
                campaignId={c.id}
                creatives={creatives}
                sizes={c.placement}
                advertiser={vendorName(ctx.vendor)}
                editable={creativesEditable}
                live={c.display === "live"}
                lockedReason={closed ? "This booking is closed, so its creatives can't be changed." : ended ? "This campaign has ended." : null}
              />
            ) : (
              <div className="flex items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-mist text-ink">
                  <Package aria-hidden className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold">{c.productName ?? "Product unavailable"}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    Shown first in quote results and on the compare page, marked Sponsored, while the booking is live and the product is published. It uses the product&apos;s own name, cover and indicative premium.
                  </p>
                  {c.productRef && (
                    <a href={productHref(c.productRef)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-red hover:underline">
                      Open the product page <ExternalLink aria-hidden className="size-3.5" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </Panel>

          <Panel title="History">
            <AdHistory entries={history} viewer="vendor" />
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Booking">
            <Facts
              rows={[
                ["Placement", c.placement.name],
                ["Format", AD_FORMAT_LABEL[c.placement.format]],
                ["Dates", rangeLabel(c.startsOn, c.endsOn)],
                ["Days", n(c.days)],
                ["Links to", target],
                ["Booked on", formatDateTime(c.createdAt)],
              ]}
            />
          </Panel>
          <Panel title="Price">
            <dl className="space-y-2 text-[13.5px]">
              <div className="flex justify-between gap-4">
                <dt className="text-muted num">
                  {rupees(c.pricePerDay)} × {c.days} days
                </dt>
                <dd className="num">{rupees(c.amount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">GST (18%)</dt>
                <dd className="num">{rupees(c.gst)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-2.5">
                <dt className="font-semibold">Total</dt>
                <dd className="font-display text-[19px] font-semibold tracking-[-0.02em] num">{rupees(c.total)}</dd>
              </div>
            </dl>
          </Panel>
          <Panel title="Invoice">
            {c.invoice ? (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[13px]">{c.invoice.number}</p>
                  <InvoicePill status={c.invoice.display} />
                </div>
                <p className="mt-1.5 text-[12.5px] text-muted">
                  {rupees(c.invoice.total)} · {c.invoice.display === "paid" ? INVOICE_STATUS_LABEL.paid : `due ${dayLabel(c.invoice.dueOn)}`}
                </p>
                {canBill ? (
                  <Link href={`/insurance-vendor/invoices/${c.invoice.id}`} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-red hover:underline">
                    <ReceiptText aria-hidden className="size-4" /> View invoice & pay
                  </Link>
                ) : (
                  <p className="mt-3 text-[12px] text-muted">Your company&apos;s owner or finance team can see and pay invoices.</p>
                )}
              </div>
            ) : (
              <p className="text-[13px] leading-relaxed text-muted">
                {inReview ? "Raised when MarchGear approves the booking. Pay it by bank transfer as shown on the invoice — there's no card payment." : closed ? "No invoice — this booking didn't go ahead." : "No invoice for this booking."}
              </p>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
