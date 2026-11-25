import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, ChevronRight, ImageIcon, LayoutTemplate, Plus, Presentation } from "lucide-react";
import { AD_FORMAT_LABEL } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { ADMIN_TABS, PAGE_SIZE, adRevenue, creativeQueue, listAdminCampaigns, type AdminTab } from "@/server/ads/admin";
import { listPlacements } from "@/server/ads/placements";
import { AdminHeader, FilterForm, FilterSelect, Pagination, Panel, SearchInput, StatCard, Table, Td, Th, hrefWith, pageParam, strParam } from "@/components/admin/ui";
import { EmptyState, LinkTabs, waitingLabel } from "@/components/admin/partner-ui";
import { Button } from "@/components/ui/button";
import { rupees } from "@/components/portal/billing/shared";
import { AdStatusPill, InvoicePill } from "@/components/ads/status";
import { ADVERTISER_TYPES, ADVERTISER_TYPE_LABEL, ctr, n, rangeLabel, type AdvertiserType } from "@/components/ads/shared";

export const metadata: Metadata = { title: "Ad campaigns" };

const TAB_LABEL: Record<AdminTab, string> = { pending: "Pending review", live: "Live", scheduled: "Scheduled", ended: "Ended", all: "All" };

export default async function AdCampaignsPage({ searchParams }: PageProps<"/admin/advertising">) {
  await requireStaff();
  const sp = await searchParams;
  const tabParam = strParam(sp.tab);
  const tab: AdminTab = tabParam && (ADMIN_TABS as readonly string[]).includes(tabParam) ? (tabParam as AdminTab) : "pending";
  const typeParam = strParam(sp.type);
  const type = typeParam && (ADVERTISER_TYPES as readonly string[]).includes(typeParam) ? (typeParam as AdvertiserType) : undefined;
  const placementParam = strParam(sp.placement);
  const placement = placementParam && /^\d{1,10}$/.test(placementParam) ? Number(placementParam) : undefined;
  const q = strParam(sp.q)?.slice(0, 80);
  const page = pageParam(sp.page);
  const [placements, { items, total, counts }, revenue, queue] = await Promise.all([listPlacements(), listAdminCampaigns({ tab, type, placement, q, page }), adRevenue(), creativeQueue(6)]);

  const base = "/admin/advertising";
  const params = { tab: tab === "pending" ? undefined : tab, type, placement: placement ? String(placement) : undefined, q };
  const filters = { type, placement: placement ? String(placement) : undefined, q };
  const hasFilters = Boolean(type || placement || q);

  return (
    <>
      <AdminHeader
        title="Ad campaigns"
        description="Every advertising booking on MarchGear — insurance vendors, dealer partners and MarchGear's own house ads. Approving an advertiser's booking raises its invoice."
        actions={
          <>
            <Button href={`${base}/schedule`} variant="outline" size="sm" icon={<CalendarRange className="size-4" aria-hidden />}>
              Schedule
            </Button>
            <Button href={`${base}/placements`} variant="outline" size="sm" icon={<LayoutTemplate className="size-4" aria-hidden />}>
              Placements & pricing
            </Button>
            <Button href={`${base}/new`} size="sm" icon={<Plus className="size-4" aria-hidden />}>
              House campaign
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Booked" value={rupees(revenue.booked)} note={revenue.pipeline ? `${rupees(revenue.pipeline)} awaiting review` : "Approved advertiser bookings, incl. GST"} />
        <StatCard label="Invoiced" value={rupees(revenue.invoiced)} note="Advertising invoices, excl. void" />
        <StatCard label="Collected" value={rupees(revenue.collected)} note={revenue.refunded ? `Verified payments, net of ${rupees(revenue.refunded)} refunded` : "Verified payments on advertising invoices"} />
        <StatCard label="Outstanding" value={rupees(revenue.outstanding)} note={revenue.verifying ? `${rupees(revenue.verifying)} payment being verified` : "Unpaid advertising invoices"} tone={revenue.outstanding ? "red" : undefined} />
      </div>

      {queue.total > 0 && (
        <Panel
          className="mt-6"
          title={
            <span className="inline-flex items-center gap-2">
              Creatives awaiting review <span className="rounded-full bg-red px-2 py-0.5 text-[11px] font-semibold text-white num">{queue.total}</span>
            </span>
          }
          padded={false}
        >
          <ul className="grid grid-cols-1 divide-y divide-line md:grid-cols-2 md:divide-y-0 2xl:grid-cols-3">
            {queue.items.map((cr) => (
              <li key={cr.id} className="md:border-b md:border-line md:odd:border-r 2xl:odd:border-r-0 2xl:[&:not(:nth-child(3n))]:border-r">
                <Link href={`${base}/${cr.campaign.id}#creative-${cr.id}`} className="group flex items-center gap-3 p-4 transition-colors hover:bg-mist/40">
                  <span className="relative block h-12 w-28 shrink-0 overflow-hidden rounded-[3px] bg-mist ring-1 ring-line">
                    {cr.desktopImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img decoding="async" src={cr.desktopImage} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <ImageIcon aria-hidden className="absolute inset-0 m-auto size-4 text-muted" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium group-hover:text-red">{cr.name}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {cr.campaign.advertiser} · {cr.campaign.name}
                    </span>
                    <span className="block text-[11.5px] text-muted">
                      {cr.campaign.placement} · waiting {waitingLabel(cr.updatedAt)}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
          {queue.total > queue.items.length && <p className="border-t border-line px-4 py-2.5 text-[12.5px] text-muted">And {queue.total - queue.items.length} more — open the campaigns to review them.</p>}
        </Panel>
      )}

      <div className="mt-8">
        <LinkTabs active={tab} items={ADMIN_TABS.map((t) => ({ key: t, label: TAB_LABEL[t], count: counts[t], href: hrefWith(base, filters, { tab: t === "pending" ? undefined : t }) }))} />
        <FilterForm resetHref={hrefWith(base, { tab: params.tab }, {})} hasFilters={hasFilters}>
          {params.tab && <input type="hidden" name="tab" value={params.tab} />}
          <SearchInput value={q} placeholder="Reference, campaign or advertiser…" />
          <FilterSelect name="placement" label="Any placement" value={placement ? String(placement) : undefined} options={placements.map((p) => ({ value: String(p.id), label: p.name }))} />
          <FilterSelect name="type" label="Any advertiser" value={type} options={ADVERTISER_TYPES.map((t) => ({ value: t, label: ADVERTISER_TYPE_LABEL[t] }))} />
        </FilterForm>

        {items.length === 0 ? (
          <div className="border border-line bg-white">
            <EmptyState icon={<Presentation aria-hidden className="size-5" />} title={tab === "pending" && !hasFilters ? "Nothing waiting for review" : "No campaigns match"}>
              {tab === "pending" && !hasFilters ? "Bookings advertisers submit appear here, oldest first." : "Try another tab, search or filter."}
            </EmptyState>
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="min-w-[240px]">Campaign</Th>
                <Th>Placement</Th>
                <Th>Dates</Th>
                <Th>Status</Th>
                <Th>Creatives</Th>
                <Th className="whitespace-nowrap text-right">Impr. · clicks</Th>
                <Th className="text-right">Total</Th>
                <Th>Invoice</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="group transition-colors hover:bg-mist/40">
                  <Td>
                    <Link href={`${base}/${c.id}`} className="font-medium group-hover:text-red">
                      {c.name}
                    </Link>
                    <span className="mt-0.5 block text-[12.5px]">
                      {c.advertiser.name} <span className="text-muted">· {ADVERTISER_TYPE_LABEL[c.advertiser.type]}</span>
                    </span>
                    <span className="block font-mono text-[11.5px] text-muted">
                      {c.reference}
                      {c.status === "pending_approval" && c.submittedAt ? <span className="font-sans"> · waiting {waitingLabel(c.submittedAt)}</span> : null}
                    </span>
                  </Td>
                  <Td className="min-w-[150px]">
                    {c.placement.name}
                    <span className="block text-[12px] text-muted">{AD_FORMAT_LABEL[c.placement.format]}</span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {rangeLabel(c.startsOn, c.endsOn)}
                    <span className="block text-[12px] text-muted num">{c.days} days</span>
                  </Td>
                  <Td>
                    <AdStatusPill display={c.display} />
                  </Td>
                  <Td className="text-[12.5px]">
                    {c.placement.format === "banner" ? (
                      <span className="whitespace-nowrap">
                        <span className="block">{c.creatives.approved} approved</span>
                        {c.creatives.pending > 0 && <span className="block font-medium text-[#2456a6]">{c.creatives.pending} to review</span>}
                        {c.creatives.changes > 0 && <span className="block text-[#9a5b00]">{c.creatives.changes} with changes</span>}
                      </span>
                    ) : (
                      <span className="text-muted">{c.productName ?? "Product"}</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right num">
                    {n(c.stats.impressions)} · {n(c.stats.clicks)}
                    <span className="block text-[11.5px] text-muted">CTR {ctr(c.stats.clicks, c.stats.impressions)}</span>
                  </Td>
                  <Td className="whitespace-nowrap text-right num">{c.house ? <span className="text-muted">House</span> : rupees(c.total)}</Td>
                  <Td>{c.invoice ? <InvoicePill status={c.invoice.display} /> : <span className="whitespace-nowrap text-[12.5px] text-muted">{c.house ? "Not invoiced" : "—"}</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination base={base} params={params} page={page} pageSize={PAGE_SIZE} total={total} />
      </div>
    </>
  );
}
