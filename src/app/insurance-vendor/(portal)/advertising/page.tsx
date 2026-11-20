import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MessageSquareWarning, Plus, Presentation, ReceiptText } from "lucide-react";
import { AD_FORMAT_LABEL } from "@/insurance/labels";
import { requireInsurer } from "@/server/insurance/context";
import { listPlacements } from "@/server/ads/placements";
import { TREND_DAYS, vendorAdOverview } from "@/server/ads/vendor";
import { Panel, PortalHeader, StatCard, Table, Td, Th, strParam } from "@/components/portal/ui";
import { EmptyState, LinkTabs } from "@/components/admin/partner-ui";
import { Button } from "@/components/ui/button";
import { rupees } from "@/components/portal/billing/shared";
import { AdStatusPill, InvoicePill } from "@/components/ads/status";
import { AdTrendChart } from "@/components/ads/trend-chart";
import { PlacementArt } from "@/components/ads/placement-art";
import { ctr, n, rangeLabel } from "@/components/ads/shared";
import { Callout } from "@/components/portal/offers/offer-ui";

export const metadata: Metadata = { title: "Advertising" };

const VIEWS = {
  all: { label: "All bookings", match: () => true },
  live: { label: "Live", match: (d: string) => d === "live" },
  upcoming: { label: "Scheduled", match: (d: string) => d === "scheduled" },
  review: { label: "In review", match: (d: string) => d === "pending_approval" || d === "changes_requested" },
  closed: { label: "Ended & closed", match: (d: string) => ["ended", "rejected", "cancelled", "paused", "draft"].includes(d) },
} as const;
type View = keyof typeof VIEWS;

