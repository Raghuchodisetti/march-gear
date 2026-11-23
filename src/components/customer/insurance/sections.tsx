import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, CarFront, FileText, Inbox, ShieldCheck } from "lucide-react";
import { INS_INTENT_LABEL, INS_QUOTE_AUTH_SHORT, INS_QUOTE_AUTH_TONE } from "@/insurance/labels";
import { cn } from "@/lib/utils";
import { formatDate, formatINR } from "@/lib/format";
import { Badge, formatDay } from "@/components/portal/ui";
import { CompanyLogo } from "@/components/insurance/public/market/ui";
import { daysBetween } from "@/components/portal/billing/shared";
import type { CustomerInsuranceQuote, CustomerInsuranceRequest, CustomerPolicy } from "@/server/customer/insurance";
import { CUSTOMER_QUOTE_STATUS } from "@/components/customer/insurance/status";
import { RegPlate } from "@/components/customer/garage/ui";

/* Server-safe sections of /account/insurance. Customer-safe fields only. */

const chip = "inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-line bg-white px-3 text-[12.5px] font-medium transition-colors hover:border-ink";

/** A wrapping "a · b · c" line. Each item carries its own dot; the clipped left edge hides the dot that starts a line. */
function Meta({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 overflow-hidden">
      <p className="-ml-3 flex flex-wrap items-center gap-y-1 text-[12.5px] text-muted [&>span]:relative [&>span]:pl-3 [&>span]:before:absolute [&>span]:before:left-[4px] [&>span]:before:text-ink/30 [&>span]:before:content-['·']">{children}</p>
    </div>
  );
}

