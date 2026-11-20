import type { Metadata } from "next";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { requireInsurer } from "@/server/insurance/context";
import { getInsAnalytics } from "@/server/insurance/analytics";
import { insuranceSettings } from "@/server/insurance/quote-builder";
import { Badge, EmptyRow, Panel, PortalHeader, Table, Td, Th, strParam } from "@/components/portal/ui";
import { ChartStyles, Funnel, InlineBar } from "@/components/portal/analytics/charts";
import { delta, type Metric } from "@/components/portal/analytics/report";
import { rupees } from "@/components/portal/billing/shared";
import { InsAnalyticsToolbar } from "@/components/insurance/vendor/analytics/toolbar";
import { ColumnChart } from "@/components/insurance/vendor/analytics/column-chart";
import { fmtPct, pct, resolveInsRange } from "@/components/insurance/vendor/analytics/report";

export const metadata: Metadata = { title: "Analytics" };

function Delta({ m, rate }: { m: Metric; rate?: boolean }) {
  const d = rate ? (m.prev || m.value ? { pct: m.value - m.prev, up: m.value >= m.prev } : null) : delta(m);
  if (!d) return <span className="text-[12px] text-muted">No activity either period</span>;
  if (d.pct === null) return <span className="text-[12px] font-medium text-[#1e7a3c]">New this period</span>;
  const flat = Math.abs(d.pct) < 0.05;
  const Icon = flat ? Minus : d.up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12px] font-medium num", flat ? "text-muted" : d.up ? "text-[#1e7a3c]" : "text-red")}>
      <Icon className="size-3.5" aria-hidden />
      {flat ? "No change" : `${d.up ? "+" : "−"}${Math.abs(d.pct).toFixed(1)}${rate ? " pts" : "%"}`}
      <span className="font-normal text-muted">vs previous</span>
    </span>
  );
}

function Tile({ label, value, m, rate, note }: { label: string; value: string; m?: Metric; rate?: boolean; note?: string }) {
  return (
    <div className="border border-line bg-white p-5 transition-colors duration-500 hover:border-ink/25">
      <p className="text-[12.5px] font-medium text-muted">{label}</p>
      <p className="mt-3 font-display text-[28px] font-semibold leading-none tracking-[-0.03em] num">{value}</p>
      <div className="mt-3 min-h-[18px] space-y-1">
        {m && <Delta m={m} rate={rate} />}
        {note && <p className="text-[12px] text-muted">{note}</p>}
      </div>
    </div>
  );
}

function Bars({ items, empty, tone = "ink" }: { items: { key: string; label: string; value: number }[]; empty: string; tone?: "ink" | "red" }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!total) return <p className="py-8 text-center text-[13.5px] text-muted">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.key} className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)_44px] items-center gap-3 text-[13px] sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)_44px]">
          <span className="truncate text-ink/80" title={i.label}>
            {i.label}
          </span>
          <InlineBar value={i.value} max={max} tone={tone} />
          <span className="text-right text-[12px] text-muted num">{fmtPct(pct(i.value, total))}</span>
        </li>
      ))}
    </ul>
  );
}

const n = (v: number) => v.toLocaleString("en-IN");
/** "Nov 2025" → "Nov ’25" on the first column and in January, else "Dec". */
const monthTick = (label: string, i: number) => (i === 0 || label.startsWith("Jan") ? `${label.slice(0, 3)} ’${label.slice(-2)}` : label.slice(0, 3));

