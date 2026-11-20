import type { Metadata } from "next";
import Link from "next/link";
import { INS_PRODUCT_CATEGORY_LABEL, INS_RENEWAL_STATUS_LABEL, AD_STATUS_LABEL, adDisplayStatus, INS_CAMPAIGN_STATUS_LABEL, campaignDisplayStatus } from "@/insurance/labels";
import type { InsProductCategory } from "@/db/enums";
import { requireStaff } from "@/server/auth";
import { dayRange, getInsReports, type DayRange } from "@/server/admin/insurance-ops";
import { AdminHeader, filterInput, formatDay, hrefWith, strParam } from "@/components/admin/ui";
import { LinkTabs } from "@/components/admin/partner-ui";
import { Funnel } from "@/components/portal/analytics/charts";
import { istDate, rupees } from "@/components/portal/billing/shared";
import { FactGrid, Notice } from "@/components/admin/insurance/ops/kit";
import { sourceLabel } from "@/components/admin/insurance/ops/labels";
import { CountTable, ReportSection, ReportTable, cell, pct } from "@/components/admin/insurance/reports/kit";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Insurance analytics & reports" };

const BASE = "/admin/insurance/reports";
const PRESETS = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", fy: "This financial year", all: "All time" } as const;
type Preset = keyof typeof PRESETS | "custom";

function presetRange(p: Preset, custom: DayRange, today: string): DayRange {
  const back = (d: number) => new Date(Date.parse(`${today}T00:00:00Z`) - (d - 1) * 86_400_000).toISOString().slice(0, 10);
  if (p === "custom") return custom;
  if (p === "all") return {};
  if (p === "fy") {
    const y = Number(today.slice(0, 4));
    return { from: `${Number(today.slice(5, 7)) >= 4 ? y : y - 1}-04-01`, to: today };
  }
  return { from: back(Number(p)), to: today };
}