function SectionEmpty({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 border border-line bg-white px-5 py-5">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[3px] bg-mist text-muted">{icon}</span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold">{title}</p>
        <p className="mt-0.5 max-w-2xl text-[13px] leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  );
}

export function SectionTitle({ id, title, count, action }: { id: string; title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="text-[15px] font-semibold">
        {title}
        {count !== undefined && <span className="ml-2 text-[13px] font-normal text-muted num">{count}</span>}
      </h2>
      {action}
    </div>
  );
}

/* ── Quotes ────────────────────────────────────────────────── */

export function QuotesList({ quotes, today }: { quotes: CustomerInsuranceQuote[]; today: string }) {
  if (!quotes.length)
    return (
      <SectionEmpty icon={<FileText aria-hidden className="size-[18px]" />} title="No quotes yet">
          When an insurer or intermediary sends you a quote for one of your requests, it appears here with its price and how long it&apos;s valid.
      </SectionEmpty>
    );
  return (
    <ul className="divide-y divide-line border border-line bg-white">
      {quotes.map((q) => {
        const s = CUSTOMER_QUOTE_STATUS[q.status];
        const linkable = q.status !== "withdrawn";
        const left = daysBetween(today, q.validUntil);
        return (
          <li key={q.reference} className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5">
                <Badge tone={INS_QUOTE_AUTH_TONE[q.authorization]}>{INS_QUOTE_AUTH_SHORT[q.authorization]}</Badge>
                <Badge tone={s.tone}>{s.label}</Badge>
              </p>
              <p className="mt-2 text-[14px] font-medium">
                {q.productName ?? "Insurance quote"}
                <span className="font-normal text-muted"> · {q.insurer ?? "Insurer"}</span>
              </p>
              <Meta>
                {q.vehicle && <span>{q.vehicle}</span>}
                <span className="font-mono text-[11.5px] tracking-wide">{q.reference}</span>
                {q.submittedAt && <span>Sent {formatDay(q.submittedAt)}</span>}
                {q.insurerQuoteRef && <span>Insurer ref. {q.insurerQuoteRef}</span>}
              </Meta>
              {q.soldBy && <p className="mt-1 text-[12px] text-muted">Sold by {q.soldBy}</p>}
            </div>
            <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3 border-t border-line pt-3 md:items-center md:justify-end md:border-t-0 md:pt-0">
              <div className="md:text-right">
                <p className="font-display text-[20px] font-semibold leading-none tracking-[-0.02em] num">{formatINR(q.total)}</p>
                <p className="mt-1.5 text-[11.5px] text-muted">
                  {q.authorization === "indicative" ? "Indicative total" : "Quoted total"}
                  {q.idv > 0 && ` · IDV ${formatINR(q.idv)}`}
                </p>
                <p className={cn("mt-0.5 text-[11.5px]", q.status === "expired" ? "text-red" : left >= 0 && left <= 3 && linkable ? "text-[#9a5b00]" : "text-muted")}>
                  {q.status === "expired"
                    ? `Expired ${formatDate(q.validUntil)}`
                    : q.status === "withdrawn"
                      ? `Was valid until ${formatDate(q.validUntil)}`
                      : `Valid until ${formatDate(q.validUntil)}${left >= 0 && left <= 7 ? ` · ${left === 0 ? "last day" : `${left} day${left === 1 ? "" : "s"} left`}` : ""}`}
                </p>
              </div>
              {linkable ? (
                <Link href={`/insurance/quote/${q.token}`} className={chip}>
                  View quote <ArrowUpRight aria-hidden className="size-3.5 text-red" />
                </Link>
              ) : (
                <span className="text-[12px] text-muted">No longer available</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Policies ──────────────────────────────────────────────── */

export type PolicyGarageState = { kind: "add"; href: string } | { kind: "full" } | { kind: "update"; href: string; car: string } | { kind: "saved"; href: string; car: string };

export function PoliciesList({ policies, garage }: { policies: CustomerPolicy[]; garage: Record<string, PolicyGarageState> }) {
  if (!policies.length)
    return (
      <SectionEmpty icon={<ShieldCheck aria-hidden className="size-[18px]" />} title="No policies reported yet">
          When an insurer marks one of your requests as a policy issued, it shows here with the policy number — and you can add it to your garage for renewal reminders.
      </SectionEmpty>
    );
  return (
    <ul className="divide-y divide-line border border-line bg-white">
      {policies.map((p) => {
        const g = garage[p.enquiryReference];
        return (
          <li key={p.enquiryReference} className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6">
            <div className="flex min-w-0 gap-3.5">
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-[3px] bg-[#e8f5ec] text-[#1e7a3c]">
                <ShieldCheck aria-hidden className="size-[18px]" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
                  <span className="min-w-0">
                    {p.productName ?? "Motor insurance policy"}
                    <span className="font-normal text-muted"> · {p.insurer ?? "Insurer"}</span>
                  </span>
                  <Badge tone={p.verified ? "green" : "blue"}>{p.verified ? "Policy confirmed" : "Reported by the insurer"}</Badge>
                </p>
                <Meta>
                  {p.vehicle && <span>{p.vehicle}</span>}
                  {p.regNumber && (
                    <span>
                      <RegPlate reg={p.regNumber} className="h-5 text-[10.5px]" />
                    </span>
                  )}
                  <span>Policy {p.policyNumber ? <span className="font-mono text-[11.5px] tracking-wide text-ink/80">{p.policyNumber}</span> : "number not reported"}</span>
                  <span>Issued {formatDate(p.issuedOn)}</span>
                  <span>Renews around {formatDate(p.endsOn)}</span>
                </Meta>
                <p className="mt-1 text-[12px] text-muted">
                  {p.premium ? (
                    <>
                      Premium <span className="font-medium text-ink/80 num">{formatINR(p.premium)}</span> as reported by {p.soldBy ?? "the insurer"}
                    </>
                  ) : (
                    "Premium not reported"
                  )}
                  {p.soldBy && ` · Sold by ${p.soldBy}`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              {g?.kind === "add" && (
                <Link href={g.href} className={cn(chip, "border-ink bg-ink text-white hover:bg-ink-3")}>
                  <CarFront aria-hidden className="size-3.5" /> Add to my garage
                </Link>
              )}
              {g?.kind === "update" && (
                <Link href={g.href} className={chip} title={`Updates the policy on ${g.car}`}>
                  <CarFront aria-hidden className="size-3.5" /> Update in my garage
                </Link>
              )}
              {g?.kind === "saved" && (
                <Link href={g.href} className={chip}>
                  <CarFront aria-hidden className="size-3.5" /> In your garage · {g.car}
                </Link>
              )}
              {g?.kind === "full" && <span className="text-[12px] text-muted">Your garage is full (10 cars)</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Requests ──────────────────────────────────────────────── */

export function RequestsList({ requests }: { requests: CustomerInsuranceRequest[] }) {
  if (!requests.length)
    return (
      <SectionEmpty icon={<Inbox aria-hidden className="size-[18px]" />} title="No quote requests yet">
          Compare indicative premiums for your car and ask up to a few insurers for a quote. Requests you send while signed in appear here.
      </SectionEmpty>
    );
  return (
    <ul className="divide-y divide-line border border-line bg-white">
      {requests.map((r) => (
        <li key={r.id} id={r.reference} className="grid scroll-mt-28 grid-cols-1 gap-3 px-5 py-4 target:bg-[#fff8f8] md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6">
          <div className="flex min-w-0 gap-3.5">
            <CompanyLogo company={{ name: r.insurer ?? "Insurer", shortName: r.insurerShort, logo: r.insurerLogo }} size="sm" />
            <div className="min-w-0">
              <p className="text-[14px] font-medium">
                {r.productRef ? (
                  <Link href={`/insurance/products/${r.productRef}`} className="hover:text-red">
                    {r.productName}
                  </Link>
                ) : (
                  (r.productName ?? "Plan no longer listed")
                )}
                <span className="font-normal text-muted"> · {r.insurer ?? "Insurer"}</span>
              </p>
              <Meta>
                <span>{INS_INTENT_LABEL[r.intent]}</span>
                {r.vehicle && <span>{r.vehicle}</span>}
                {r.regNumber && <span className="font-mono text-[11.5px] tracking-wide">{r.regNumber}</span>}
                <span className="font-mono text-[11.5px] tracking-wide">{r.reference}</span>
                <span>{formatDay(r.createdAt)}</span>
              </Meta>
              {(r.soldBy || r.indicativePremium) && (
                <p className="mt-1 text-[12px] text-muted">
                  {r.soldBy && `Sold by ${r.soldBy}`}
                  {r.soldBy && r.indicativePremium ? " · " : ""}
                  {r.indicativePremium ? (
                    <>
                      You were shown <span className="font-medium text-ink/80 num">{formatINR(r.indicativePremium)}</span> — indicative premium<sup>*</sup>
                    </>
                  ) : null}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <Badge tone={r.status.tone}>{r.status.label}</Badge>
            {r.quoteCount > 0 && (
              <a href="#quotes" className="text-[12.5px] font-medium text-ink/75 underline-offset-4 hover:text-ink hover:underline">
                {r.quoteCount} quote{r.quoteCount === 1 ? "" : "s"}
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
