import type { Metadata } from "next";
import { ArrowDownRight, ArrowUpRight, Minus, MousePointerClick, Navigation, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { requirePartner } from "@/server/partner/context";
import { getAnalyticsReport } from "@/server/partner/analytics";
import { Panel, PortalHeader, Table, Td, Th, EmptyRow, Badge, strParam } from "@/components/portal/ui";
import { AnalyticsToolbar } from "@/components/portal/analytics/toolbar";
import { ChartStyles, Donut, Funnel, InlineBar, TrendPanel } from "@/components/portal/analytics/charts";
import { METRICS, delta, fmtDuration, fmtPct, pct, resolveRange, type Metric, type MetricKey } from "@/components/portal/analytics/report";

export const metadata: Metadata = { title: "Analytics" };

function Delta({ m, compare, rate, bare }: { m: Metric; compare: boolean; rate?: boolean; bare?: boolean }) {
  if (!compare) return null;
  const d = rate ? (m.prev || m.value ? { pct: m.value - m.prev, up: m.value >= m.prev } : null) : delta(m);
  if (!d) return <span className="inline-flex items-center gap-1 text-[12px] text-muted">No activity either period</span>;
  if (d.pct === null) return <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#1e7a3c]">New this period</span>;
  const flat = Math.abs(d.pct) < 0.05;
  const Icon = flat ? Minus : d.up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12px] font-medium num", flat ? "text-muted" : d.up ? "text-[#1e7a3c]" : "text-red")}>
      <Icon className="size-3.5" aria-hidden />
      {flat ? "No change" : `${d.up ? "+" : "−"}${Math.abs(d.pct).toFixed(1)}${rate ? " pts" : "%"}`}
      {!bare && <span className="font-normal text-muted">vs previous</span>}
    </span>
  );
}

function Tile({ k, m, compare, note }: { k: MetricKey; m: Metric; compare: boolean; note?: string }) {
  return (
    <div className="border border-line bg-white p-5 transition-colors duration-500 hover:border-ink/25">
      <p className="text-[12.5px] font-medium text-muted">{METRICS[k]}</p>
      <p className="mt-3 font-display text-[30px] font-semibold leading-none tracking-[-0.03em] num">{m.value.toLocaleString("en-IN")}</p>
      <div className="mt-3 min-h-[18px] space-y-1">
        <Delta m={m} compare={compare} />
        {note && <p className="text-[12px] text-muted">{note}</p>}
      </div>
    </div>
  );
}