const catLabel = (k: string) => INS_PRODUCT_CATEGORY_LABEL[k as InsProductCategory] ?? "Product removed";
const hours = (h: number | null) => (h === null ? "—" : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${h.toFixed(1)} h` : `${Math.round(h / 24)} days`);

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const today = istDate();
  const custom = dayRange(strParam(sp.from), strParam(sp.to));
  const p = strParam(sp.range);
  const preset: Preset = custom.from || custom.to ? "custom" : p && p in PRESETS ? (p as Preset) : "30";
  const range = presetRange(preset, custom, today);
  const r = await getInsReports(range);
  const params = { from: range.from, to: range.to, ...(preset === "all" ? { range: "all" } : {}) };
  const label = preset === "custom" ? `${range.from ? formatDay(range.from) : "Start"} – ${range.to ? formatDay(range.to) : "today"}` : PRESETS[preset];
  const q = r.quotes;
  const decided = q.accepted + q.declined;
  const adTotals = r.ads.reduce((s, a) => ({ i: s.i + a.impressions, c: s.c + a.clicks, e: s.e + a.enquiries }), { i: 0, c: 0, e: 0 });
  const now = new Date();

  return (
    <>
      <AdminHeader title="Analytics & reports" description={`Marketplace-wide insurance performance · ${label}. Policy conversions are shown twice on purpose: as reported by vendors, and as verified by MarchGear.`} />

      <LinkTabs
        className="mb-3"
        active={preset}
        items={[
          ...(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => ({ key: k, label: PRESETS[k], href: hrefWith(BASE, {}, { range: k === "30" ? undefined : k }) })),
          ...(preset === "custom" ? [{ key: "custom", label: "Custom", href: hrefWith(BASE, { from: range.from, to: range.to }, {}) }] : []),
        ]}
      />
      <form method="get" className="mb-6 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="basis-full text-muted sm:basis-auto">Custom range (IST)</span>
        <input type="date" name="from" defaultValue={custom.from} aria-label="From" className={cn(filterInput, "min-w-0 flex-1 sm:w-[150px] sm:flex-none")} />
        <span className="text-muted">to</span>
        <input type="date" name="to" defaultValue={custom.to} aria-label="To" className={cn(filterInput, "min-w-0 flex-1 sm:w-[150px] sm:flex-none")} />
        <button type="submit" className="inline-flex h-10 items-center rounded-[3px] bg-ink px-4 text-[13px] font-medium text-white hover:bg-ink-3">
          Apply
        </button>
      </form>

      <FactGrid
        cols={4}
        className="mb-6"
        items={[
          ["Enquiries", r.funnel.enquiries.toLocaleString("en-IN")],
          ["Quoted", `${r.funnel.quoted.toLocaleString("en-IN")} · ${pct(r.funnel.quoted, r.funnel.enquiries)}`],
          ["Policies reported by vendors", r.funnel.reported.toLocaleString("en-IN")],
          ["Verified by MarchGear", `${r.funnel.verified.toLocaleString("en-IN")} · ${pct(r.funnel.verified, r.funnel.reported)} of reported`],
        ]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ReportSection id="funnel" title="Conversion funnel" note="Enquiries received in the period and how far each got." exportKey="funnel" params={params}>
          <div className="p-5">
            <Funnel
              stages={[
                { key: "enquiries", label: "Enquiries", value: r.funnel.enquiries },
                { key: "quoted", label: "Quote sent", value: r.funnel.quoted },
                { key: "interested", label: "Customer interested", value: r.funnel.interested },
                { key: "reported", label: "Policy reported by vendor", value: r.funnel.reported },
                { key: "verified", label: "Verified by MarchGear", value: r.funnel.verified },
              ]}
            />
            <p className="mt-4 text-[12px] text-muted">“Reported” is the vendor&apos;s claim; only “Verified” has been checked by MarchGear staff.</p>
          </div>
        </ReportSection>

        <ReportSection id="quotes" title="Quote acceptance" note="Quotes created in the period (drafts excluded)." exportKey="quotes" params={params}>
          <div className="space-y-4 p-5">
            <FactGrid
              cols={3}
              items={[
                ["Sent", q.sent],
                ["Viewed by the customer", `${q.viewed} · ${pct(q.viewed, q.sent)}`],
                ["Customer interested", `${q.accepted} · ${pct(q.accepted, q.sent)}`],
                ["Declined", q.declined],
                ["Expired unanswered", q.expired],
                ["Withdrawn", q.withdrawn],
              ]}
            />
            <p className="text-[13px]">
              Acceptance among answered quotes: <span className="font-semibold num">{pct(q.accepted, decided)}</span>
              <span className="text-muted"> · {q.open} still open</span>
            </p>
          </div>
        </ReportSection>

        <ReportSection id="vendors" title="Enquiries by vendor" exportKey="vendors" params={params}>
          <CountTable rows={r.byVendor.map((x) => ({ ...x, total: x.total }))} first="Vendor" empty="No enquiries in this period." />
        </ReportSection>

        <ReportSection id="products" title="Enquiries by product" exportKey="products" params={params}>
          <CountTable rows={r.byProduct} first="Product" empty="No enquiries in this period." />
        </ReportSection>

        <ReportSection id="categories" title="Enquiries by product category" exportKey="categories" params={params}>
          <CountTable rows={r.byCategory.map((x) => ({ ...x, label: catLabel(x.key) }))} first="Category" empty="No enquiries in this period." />
        </ReportSection>

        <ReportSection id="cities" title="Enquiries by city" exportKey="cities" params={params}>
          <CountTable rows={r.byCity} first="City" empty="No enquiries in this period." />
        </ReportSection>

        <ReportSection id="sources" title="Enquiries by source" note="Where on the public site the request was sent from." exportKey="sources" params={params}>
          <CountTable rows={r.bySource.map((x) => ({ ...x, label: sourceLabel(x.key) }))} first="Source" empty="No enquiries in this period." />
        </ReportSection>

        <ReportSection id="renewals" title="Renewals pipeline" note={`Open renewals today (${r.pipeline.open}) · ${r.pipeline.renewedInRange} renewed in the period.`} exportKey="renewals" params={params}>
          <div className="grid gap-6 p-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[12px] font-medium text-muted">Open, by expiry</p>
              <ul className="space-y-1.5 text-[13px]">
                {r.pipeline.buckets.map((b) => (
                  <li key={b.key} className="flex justify-between gap-3">
                    <Link href={b.key === "later" ? "/admin/insurance/renewals" : `/admin/insurance/renewals?due=${b.key}`} className={cn("hover:text-red", b.key === "expired" && b.n && "font-medium text-red")}>
                      {b.label}
                    </Link>
                    <span className="font-semibold num">{b.n}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-[12px] font-medium text-muted">All renewals, by status</p>
              <ul className="space-y-1.5 text-[13px]">
                {r.pipeline.byStatus.map((b) => (
                  <li key={b.status} className="flex justify-between gap-3">
                    <span>{INS_RENEWAL_STATUS_LABEL[b.status]}</span>
                    <span className="font-semibold num">{b.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ReportSection>
      </div>

      <div className="mt-6 space-y-6">
        <ReportSection id="promotions" title="Promotional campaign performance" note="Views and clicks from the insurance pages; enquiries attributed to each campaign." exportKey="promotions" params={params}>
          {r.promotions.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13.5px] text-muted">No campaign activity in this period.</p>
          ) : (
            <ReportTable head={[{ label: "Campaign" }, { label: "Status" }, { label: "Views", right: true }, { label: "Clicks", right: true }, { label: "CTR", right: true }, { label: "Enquiries", right: true }, { label: "Policies", right: true, title: "Reported or verified" }]} minWidth={760}>
              {r.promotions.map((c) => (
                <tr key={c.id}>
                  <td className={cn(cell, "max-w-[280px]")}>
                    <Link href={`/admin/insurance/campaigns/${c.id}`} className="block truncate font-medium hover:text-red">
                      {c.title}
                    </Link>
                    <span className="block truncate text-[11.5px] text-muted">
                      {c.vendor} · <span className="num">{c.reference}</span>
                    </span>
                  </td>
                  <td className={cn(cell, "text-[12.5px]")}>{INS_CAMPAIGN_STATUS_LABEL[campaignDisplayStatus(c, now)]}</td>
                  <td className={cn(cell, "text-right num")}>{c.views.toLocaleString("en-IN")}</td>
                  <td className={cn(cell, "text-right num")}>{c.clicks.toLocaleString("en-IN")}</td>
                  <td className={cn(cell, "text-right num")}>{pct(c.clicks, c.views)}</td>
                  <td className={cn(cell, "text-right font-semibold num")}>{c.enquiries}</td>
                  <td className={cn(cell, "text-right num")}>{c.policies}</td>
                </tr>
              ))}
            </ReportTable>
          )}
        </ReportSection>

        <ReportSection
          id="ads"
          title="Ad performance"
          note={
            <>
              Paid placements ({adTotals.i.toLocaleString("en-IN")} impressions · {pct(adTotals.c, adTotals.i)} CTR · {adTotals.e} enquiries). Manage them in{" "}
              <Link href="/admin/advertising" className="font-medium text-red hover:underline">
                Advertising
              </Link>
              .
            </>
          }
          exportKey="ads"
          params={params}
        >
          {r.ads.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13.5px] text-muted">No ad impressions recorded in this period.</p>
          ) : (
            <ReportTable head={[{ label: "Ad campaign" }, { label: "Placement" }, { label: "Status" }, { label: "Impressions", right: true }, { label: "Clicks", right: true }, { label: "CTR", right: true }, { label: "Enquiries", right: true }]} minWidth={820}>
              {r.ads.map((a) => (
                <tr key={a.id}>
                  <td className={cn(cell, "max-w-[260px]")}>
                    <span className="block truncate font-medium">{a.name}</span>
                    <span className="block truncate text-[11.5px] text-muted">
                      {a.advertiser} · <span className="num">{a.reference}</span>
                    </span>
                  </td>
                  <td className={cn(cell, "text-[12.5px]")}>{a.placement}</td>
                  <td className={cn(cell, "text-[12.5px]")}>{AD_STATUS_LABEL[adDisplayStatus(a, today)]}</td>
                  <td className={cn(cell, "text-right num")}>{a.impressions.toLocaleString("en-IN")}</td>
                  <td className={cn(cell, "text-right num")}>{a.clicks.toLocaleString("en-IN")}</td>
                  <td className={cn(cell, "text-right num")}>{pct(a.clicks, a.impressions)}</td>
                  <td className={cn(cell, "text-right font-semibold num")}>{a.enquiries}</td>
                </tr>
              ))}
            </ReportTable>
          )}
        </ReportSection>

        <ReportSection id="league" title="Vendor league table" note="Ranked by verified conversions, then reported conversions and enquiries. Response time is the median from enquiry to first quote sent." exportKey="league" params={params}>
          {r.league.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13.5px] text-muted">No vendor activity in this period.</p>
          ) : (
            <ReportTable
              head={[
                { label: "#" },
                { label: "Vendor" },
                { label: "Enquiries", right: true },
                { label: "Quoted", right: true },
                { label: "Accepted", right: true, title: "Quotes the customer was interested in" },
                { label: "Reported", right: true, title: "Policies reported by the vendor" },
                { label: "Verified", right: true, title: "Verified by MarchGear" },
                { label: "Response", right: true },
                { label: "Collected", right: true, title: "Verified payments − refunds in the period" },
              ]}
              minWidth={900}
            >
              {r.league.map((v, i) => (
                <tr key={v.id}>
                  <td className={cn(cell, "w-10 text-muted num")}>{i + 1}</td>
                  <td className={cn(cell, "max-w-[240px]")}>
                    <Link href={`/admin/insurance/vendors/${v.id}`} className="block truncate font-medium hover:text-red">
                      {v.name}
                    </Link>
                    <span className="text-[11.5px] text-muted num">{v.reference}</span>
                  </td>
                  <td className={cn(cell, "text-right num")}>{v.enquiries}</td>
                  <td className={cn(cell, "text-right num")}>
                    {v.quoted} <span className="text-[11.5px] text-muted">{pct(v.quoted, v.enquiries)}</span>
                  </td>
                  <td className={cn(cell, "text-right num")}>
                    {v.accepted} <span className="text-[11.5px] text-muted">of {v.quotesSent}</span>
                  </td>
                  <td className={cn(cell, "text-right num")}>{v.reported}</td>
                  <td className={cn(cell, "text-right font-semibold num")}>{v.verified}</td>
                  <td className={cn(cell, "text-right num")}>{hours(v.medianResponseHours)}</td>
                  <td className={cn(cell, "text-right num")}>{rupees(v.collected)}</td>
                </tr>
              ))}
            </ReportTable>
          )}
        </ReportSection>
      </div>

      {r.total >= 100_000 && <Notice tone="warn" className="mt-6">This range has more than 100,000 enquiries; figures cover the first 100,000. Narrow the range for exact numbers.</Notice>}
    </>
  );
}
