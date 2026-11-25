import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { INDICATIVE_NOTE, INS_QUOTE_AUTH_LABEL, quoteDisplayStatus } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { getInsQuote, quoteFlags } from "@/server/admin/insurance-ops";
import { vendorName } from "@/server/insurance/context";
import { AdminHeader, Panel, formatDateTime, formatDay } from "@/components/admin/ui";
import { Facts } from "@/components/admin/partner-ui";
import { istDate, rupees } from "@/components/portal/billing/shared";
import { AuthPill, Notice, QuotePill, TitlePills } from "@/components/admin/insurance/ops/kit";
import { DEVIATION_LIMIT, pctLabel } from "@/components/admin/insurance/ops/labels";
import { WithdrawQuoteButton } from "@/components/admin/insurance/ops/actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Quote" };

function Line({ label, value, note, strong, negative }: { label: string; value: number; note?: string; strong?: boolean; negative?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-6 py-2.5", strong && "border-t border-ink pt-3 text-[15px] font-semibold")}>
      <dt className={cn("min-w-0", !strong && "text-muted")}>
        {label}
        {note && <span className="block text-[11.5px] text-muted">{note}</span>}
      </dt>
      <dd className={cn("shrink-0 num", negative && "text-[#1e7a3c]")}>{negative && value ? `− ${rupees(Math.abs(value))}` : rupees(value)}</dd>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const data = /^\d{1,9}$/.test(id) ? await getInsQuote(Number(id)) : null;
  if (!data) notFound();
  const { q, v, e, events } = data;
  const today = istDate();
  const display = quoteDisplayStatus(q, today);
  const flags = quoteFlags({ ...q, indicative: e.indicativePremium }, today);
  const b = q.breakdown;
  const vendor = vendorName(v);
  const withdrawBlocked = q.status === "withdrawn" ? "Already withdrawn" : q.status === "declined" ? "The customer declined this quote" : undefined;

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/insurance/quotes", label: "Quote monitoring" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="num">{q.reference}</span>
            <TitlePills>
              <QuotePill status={display} />
              <AuthPill a={q.authorization} />
            </TitlePills>
          </span>
        }
        description={`For ${e.name} (${e.reference}) · ${vendor} · created ${formatDateTime(q.createdAt)}`}
        actions={q.status === "withdrawn" ? undefined : <WithdrawQuoteButton quoteId={q.id} reference={q.reference} disabled={withdrawBlocked} />}
      />

      <div className="mb-6 space-y-2">
        {flags.missingRef && (
          <Notice tone="danger" title="Insurer-authorised without the insurer's reference">
            This shouldn&apos;t happen — an insurer-authorised quotation must carry the insurer&apos;s own quotation reference.{" "}
            {q.status === "withdrawn" ? "It has been withdrawn." : "Withdraw it unless the vendor can supply one."}
          </Notice>
        )}
        {flags.deviation !== null && (
          <Notice tone="warn" title={`${pctLabel(flags.deviation)} against the indicative estimate`}>
            The customer was shown {rupees(e.indicativePremium ?? 0)}; this quote is {rupees(q.total)}. Quotes more than {Math.round(DEVIATION_LIMIT * 100)}% away are flagged for a compliance check.
          </Notice>
        )}
        {flags.expired && <Notice tone="info">This quote expired on {formatDay(q.validUntil)} without a response from the customer.</Notice>}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Premium breakdown">
            <p className="mb-3 text-[13px] font-medium">{INS_QUOTE_AUTH_LABEL[q.authorization]}</p>
            <dl className="divide-y divide-line text-[13.5px]">
              <Line label="Insured declared value (IDV)" value={q.idv} />
              <Line label="Own damage" note={b.odYears ? `${b.odYears} year${b.odYears > 1 ? "s" : ""}` : "Not covered"} value={b.od} />
              {b.ncbDiscount > 0 && <Line label={`No-claim bonus (${b.ncbPct}%)`} value={-b.ncbDiscount} negative />}
              {b.adjustment !== 0 && <Line label={b.adjustment < 0 ? "Vendor discount on own damage" : "Vendor loading on own damage"} value={b.adjustment} negative={b.adjustment < 0} />}
              <Line label="Third-party liability" note={b.tpYears ? `${b.tpYears} year${b.tpYears > 1 ? "s" : ""}` : "Not covered"} value={b.tp} />
              {b.pa > 0 && <Line label="Personal accident (owner-driver)" value={b.pa} />}
              {b.addOns.map((a) => (
                <Line key={`${a.key}-${a.coverId}`} label={a.name} note={a.included ? "Included in the product" : "Add-on"} value={a.premium} />
              ))}
              <Line label="Net premium" value={b.net} />
              <Line label={`GST (${b.gstPct}%)`} value={b.gst} />
              <Line label="Total payable" value={q.total} strong />
            </dl>
            {b.total !== q.total && <p className="mt-2 text-[12px] text-[#9a5b00]">The stored breakdown totals {rupees(b.total)}, which differs from the quote total.</p>}
            {b.deductible > 0 && <p className="mt-3 text-[12.5px] text-muted">Compulsory deductible {rupees(b.deductible)} per claim.</p>}
            {b.notes.length > 0 && (
              <ul className="mt-3 list-disc space-y-0.5 pl-4 text-[12.5px] text-muted">
                {b.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            {q.authorization === "indicative" && <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-muted">{INDICATIVE_NOTE}</p>}
          </Panel>

          {q.coverage.length > 0 && (
            <Panel title="Coverage">
              <Facts rows={q.coverage.map((c) => [c.name, c.detail])} />
            </Panel>
          )}

          {(q.notes || q.terms) && (
            <Panel title="Notes & terms">
              {q.notes && <p className="whitespace-pre-line break-words text-[13.5px] leading-relaxed">{q.notes}</p>}
              {q.terms && <p className={cn("whitespace-pre-line break-words text-[12.5px] leading-relaxed text-muted", q.notes && "mt-4 border-t border-line pt-4")}>{q.terms}</p>}
            </Panel>
          )}

          <Panel title="Quote activity">
            {events.length === 0 ? (
              <p className="text-[13.5px] text-muted">No quote events on the enquiry timeline.</p>
            ) : (
              <ul className="divide-y divide-line">
                {events.map((ev) => (
                  <li key={ev.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="whitespace-pre-line break-words text-[13.5px]">{ev.body}</p>
                    <p className="mt-0.5 text-[11.5px] text-muted">
                      {ev.userName ?? "Customer / system"} · {formatDateTime(ev.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6">
          <Panel title="Customer link">
            <Link href={`/insurance/quote/${q.shareToken}`} target="_blank" className="flex items-center justify-between gap-3 border border-line px-4 py-3 text-[13.5px] transition-colors hover:border-ink">
              <span className="min-w-0 truncate font-medium">/insurance/quote/{q.shareToken.slice(0, 10)}…</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-red">
                Open <ExternalLink className="size-3.5" aria-hidden />
              </span>
            </Link>
            <Facts
              className="mt-3"
              rows={[
                ["Sent", q.submittedAt ? formatDateTime(q.submittedAt) : "Not sent yet"],
                ["First viewed", q.viewedAt ? formatDateTime(q.viewedAt) : "Not viewed"],
                ["Customer response", q.respondedAt ? `${q.status === "accepted" ? "Interested" : q.status === "declined" ? "Declined" : "Responded"} · ${formatDateTime(q.respondedAt)}` : null],
                ["Valid until", formatDay(q.validUntil)],
              ]}
            />
          </Panel>

          <Panel title="Against the estimate">
            <Facts
              rows={[
                ["Indicative estimate", e.indicativePremium ? rupees(e.indicativePremium) : "None shown"],
                ["This quote", rupees(q.total)],
                [
                  "Difference",
                  flags.deviationRaw === null ? null : <span className={flags.deviation !== null ? "font-semibold text-red" : undefined}>{pctLabel(flags.deviationRaw)}</span>,
                ],
                ["Insurer reference", q.insurerQuoteRef ? <span className="num">{q.insurerQuoteRef}</span> : q.authorization === "insurer_authorised" ? <span className="font-medium text-red">Missing</span> : "Not needed (indicative)"],
              ]}
            />
          </Panel>

          <Panel title="Context">
            <Facts
              rows={[
                [
                  "Enquiry",
                  <Link key="e" href={`/admin/insurance/enquiries/${e.id}`} className="hover:text-red">
                    {e.name} <span className="text-muted num">{e.reference}</span>
                  </Link>,
                ],
                [
                  "Vendor",
                  <Link key="v" href={`/admin/insurance/vendors/${v.id}`} className="hover:text-red">
                    {vendor}
                  </Link>,
                ],
                ["Product", data.productName],
                ["Insurer", data.companyName],
                ["Built by", data.author],
                ["Vehicle", [e.brandName, e.modelName, e.variantName, e.year].filter(Boolean).join(" ")],
              ]}
            />
          </Panel>
        </aside>
      </div>
    </>
  );
}