export default async function AdvertisingPage({ searchParams }: PageProps<"/insurance-vendor/advertising">) {
  const ctx = await requireInsurer({ perm: "ads.manage" });
  const sp = await searchParams;
  const viewParam = strParam(sp.view);
  const view: View = viewParam && viewParam in VIEWS ? (viewParam as View) : "all";
  const [{ items, series, totals, money }, placements] = await Promise.all([vendorAdOverview(ctx.vendor.id), listPlacements()]);
  const bookable = placements.filter((p) => p.isActive && (p.audience === "all" || p.audience === "insurer"));
  const shown = items.filter((i) => VIEWS[view].match(i.display));
  const needsChanges = items.filter((i) => i.display === "changes_requested" || i.creatives.changes > 0);
  const live = items.filter((i) => i.display === "live").length;
  const canBill = ctx.can("billing.manage");
  const base = "/insurance-vendor/advertising";

  return (
    <>
      <PortalHeader
        title="Advertising"
        description="Book banners and sponsored listings across MarchGear. Every booking and creative is reviewed by MarchGear before it goes live; an invoice is raised on approval."
        actions={
          <Button href={`${base}/new`} size="sm" icon={<Plus className="size-4" aria-hidden />}>
            Book a placement
          </Button>
        }
      />

      {needsChanges.length > 0 && (
        <Callout tone="amber" icon={<MessageSquareWarning />} title={`${needsChanges.length} booking${needsChanges.length === 1 ? " needs" : "s need"} your attention`} className="mb-6">
          MarchGear asked for changes on{" "}
          {needsChanges.slice(0, 3).map((c, i) => (
            <span key={c.id}>
              {i > 0 && ", "}
              <Link href={`${base}/${c.id}`} className="font-semibold underline-offset-2 hover:underline">
                {c.name}
              </Link>
            </span>
          ))}
          {needsChanges.length > 3 ? ` and ${needsChanges.length - 3} more` : ""}.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Impressions" value={n(totals.impressions)} note={`${live} live booking${live === 1 ? "" : "s"}`} />
        <StatCard label="Clicks" value={n(totals.clicks)} note={`CTR ${ctr(totals.clicks, totals.impressions)}`} />
        <StatCard label="Enquiries from ads" value={n(totals.enquiries)} note={totals.clicks ? `${Math.round((totals.enquiries / totals.clicks) * 100)}% of clicks` : "Quote requests after an ad click"} />
        <StatCard label="Booked spend" value={rupees(money.booked)} note={money.pipeline ? `${rupees(money.pipeline)} awaiting review` : "Approved bookings, incl. GST"} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title={`Last ${TREND_DAYS} days`}>
          {items.length ? (
            <AdTrendChart series={series} title="All bookings" />
          ) : (
            <EmptyState icon={<Presentation aria-hidden className="size-5" />} title="No advertising yet">
              Book a placement to see impressions, clicks and enquiries here, day by day.
            </EmptyState>
          )}
        </Panel>
        <Panel title="Spend" action={canBill ? <Link href="/insurance-vendor/invoices?kind=advertising" className="text-[12.5px] font-medium text-red hover:underline">Invoices</Link> : undefined}>
          <dl className="divide-y divide-line">
            {[
              ["Booked", money.booked, "Approved bookings, incl. GST"],
              ["Invoiced", money.invoiced, "Advertising invoices raised"],
              ["Paid", money.collected, money.refunded ? `Payments MarchGear verified, net of ${rupees(money.refunded)} refunded` : "Payments MarchGear has verified"],
              ["Outstanding", money.outstanding, money.verifying ? `${rupees(money.verifying)} being verified` : "Unpaid advertising invoices"],
            ].map(([k, v, note]) => (
              <div key={k as string} className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <dt>
                  <span className="block text-[13.5px] font-medium">{k}</span>
                  <span className="block text-[12px] text-muted">{note}</span>
                </dt>
                <dd className={`font-display text-[18px] font-semibold tracking-[-0.02em] num ${k === "Outstanding" && Number(v) > 0 ? "text-red" : ""}`}>{rupees(Number(v))}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-muted">No card payments: pay each invoice by bank transfer, UPI or cheque as shown on it, then record the reference in Invoices.</p>
        </Panel>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-4">
          <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">Your bookings</h2>
        </div>
        <LinkTabs
          active={view}
          items={(Object.keys(VIEWS) as View[]).map((k) => ({ key: k, label: VIEWS[k].label, count: items.filter((i) => VIEWS[k].match(i.display)).length, href: k === "all" ? base : `${base}?view=${k}` }))}
        />
        {shown.length === 0 ? (
          <div className="border border-line bg-white">
            <EmptyState icon={<Presentation aria-hidden className="size-5" />} title={items.length ? "Nothing here" : "No bookings yet"}>
              {items.length ? "No bookings in this view." : "Choose a placement, pick your dates and upload your banners — MarchGear reviews it and raises an invoice on approval."}
            </EmptyState>
            {!items.length && (
              <div className="-mt-6 flex justify-center pb-10">
                <Button href={`${base}/new`} size="sm" icon={<Plus className="size-4" aria-hidden />}>
                  Book a placement
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Booking</Th>
                <Th>Placement</Th>
                <Th>Dates</Th>
                <Th>Status</Th>
                <Th className="text-right">Impressions</Th>
                <Th className="text-right">Clicks</Th>
                <Th className="text-right">Enquiries</Th>
                <Th className="text-right">Total</Th>
                <Th>Invoice</Th>
                <Th className="w-8">
                  <span className="sr-only">Open</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="group transition-colors hover:bg-mist/40">
                  <Td>
                    <Link href={`${base}/${c.id}`} className="font-medium group-hover:text-red">
                      {c.name}
                    </Link>
                    <span className="block font-mono text-[11.5px] text-muted">{c.reference}</span>
                  </Td>
                  <Td>
                    {c.placement.name}
                    <span className="block text-[12px] text-muted">{AD_FORMAT_LABEL[c.placement.format]}</span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {rangeLabel(c.startsOn, c.endsOn)}
                    <span className="block text-[12px] text-muted num">{c.days} days</span>
                  </Td>
                  <Td>
                    <AdStatusPill display={c.display} />
                    {c.creatives.changes > 0 && <span className="mt-1 block text-[11.5px] font-medium text-[#9a5b00]">Creative needs changes</span>}
                  </Td>
                  <Td className="text-right num">{n(c.stats.impressions)}</Td>
                  <Td className="text-right num">
                    {n(c.stats.clicks)}
                    <span className="block text-[11.5px] text-muted">{ctr(c.stats.clicks, c.stats.impressions)}</span>
                  </Td>
                  <Td className="text-right num">{n(c.stats.enquiries)}</Td>
                  <Td className="text-right num">{rupees(c.total)}</Td>
                  <Td>
                    {c.invoice ? (
                      canBill ? (
                        <Link href={`/insurance-vendor/invoices/${c.invoice.id}`} className="group/inv inline-flex flex-col gap-1">
                          <span className="whitespace-nowrap font-mono text-[12px] group-hover/inv:text-red">{c.invoice.number}</span>
                          <InvoicePill status={c.invoice.display} />
                        </Link>
                      ) : (
                        <InvoicePill status={c.invoice.display} />
                      )
                    ) : (
                      <span className="text-[12.5px] text-muted">{c.status === "pending_approval" || c.status === "changes_requested" ? "On approval" : "—"}</span>
                    )}
                  </Td>
                  <Td>
                    <Link href={`${base}/${c.id}`} aria-label={`Open ${c.name}`} className="inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink">
                      <ChevronRight aria-hidden className="size-4" />
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      {bookable.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">Rate card</h2>
              <p className="mt-1 text-[13px] text-muted">Prices per day, before 18% GST. Set by MarchGear; your booking keeps the rate it was booked at.</p>
            </div>
            {canBill && (
              <Button href="/insurance-vendor/invoices?kind=advertising" variant="ghost" size="sm" icon={<ReceiptText className="size-4" aria-hidden />}>
                Advertising invoices
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {bookable.map((p) => (
              <Link key={p.id} href={`${base}/new?placement=${p.id}`} className="group flex flex-col border border-line bg-white p-4 transition-colors hover:border-ink/40">
                <span className="block overflow-hidden rounded-[3px] border border-line bg-[#F6F6F6] p-2">
                  <PlacementArt placementKey={p.key} format={p.format} />
                </span>
                <span className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{AD_FORMAT_LABEL[p.format]}</span>
                <span className="mt-0.5 text-[15px] font-semibold group-hover:text-red">{p.name}</span>
                <span className="mt-0.5 text-[12.5px] text-muted">{p.location}</span>
                <span className="mt-auto flex items-baseline justify-between pt-3">
                  <span className="font-display text-[18px] font-semibold tracking-[-0.02em] num">
                    {rupees(p.pricePerDay)}
                    <span className="text-[12px] font-normal text-muted"> /day</span>
                  </span>
                  <span className="text-[12px] text-muted num">
                    {p.minDays}–{p.maxDays} days
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