export default async function Page({ searchParams }: PageProps<"/dealer/analytics">) {
  const ctx = await requirePartner({ perm: "analytics.view" });
  const sp = await searchParams;
  const range = resolveRange({ range: strParam(sp.range), from: strParam(sp.from), to: strParam(sp.to) });
  const compare = strParam(sp.compare) !== "0";
  const p = ctx.partner;
  const name = p.tradeName || p.legalName || p.application.business.tradeName || p.application.business.legalName || "Your dealership";
  const r = await getAnalyticsReport(p, range, name);
  const t = r.totals;
  const maxVehicleViews = Math.max(1, ...r.vehicles.map((v) => v.views));
  const maxCampaignViews = Math.max(1, ...r.campaigns.map((c) => c.views));
  const clicks = r.clicks.phone + r.clicks.whatsapp + r.clicks.directions;

  return (
    <>
      <ChartStyles />
      <PortalHeader
        title="Analytics"
        description={
          <>
            {range.label} · {range.days} days, IST{compare ? <> · compared with {range.prevLabel}</> : null}
          </>
        }
      />
      <AnalyticsToolbar key={`${range.preset}-${range.from}-${range.to}-${compare}`} range={range} compare={compare} />
      {range.error && <p className="-mt-3 mb-6 border-l-[3px] border-red bg-red-50 px-4 py-2.5 text-[13px] text-red">{range.error} Showing the last 30 days instead.</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile k="profileViews" m={t.profileViews} compare={compare} />
        <Tile k="vehicleViews" m={t.vehicleViews} compare={compare} />
        <Tile k="offerViews" m={t.offerViews} compare={compare} />
        <Tile k="contactClicks" m={t.contactClicks} compare={compare} />
        <Tile k="vehicleEnquiries" m={t.vehicleEnquiries} compare={compare} note={`of ${t.enquiries.value} enquiries in all`} />
        <Tile k="offerEnquiries" m={t.offerEnquiries} compare={compare} />
        <Tile k="leadConversions" m={t.leadConversions} compare={compare} note={`${fmtPct(r.rates.leadConversion.value)} of this period's enquiries`} />
        <Tile k="testDriveConversions" m={t.testDriveConversions} compare={compare} note={`${fmtPct(r.rates.testDriveConversion.value)} of ${t.testDrivesCompleted.value} completed test drives`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Trend">
          <TrendPanel series={r.series} compare={compare} prevFrom={range.prevFrom} bucket={r.bucket} />
          <p className="mt-3 text-[12px] text-muted">{r.bucket === "day" ? "Daily" : "Weekly"} totals. Views are counted on marchgear.in each time your profile, a vehicle or an offer page is opened.</p>
        </Panel>
        <Panel title="Lead funnel">
          <Funnel stages={r.funnel} />
          <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5 text-center">
            <div>
              <dt className="text-[11.5px] text-muted">Views → enquiry</dt>
              <dd className="mt-1 text-[16px] font-semibold num">{fmtPct(r.rates.viewToEnquiry.value)}</dd>
            </div>
            <div>
              <dt className="text-[11.5px] text-muted">Lead conversion</dt>
              <dd className="mt-1 text-[16px] font-semibold num">{fmtPct(r.rates.leadConversion.value)}</dd>
              <dd className="mt-0.5">
                <Delta m={r.rates.leadConversion} compare={compare} rate bare />
              </dd>
            </div>
            <div>
              <dt className="text-[11.5px] text-muted">Test drive → won</dt>
              <dd className="mt-1 text-[16px] font-semibold num">{fmtPct(r.rates.testDriveConversion.value)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[12px] text-muted">Enquiries received in this period and how far each has got so far; % is the share of the step before. Won = booking completed or converted.</p>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Enquiries by source">
          <Donut items={r.sources} />
        </Panel>
        <Panel title="Contact clicks on your listings">
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["Calls", r.clicks.phone, Phone],
                ["WhatsApp", r.clicks.whatsapp, MousePointerClick],
                ["Directions", r.clicks.directions, Navigation],
              ] as const
            ).map(([label, value, Icon]) => (
              <div key={label} className="border border-line p-4">
                <Icon className="size-4 text-red" aria-hidden />
                <p className="mt-3 font-display text-[24px] font-semibold leading-none tracking-[-0.02em] num">{value}</p>
                <p className="mt-1.5 text-[12px] text-muted">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {(
              [
                ["Calls", r.clicks.phone],
                ["WhatsApp", r.clicks.whatsapp],
                ["Directions", r.clicks.directions],
              ] as const
            ).map(([label, v]) => (
              <div key={label} className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 text-[13px]">
                <span className="text-muted">{label}</span>
                <InlineBar value={v} max={Math.max(1, clicks)}>
                  {fmtPct(pct(v, clicks))}
                </InlineBar>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <h2 className="mb-3 mt-10 text-[15px] font-semibold">Popular vehicles</h2>
      <Table>
        <thead>
          <tr>
            <Th>Vehicle</Th>
            <Th>Status</Th>
            <Th>Views</Th>
            <Th className="text-right">Enquiries</Th>
            <Th className="text-right">Won</Th>
            <Th className="text-right">Enquiry rate</Th>
          </tr>
        </thead>
        <tbody>
          {r.vehicles.length === 0 && <EmptyRow colSpan={6}>No vehicle views or enquiries in this period.</EmptyRow>}
          {r.vehicles.map((v) => (
            <tr key={v.id}>
              <Td>
                <p className="font-medium">{v.label}</p>
                <p className="text-[12px] text-muted">
                  <span className="num">{v.reference}</span> · {v.kind}
                </p>
              </Td>
              <Td>
                <Badge tone={v.status === "Published" ? "dark" : "neutral"}>{v.status}</Badge>
              </Td>
              <Td>
                <InlineBar value={v.views} max={maxVehicleViews} />
              </Td>
              <Td className="text-right font-semibold num">{v.enquiries}</Td>
              <Td className="text-right num">{v.won}</Td>
              <Td className="text-right text-muted num">{v.views ? fmtPct(pct(v.enquiries, v.views)) : "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <h2 className="mb-3 mt-10 text-[15px] font-semibold">Best-performing campaigns</h2>
      <Table>
        <thead>
          <tr>
            <Th>Offer</Th>
            <Th>Status</Th>
            <Th>Views</Th>
            <Th className="text-right">Enquiries</Th>
            <Th className="text-right">Won</Th>
            <Th className="text-right">Conversion</Th>
          </tr>
        </thead>
        <tbody>
          {r.campaigns.length === 0 && <EmptyRow colSpan={6}>No offer views or enquiries in this period.</EmptyRow>}
          {r.campaigns.map((c, i) => (
            <tr key={c.id}>
              <Td>
                <p className="flex items-center gap-2 font-medium">
                  {i === 0 && c.won + c.enquiries > 0 && <span className="rounded-full bg-red px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white">Top</span>}
                  {c.title}
                </p>
                <p className="text-[12px] text-muted">
                  {c.campaign} · <span className="num">{c.reference}</span>
                </p>
              </Td>
              <Td>
                <Badge tone={c.status === "Active" ? "green" : c.status === "Expired" ? "neutral" : "blue"}>{c.status}</Badge>
              </Td>
              <Td>
                <InlineBar value={c.views} max={maxCampaignViews} tone="red" />
              </Td>
              <Td className="text-right font-semibold num">{c.enquiries}</Td>
              <Td className="text-right num">{c.won}</Td>
              <Td className="text-right text-muted num">{c.enquiries ? fmtPct(pct(c.won, c.enquiries)) : "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <h2 className="mb-3 mt-10 text-[15px] font-semibold">Sales team performance</h2>
      <Table>
        <thead>
          <tr>
            <Th>Team member</Th>
            <Th className="text-right">Assigned</Th>
            <Th className="text-right">Contacted</Th>
            <Th className="text-right">Converted</Th>
            <Th>Conversion</Th>
            <Th className="text-right">Avg first response</Th>
          </tr>
        </thead>
        <tbody>
          {r.team.length === 0 && <EmptyRow colSpan={6}>No enquiries were assigned in this period.</EmptyRow>}
          {r.team.map((m) => (
            <tr key={m.memberId ?? "none"}>
              <Td>
                <p className="font-medium">{m.name}</p>
                <p className="text-[12px] text-muted">{m.role}</p>
              </Td>
              <Td className="text-right font-semibold num">{m.assigned}</Td>
              <Td className="text-right num">
                {m.contacted}
                {m.assigned > 0 && <span className="ml-1 text-[12px] text-muted">({fmtPct(pct(m.contacted, m.assigned))})</span>}
              </Td>
              <Td className="text-right num">{m.converted}</Td>
              <Td>
                <InlineBar value={m.assigned ? pct(m.converted, m.assigned) : 0} max={100}>
                  {m.assigned ? fmtPct(pct(m.converted, m.assigned)) : "—"}
                </InlineBar>
              </Td>
              <Td className="text-right num">
                {fmtDuration(m.avgResponseMins)}
                {m.responded > 0 && <span className="block text-[11.5px] text-muted">over {m.responded} lead{m.responded === 1 ? "" : "s"}</span>}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-3 text-[12px] text-muted">
        First response = time from an enquiry arriving to the first call, message, note or status change logged by your team in the CRM.
      </p>
    </>
  );
}
