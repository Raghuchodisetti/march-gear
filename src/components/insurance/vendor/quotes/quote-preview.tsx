import { BadgeCheck, TriangleAlert } from "lucide-react";
import type { InsProductCategory, InsQuoteAuthorization } from "@/db/enums";
import { INDICATIVE_NOTE, INS_PRODUCT_CATEGORY_LABEL, NOT_AN_INSURER_NOTE } from "@/insurance/labels";
import type { QuoteBreakdown, QuoteCoverLine } from "@/insurance/types";
import { cn } from "@/lib/utils";
import { rupees } from "@/components/portal/billing/shared";
import { formatDayShort } from "@/components/insurance/vendor/crm/badges";
import { breakdownLines } from "./pricing";

/* The quotation as the customer will read it — the builder's live preview and the detail page. Server-safe. */

export interface PreviewData {
  reference: string | null;
  vendorName: string;
  authorization: InsQuoteAuthorization;
  insurerQuoteRef: string | null;
  customer: { name: string; mobile: string; email: string | null; city: string | null };
  vehicle: { line: string; reg: string | null };
  product: { name: string; companyName: string | null; category: InsProductCategory; code: string; uin: string | null } | null;
  coverage: QuoteCoverLine[];
  breakdown: QuoteBreakdown | null;
  validUntil: string;
  issuedOn: string;
  notes: string;
  terms: string;
}

export function AuthorizationBanner({ authorization, insurerQuoteRef, className }: { authorization: InsQuoteAuthorization; insurerQuoteRef: string | null; className?: string }) {
  return authorization === "insurer_authorised" ? (
    <div className={cn("flex items-start gap-2.5 border-l-[3px] border-[#1e7a3c] bg-[#e8f5ec] px-3.5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#145a2b]", className)}>
      <BadgeCheck aria-hidden className="mt-px size-4 shrink-0" />
      <span>
        Insurer-authorised quotation
        <span className="mt-0.5 block font-mono text-[11.5px] font-medium normal-case tracking-normal">Insurer ref {insurerQuoteRef || "— not entered yet"}</span>
      </span>
    </div>
  ) : (
    <div className={cn("flex items-start gap-2.5 border-l-[3px] border-[#d68a00] bg-[#fdf3e1] px-3.5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#6b4000]", className)}>
      <TriangleAlert aria-hidden className="mt-px size-4 shrink-0" />
      Indicative estimate — not an insurer quotation
    </div>
  );
}

export function QuotePreview({ data, className }: { data: PreviewData; className?: string }) {
  const b = data.breakdown;
  return (
    <article aria-label="Quotation preview" className={cn("border border-line bg-white text-ink", className)}>
      <header className="flex items-start justify-between gap-4 bg-ink px-5 py-4 text-white">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight">
            March<span className="font-normal">Gear</span> <span className="ml-1 rounded-[2px] border border-white/60 px-1 text-[9px] font-bold tracking-[0.1em] align-middle">INSURANCE</span>
          </p>
          <p className="mt-1 truncate text-[12px] text-white/70">{data.vendorName}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em]">{data.authorization === "insurer_authorised" ? "Quotation" : "Estimate"}</p>
          <p className="mt-1 font-mono text-[11.5px] text-white/70">{data.reference ?? "QTE-······"}</p>
        </div>
      </header>
      <div aria-hidden className="h-[2px] bg-red" />
      <div className="space-y-5 px-5 py-5">
        <AuthorizationBanner authorization={data.authorization} insurerQuoteRef={data.insurerQuoteRef} />

        <div className="grid grid-cols-2 gap-4 text-[12.5px]">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">Prepared for</p>
            <p className="mt-1 truncate font-medium">{data.customer.name}</p>
            <p className="truncate text-muted num">+91 {data.customer.mobile}</p>
            {data.customer.city && <p className="truncate text-muted">{data.customer.city}</p>}
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">Vehicle</p>
            <p className="mt-1 font-medium leading-snug">{data.vehicle.line || "—"}</p>
            {data.vehicle.reg && <p className="font-mono text-[12px] text-muted">{data.vehicle.reg}</p>}
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">Plan</p>
          {data.product ? (
            <>
              <p className="mt-1 text-[14px] font-semibold">{data.product.name}</p>
              <p className="text-[12px] text-muted">
                {INS_PRODUCT_CATEGORY_LABEL[data.product.category]}
                {data.product.companyName ? ` · Underwritten by ${data.product.companyName}` : ""}
              </p>
              {data.product.uin && <p className="text-[11.5px] text-muted">UIN {data.product.uin}</p>}
            </>
          ) : (
            <p className="mt-1 text-[13px] text-muted">Choose a product</p>
          )}
        </div>

        {data.coverage.length > 0 && (
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">What&apos;s covered</p>
            <ul className="mt-2 space-y-2">
              {data.coverage.map((c, i) => (
                <li key={`${c.name}-${i}`} className="text-[12.5px] leading-snug">
                  <span className="font-medium">{c.name || "Untitled cover"}</span>
                  {c.detail && <span className="block text-muted">{c.detail}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {b && (
          <div className="border-t border-line pt-4">
            <div className="mb-3 grid grid-cols-2 gap-3 text-[12px]">
              {b.odYears > 0 && (
                <div>
                  <p className="text-muted">Insured declared value</p>
                  <p className="mt-0.5 text-[14px] font-semibold num">{rupees(b.idv)}</p>
                </div>
              )}
              <div>
                <p className="text-muted">Deductible per claim</p>
                <p className="mt-0.5 text-[14px] font-semibold num">{rupees(b.deductible)}</p>
              </div>
            </div>
            <dl className="text-[12.5px]">
              {breakdownLines(b).map((l) => (
                <div
                  key={l.label}
                  className={cn(
                    "flex items-baseline justify-between gap-3 py-1.5",
                    l.kind === "subtotal" && "mt-1 border-t border-line pt-2.5 font-medium",
                    l.kind === "total" && "mt-1 border-t-2 border-ink pt-2.5 text-[15px] font-semibold",
                  )}
                >
                  <dt className="min-w-0">{l.label}</dt>
                  <dd className={cn("shrink-0 num", l.kind === "minus" && "text-[#1e7a3c]")}>{l.kind === "included" ? "Included" : l.amount < 0 ? `− ${rupees(-l.amount)}` : rupees(l.amount)}</dd>
                </div>
              ))}
            </dl>
            {b.notes.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-[11.5px] text-muted">
                {b.notes.map((n) => (
                  <li key={n}>· {n}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-[12px]">
          <div>
            <p className="text-muted">Issued</p>
            <p className="mt-0.5 font-medium num">{formatDayShort(data.issuedOn)}</p>
          </div>
          <div>
            <p className="text-muted">Valid until</p>
            <p className="mt-0.5 font-medium num">{data.validUntil ? formatDayShort(data.validUntil) : "—"}</p>
          </div>
        </div>

        {data.notes && (
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">Notes</p>
            <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed">{data.notes}</p>
          </div>
        )}
        {data.terms && (
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">Terms</p>
            <p className="mt-1 whitespace-pre-line text-[11.5px] leading-relaxed text-muted">{data.terms}</p>
          </div>
        )}

        <p className="border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
          {data.authorization === "indicative" ? `${INDICATIVE_NOTE} ` : ""}
          {NOT_AN_INSURER_NOTE}
        </p>
      </div>
    </article>
  );
}
