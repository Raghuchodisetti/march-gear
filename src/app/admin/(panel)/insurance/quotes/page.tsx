import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, FileSignature } from "lucide-react";
import { INS_QUOTE_AUTHORIZATION } from "@/db/enums";
import { INS_QUOTE_AUTH_SHORT, INS_QUOTE_STATUS_LABEL } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { QUOTE_DISPLAY, dayRange, listInsQuotes, PAGE_SIZE, vendorLabel, vendorOptions } from "@/server/admin/insurance-ops";
import { AdminHeader, FilterForm, FilterSelect, Pagination, SearchInput, StatCard, Table, Td, Th, formatDay, pageParam, strParam } from "@/components/admin/ui";
import { rupees } from "@/components/portal/billing/shared";
import { AuthPill, DateRangeFields, EmptyBox, QuotePill, VendorLink } from "@/components/admin/insurance/ops/kit";
import { DEVIATION_LIMIT, QUOTE_FLAG_LABEL, pctLabel } from "@/components/admin/insurance/ops/labels";

export const metadata: Metadata = { title: "Quote monitoring" };

const BASE = "/admin/insurance/quotes";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const range = dayRange(strParam(sp.from), strParam(sp.to));
  const params = {
    q: strParam(sp.q)?.slice(0, 80),
    vendor: strParam(sp.vendor),
    status: strParam(sp.status),
    authorization: strParam(sp.authorization),
    flag: strParam(sp.flag),
    from: range.from,
    to: range.to,
  };
  const [{ rows, total, page, counts }, vendors] = await Promise.all([listInsQuotes(params, pageParam(sp.page)), vendorOptions()]);
  const hasFilters = Object.values(params).some(Boolean);

  return (
    <>
      <AdminHeader
        title="Quote monitoring"
        description={`Every quotation vendors send to customers. Flagged: insurer-authorised without the insurer's reference, expired, or more than ${Math.round(DEVIATION_LIMIT * 100)}% away from the customer's indicative estimate.`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Live with customers" value={counts.live} note={`${counts.viewed} viewed`} href={`${BASE}?status=submitted`} />
        <StatCard label="Customer interested" value={counts.accepted} note={`of ${counts.all} quotes`} href={`${BASE}?status=accepted`} />
        <StatCard label="Missing insurer reference" value={counts.missingRef} tone={counts.missingRef ? "red" : undefined} note="Insurer-authorised quotes" href={`${BASE}?flag=missing_ref`} />
        <StatCard label={`Over ${Math.round(DEVIATION_LIMIT * 100)}% from the estimate`} value={counts.deviation} tone={counts.deviation ? "red" : undefined} note={`${counts.expired} expired, unanswered`} href={`${BASE}?flag=deviation`} />
      </div>

      <FilterForm resetHref={BASE} hasFilters={hasFilters}>
        <SearchInput value={params.q} placeholder="QTE-…, insurer ref., ENQ-…, customer, vendor" />
        <FilterSelect name="vendor" label="All vendors" value={params.vendor} options={vendors} />
        <FilterSelect name="status" label="Any status" value={params.status} options={QUOTE_DISPLAY.map((s) => ({ value: s, label: INS_QUOTE_STATUS_LABEL[s] }))} />
        <FilterSelect name="authorization" label="Indicative & authorised" value={params.authorization} options={INS_QUOTE_AUTHORIZATION.map((a) => ({ value: a, label: INS_QUOTE_AUTH_SHORT[a] }))} />
        <FilterSelect
          name="flag"
          label="Flagged or not"
          value={params.flag}
          options={[{ value: "any", label: "Any flag" }, ...(Object.keys(QUOTE_FLAG_LABEL) as (keyof typeof QUOTE_FLAG_LABEL)[]).map((k) => ({ value: k, label: QUOTE_FLAG_LABEL[k] }))]}
        />
        <DateRangeFields from={params.from} to={params.to} label="Created between (IST)" />
      </FilterForm>

      {rows.length === 0 ? (
        <EmptyBox icon={<FileSignature aria-hidden className="size-5" />} title={hasFilters ? "No quotes match these filters" : "No quotes yet"}>
          {hasFilters ? "Try a wider date range or fewer filters." : "Quotations vendors build from enquiries appear here."}
        </EmptyBox>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Quote</Th>
              <Th>Customer</Th>
              <Th>Vendor</Th>
              <Th>Status</Th>
              <Th className="text-right">Total</Th>
              <Th className="whitespace-nowrap text-right">vs estimate</Th>
              <Th>Valid until</Th>
              <Th>Flags</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => {
              const flags = [q.flags.missingRef && QUOTE_FLAG_LABEL.missing_ref, q.flags.expired && QUOTE_FLAG_LABEL.expired, q.flags.deviation !== null && QUOTE_FLAG_LABEL.deviation].filter(Boolean) as string[];
              return (
                <tr key={q.id} className="transition-colors hover:bg-mist/40">
                  <Td className="min-w-[130px]">
                    <Link href={`${BASE}/${q.id}`} className="block font-medium num hover:text-red">
                      {q.reference}
                    </Link>
                    <div className="mt-1">
                      <AuthPill a={q.authorization} />
                    </div>
                    {q.insurerQuoteRef && <p className="mt-1 break-words text-[11.5px] text-muted num">Ref {q.insurerQuoteRef}</p>}
                  </Td>
                  <Td className="min-w-[140px]">
                    <Link href={`/admin/insurance/enquiries/${q.enquiryId}`} className="hover:text-red">
                      {q.customer}
                    </Link>
                    <p className="text-[12px] text-muted">
                      <span className="num">{q.enquiryRef}</span>
                      {q.vehicle ? ` · ${q.vehicle}` : ""}
                    </p>
                  </Td>
                  <Td className="min-w-[140px] max-w-[190px]">
                    <VendorLink id={q.vendorId} name={vendorLabel(q)} />
                    {q.productName && <p className="truncate text-[12px] text-muted">{q.productName}</p>}
                  </Td>
                  <Td>
                    <QuotePill status={q.display} />
                    <p className="mt-1 whitespace-nowrap text-[11.5px] text-muted">{q.submittedAt ? `Sent ${formatDay(q.submittedAt)}` : `Created ${formatDay(q.createdAt)}`}</p>
                  </Td>
                  <Td className="text-right font-semibold num">{rupees(q.total)}</Td>
                  <Td className="whitespace-nowrap text-right text-[12.5px] num">
                    {q.flags.deviationRaw === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className={q.flags.deviation !== null ? "font-semibold text-red" : "text-muted"}>{pctLabel(q.flags.deviationRaw)}</span>
                    )}
                    {q.indicative ? <p className="text-[11.5px] text-muted">est. {rupees(q.indicative)}</p> : null}
                  </Td>
                  <Td className="whitespace-nowrap">{formatDay(q.validUntil)}</Td>
                  <Td className="w-[130px]">
                    {flags.length ? (
                      <ul className="space-y-1">
                        {flags.map((f) => (
                          <li key={f} className="flex items-start gap-1.5 text-[12px] font-medium text-[#9a5b00]">
                            <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" /> {f}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-[12px] text-muted">None</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}
