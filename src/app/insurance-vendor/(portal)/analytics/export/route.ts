import type { NextRequest } from "next/server";
import { getInsurerContext } from "@/server/insurance/context";
import { getInsAnalytics } from "@/server/insurance/analytics";
import { insuranceSettings } from "@/server/insurance/quote-builder";
import { logInsurerActivity } from "@/server/insurance/records";
import { HOUR, take } from "@/server/rate-limit";
import { formatIstDateTime } from "@/components/portal/crm/pipeline";
import { fmtPct, pct, resolveInsRange } from "@/components/insurance/vendor/analytics/report";

/*
 * GET /insurance-vendor/analytics/export?range=30|90|365|custom&from=&to=
 * The analytics view as CSV (UTF-8 with a BOM so Excel shows names and ₹ correctly).
 */

// Quote every cell; neutralise spreadsheet formulas (CSV injection). Plain numbers stay numbers.
const cell = (v: string | number | null | undefined) => {
  if (typeof v === "number") return String(Number.isInteger(v) ? v : Number(v.toFixed(2)));
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(req: NextRequest) {
  const ctx = await getInsurerContext();
  if (!ctx) return new Response("Please sign in to the insurance vendor portal.", { status: 401 });
  if (!ctx.approved || !ctx.can("analytics.view")) return new Response("You don't have access to analytics.", { status: 403 });
  if (!take(`ins-analytics-export:${ctx.user.id}`, 60, HOUR)) return new Response("Too many exports in a short time. Please wait a few minutes.", { status: 429 });

  const p = req.nextUrl.searchParams;
  const range = resolveInsRange({ range: p.get("range") ?? undefined, from: p.get("from") ?? undefined, to: p.get("to") ?? undefined });
  if (range.error) return new Response(range.error, { status: 400 });
  const settings = await insuranceSettings();
  const r = await getInsAnalytics(ctx.vendor, range, { renewalWindowDays: settings.renewalWindowDays });
  const k = r.kpis;

  const rows: (string | number)[][] = [];
  const section = (title: string, head: string[], body: (string | number)[][]) => rows.push([], [title], head, ...body);
  rows.push(["MarchGear insurance vendor analytics"], ["Vendor", `${r.vendor.name} (${r.vendor.reference})`], ["Period", `${range.from} to ${range.to} (${range.days} days, IST)`], ["Compared with", `${range.prevFrom} to ${range.prevTo}`], ["Generated", formatIstDateTime(r.generatedAt)]);
  section("Summary", ["Metric", "This period", "Previous period"], [
    ["Enquiries", k.enquiries.value, k.enquiries.prev],
    ["Quotes sent", k.quotesSent.value, k.quotesSent.prev],
    ["Quotes marked interested", k.accepted.value, k.accepted.prev],
    ["Quote acceptance rate (%)", r.rates.quoteAcceptance.value, r.rates.quoteAcceptance.prev],
    ["Policies issued - reported by vendor", k.policiesReported.value, k.policiesReported.prev],
    ["Policies verified by MarchGear", k.policiesVerified.value, k.policiesVerified.prev],
    ["Conversion rate - reported (%)", r.rates.conversion.value, r.rates.conversion.prev],
    ["Renewal rate (%)", r.rates.renewal.value, r.rates.renewal.prev],
    ["Product page views", k.productViews.value, k.productViews.prev],
    ["Provider page views", k.providerViews.value, k.providerViews.prev],
    ["Ad impressions", k.adImpressions.value, k.adImpressions.prev],
    ["Ad clicks", k.adClicks.value, k.adClicks.prev],
    ["Ad click-through rate (%)", r.rates.adCtr.value, r.rates.adCtr.prev],
  ]);
  section(`Trend (${r.bucket})`, ["From", "To", "Enquiries", "Quotes sent", "Policies reported"], r.series.map((s) => [s.date, s.end, s.enquiries, s.quotes, s.policies]));
  section("Conversion funnel", ["Stage", "Enquiries", "% of previous stage"], r.funnel.map((s, i) => [s.label, s.value, i ? fmtPct(pct(s.value, r.funnel[i - 1].value)) : ""]));
  section("Enquiries by source", ["Source", "Enquiries", "Share"], r.sources.map((s) => [s.label, s.value, fmtPct(pct(s.value, k.enquiries.value))]));
  section("Enquiries by city", ["City", "Enquiries", "Share"], r.cities.map((s) => [s.label, s.value, fmtPct(pct(s.value, k.enquiries.value))]));
  section("Quote outcomes", ["Outcome", "Quotes"], r.quoteOutcomes.map((o) => [o.label, o.value]));
  section("Renewal pipeline", ["Status", "Renewals"], [...r.renewals.pipeline.map((s) => [s.label, s.value] as [string, number]), ["Due in period", r.renewals.due], ["Renewed of those due", r.renewals.renewed], [`Coming up in ${r.renewals.windowDays} days`, r.renewals.upcoming]]);
  section("Views on MarchGear", ["Event", "Count"], r.views.map((v) => [v.label, v.value]));
  section("Products", ["Product", "Status", "Page views", "In quote results", "Enquiries", "Quotes sent", "Policies reported"], r.products.map((x) => [x.name, x.status, x.views, x.listings, x.enquiries, x.quotes, x.policies]));
  section("Promotional campaigns", ["Reference", "Campaign", "Status", "Views", "Clicks", "Enquiries", "Policies reported"], r.campaigns.map((c) => [c.reference, c.title, c.status, c.views, c.clicks, c.enquiries, c.policies]));
  section("Ad campaigns", ["Reference", "Campaign", "Placement", "Status", "Impressions", "Clicks", "CTR (%)", "Enquiries", "Booking incl. GST (Rs)"], r.ads.map((a) => [a.reference, a.name, a.placement, a.status, a.impressions, a.clicks, Number(a.ctr.toFixed(2)), a.enquiries, a.spend]));
  section("Monthly ad spend", ["Month", "Invoiced incl. GST (Rs)", "Paid (Rs)"], r.adSpend.map((m) => [m.label, m.invoiced, m.paid]));

  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "export", "analytics", null, `Exported analytics (CSV) for ${range.label}`);
  const body = `﻿${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="marchgear-insurance-analytics-${range.from}-to-${range.to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