export default async function Page({ searchParams }: PageProps<"/insurance-vendor/analytics">) {
  const ctx = await requireInsurer({ perm: "analytics.view" });
  const sp = await searchParams;
  const range = resolveInsRange({ range: strParam(sp.range), from: strParam(sp.from), to: strParam(sp.to) });
  const settings = await insuranceSettings();
  const r = await getInsAnalytics(ctx.vendor, range, { renewalWindowDays: settings.renewalWindowDays });
  const k = r.kpis;
  const bucketWord = r.bucket === "day" ? "Daily" : r.bucket === "week" ? "Weekly" : "Monthly";
  const maxViews = Math.max(1, ...r.products.map((p) => p.views));
  const maxCampaign = Math.max(1, ...r.campaigns.map((c) => c.views));
  const maxAd = Math.max(1, ...r.ads.map((a) => a.impressions));
  const totalSpend = r.adSpend.reduce((s, m) => s + m.invoiced, 0);

  return (
    <>
      <ChartStyles />
      <PortalHeader
        title="Analytics"
        description={
          <>
            {range.label} · {range.days} days, IST · compared with {range.prevLabel}
          </>
        }
      />
      <InsAnalyticsToolbar key={`${range.preset}-${range.from}-${range.to}`} range={range} />
      {range.error && <p className="-mt-3 mb-6 border-l-[3px] border-red bg-red-50 px-4 py-2.5 text-[13px] text-red">{range.error} Showing the last 90 days instead.</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Enquiries" value={n(k.enquiries.value)} m={k.enquiries} />
        <Tile label="Quotes sent" value={n(k.quotesSent.value)} m={k.quotesSent} note={`${n(k.accepted.value)} marked interested`} />
        <Tile label="Quote acceptance" value={fmtPct(r.rates.quoteAcceptance.value)} m={r.rates.quoteAcceptance} rate note="Interested ÷ quotes sent" />
        <Tile label="Conversion (reported)" value={fmtPct(r.rates.conversion.value)} m={r.rates.conversion} rate note="This period's enquiries now policy issued" />
        <Tile label="Policies issued — reported" value={n(k.policiesReported.value)} m={k.policiesReported} note="Reported by your team" />
        <Tile label="Verified by MarchGear" value={n(k.policiesVerified.value)} m={k.policiesVerified} note={`of ${n(k.policiesReported.value)} reported in this period`} />
        <Tile label="Renewal rate" value={r.renewals.due ? fmtPct(r.rates.renewal.value) : "—"} m={r.rates.renewal} rate note={`${r.renewals.renewed} of ${r.renewals.due} policies due were renewed`} />
        <Tile label="Product & provider views" value={n(k.productViews.value + k.providerViews.value)} m={{ value: k.productViews.value + k.providerViews.value, prev: k.productViews.prev + k.providerViews.prev }} note={`${n(k.productViews.value)} product · ${n(k.providerViews.value)} provider`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Enquiries trend">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12.5px] font-medium text-muted">Enquiries received</p>
              <p className="mt-1 font-display text-[28px] font-semibold leading-none tracking-[-0.03em] num">{n(k.enquiries.value)}</p>
            </div>
            <p className="text-[12.5px] text-muted num">{n(k.enquiries.prev)} in the previous period</p>
          </div>
          <ColumnChart
            unit="Enquiries"
            points={r.series.map((p, i) => ({
              key: p.date,
              label: r.bucket === "month" ? monthTick(p.label, i) : p.label.split(" – ")[0],
              title: p.label,
              value: p.enquiries,
              extra: [
                ["Quotes sent", n(p.quotes)],
                ["Policies reported", n(p.policies)],
              ],
            }))}
          />
          <p className="mt-3 text-[12px] text-muted">{bucketWord} totals in IST. Hover a column for quotes sent and policies reported in the same period.</p>
        </Panel>
        <Panel title="Conversion funnel">
          <Funnel stages={r.funnel} />
          <p className="mt-5 text-[12px] leading-relaxed text-muted">
            Enquiries received in this period and how far each has got; % is the share of the step before. “Policy issued” is reported by your team; MarchGear verifies conversions separately.
          </p>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Enquiries by source">
          <Bars items={r.sources} empty="No enquiries in this period." tone="red" />
        </Panel>
        <Panel title="Enquiries by city">
          <Bars items={r.cities} empty="No enquiries in this period." />
        </Panel>
        <Panel title="Quote outcomes" className="lg:col-span-2 xl:col-span-1">
          {k.quotesSent.value ? (
            <>
              <ul className="space-y-3">
                {r.quoteOutcomes.map((o) => (
                  <li key={o.key} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)] items-center gap-3 text-[13px]">
                    <span className="truncate text-ink/80">{o.label}</span>
                    <InlineBar value={o.value} max={Math.max(1, k.quotesSent.value)} tone={o.key === "accepted" ? "red" : "ink"} />
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[12px] text-muted">Of the {n(k.quotesSent.value)} quotes sent in this period. A quote counts as interested when the customer says so on their quote page.</p>
            </>
          ) : (
            <p className="py-8 text-center text-[13.5px] text-muted">No quotes sent in this period.</p>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Renewal pipeline">
          <div className="mb-5 grid grid-cols-3 gap-3">
            {(
              [
                ["Due in period", r.renewals.due],
                ["Renewed", r.renewals.renewed],
                [`Coming up · ${r.renewals.windowDays} days`, r.renewals.upcoming],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="border border-line p-3.5">
                <p className="font-display text-[22px] font-semibold leading-none tracking-[-0.02em] num">{n(value)}</p>
                <p className="mt-1.5 text-[11.5px] leading-snug text-muted">{label}</p>
              </div>
            ))}
          </div>
          <Bars items={r.renewals.pipeline.filter((s) => s.value > 0)} empty="No renewals due in this period or coming up." />
          <p className="mt-4 text-[12px] text-muted">
            Renewals expiring in this period plus open ones expiring within your {r.renewals.windowDays}-day renewal window. Renewal rate = renewed ÷ policies that expired in the period.
          </p>
        </Panel>
        <Panel title="Views on MarchGear">
          <Bars items={r.views} empty="No views of your products or provider page in this period." tone="red" />
          <p className="mt-4 text-[12px] text-muted">Counted on marchgear.in when customers open your provider or product pages, see your products in quote results, compare them or open your quote links.</p>
        </Panel>
      </div>

      <h2 className="mb-3 mt-10 text-[15px] font-semibold">Products</h2>
      <Table>
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>Page views</Th>
            <Th className="text-right">In quote results</Th>
            <Th className="text-right">Enquiries</Th>
            <Th className="text-right">Quotes sent</Th>
            <Th className="text-right">Policies (reported)</Th>
            <Th className="text-right">Views → enquiry</Th>
          </tr>
        </thead>
        <tbody>
          {r.products.length === 0 && <EmptyRow colSpan={7}>No product views or enquiries in this period.</EmptyRow>}
          {r.products.map((p) => (
            <tr key={p.id}>
              <Td>
                <p className="font-medium">{p.name}</p>
                <p className="text-[12px] text-muted">{p.status}</p>
              </Td>
              <Td>
                <InlineBar value={p.views} max={maxViews} />
              </Td>
              <Td className="text-right num">{n(p.listings)}</Td>
              <Td className="text-right font-semibold num">{n(p.enquiries)}</Td>
              <Td className="text-right num">{n(p.quotes)}</Td>
              <Td className="text-right num">{n(p.policies)}</Td>
              <Td className="text-right text-muted num">{p.views ? fmtPct(pct(p.enquiries, p.views)) : "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <h2 className="mb-3 mt-10 text-[15px] font-semibold">Promotional campaigns</h2>
      <Table>
        <thead>
          <tr>
            <Th>Campaign</Th>
            <Th>Status</Th>
            <Th>Views</Th>
            <Th className="text-right">Clicks</Th>
            <Th className="text-right">Enquiries</Th>
            <Th className="text-right">Policies (reported)</Th>
          </tr>
        </thead>
        <tbody>
          {r.campaigns.length === 0 && <EmptyRow colSpan={6}>No campaign activity in this period.</EmptyRow>}
          {r.campaigns.map((c) => (
            <tr key={c.id}>
              <Td>
                <p className="font-medium">{c.title}</p>
                <p className="font-mono text-[11.5px] text-muted">{c.reference}</p>
              </Td>
              <Td>
                <Badge tone={c.status === "Active" ? "green" : "neutral"}>{c.status}</Badge>
              </Td>
              <Td>
                <InlineBar value={c.views} max={maxCampaign} tone="red" />
              </Td>
              <Td className="text-right num">{n(c.clicks)}</Td>
              <Td className="text-right font-semibold num">{n(c.enquiries)}</Td>
              <Td className="text-right num">{n(c.policies)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <h2 className="mb-3 mt-10 text-[15px] font-semibold">Advertising</h2>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Ad impressions" value={n(k.adImpressions.value)} m={k.adImpressions} />
        <Tile label="Ad clicks" value={n(k.adClicks.value)} m={k.adClicks} />
        <Tile label="Click-through rate" value={`${r.rates.adCtr.value.toFixed(2)}%`} m={r.rates.adCtr} rate />
        <Tile label="Ad spend invoiced" value={rupees(totalSpend)} note="Incl. GST, by billing period start" />
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Ad campaign</Th>
            <Th>Status</Th>
            <Th>Impressions</Th>
            <Th className="text-right">Clicks</Th>
            <Th className="text-right">CTR</Th>
            <Th className="text-right">Enquiries</Th>
            <Th className="text-right">Booking (incl. GST)</Th>
          </tr>
        </thead>
        <tbody>
          {r.ads.length === 0 && <EmptyRow colSpan={7}>No ad campaigns ran in this period.</EmptyRow>}
          {r.ads.map((a) => (
            <tr key={a.id}>
              <Td>
                <p className="font-medium">{a.name}</p>
                <p className="text-[12px] text-muted">
                  <span className="font-mono">{a.reference}</span> · {a.placement}
                </p>
              </Td>
              <Td>
                <Badge tone={a.status === "Live" ? "green" : a.status === "Scheduled" ? "blue" : "neutral"}>{a.status}</Badge>
              </Td>
              <Td>
                <InlineBar value={a.impressions} max={maxAd}>
                  {n(a.impressions)}
                </InlineBar>
              </Td>
              <Td className="text-right num">{n(a.clicks)}</Td>
              <Td className="text-right num">{a.impressions ? `${a.ctr.toFixed(2)}%` : "—"}</Td>
              <Td className="text-right font-semibold num">{n(a.enquiries)}</Td>
              <Td className="text-right num">{a.spend ? rupees(a.spend) : "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className="mt-6">
        <Panel title="Monthly ad spend">
          {totalSpend ? (
            <ColumnChart
              unit="Invoiced"
              tone="ink"
              height={200}
              money
              points={r.adSpend.map((m, i) => ({ key: m.month, label: monthTick(m.label, i), title: m.label, value: m.invoiced, extra: [["Paid", rupees(m.paid)]] }))}
            />
          ) : (
            <p className="py-8 text-center text-[13.5px] text-muted">No advertising invoices in this period.</p>
          )}
          <p className="mt-3 text-[12px] text-muted">Advertising invoices (incl. GST) by the month their period starts. Paid = payments MarchGear has verified.</p>
        </Panel>
      </div>
    </>
  );
}
