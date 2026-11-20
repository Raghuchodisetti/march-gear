import Link from "next/link";
import { ArrowUpRight, Inbox } from "lucide-react";
import type { InsLeadStatus } from "@/db/enums";
import { INS_QUOTE_AUTH_SHORT, quoteDisplayStatus } from "@/insurance/labels";
import { formatDay } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/format";
import type { CustomerRequest } from "@/server/insurance/market";
import { CompanyLogo } from "./ui";

/* "Your quote requests" — the signed-in customer's enquiries and the quotes insurers sent. Server component. */

/** What a customer sees for the vendor's internal pipeline status. */
const CUSTOMER_STATUS: Record<InsLeadStatus, { label: string; tone: "blue" | "green" | "neutral" | "amber" }> = {
  new: { label: "Sent to insurer", tone: "blue" },
  assigned: { label: "Sent to insurer", tone: "blue" },
  contacted: { label: "Insurer in touch", tone: "blue" },
  quote_requested: { label: "Insurer in touch", tone: "blue" },
  follow_up: { label: "Insurer in touch", tone: "blue" },
  quote_submitted: { label: "Quote received", tone: "amber" },
  interested: { label: "You're interested", tone: "green" },
  policy_issued: { label: "Policy issued", tone: "green" },
  lost: { label: "Closed", tone: "neutral" },
  closed: { label: "Closed", tone: "neutral" },
};

const QUOTE_LABEL = { submitted: "New quote", viewed: "Quote", accepted: "You're interested", declined: "You declined", expired: "Expired", draft: "Draft", withdrawn: "Withdrawn" } as const;

const TONE = {
  blue: "bg-[#eef3fb] text-[#1d4ed8]",
  green: "bg-[#edf7ef] text-[#15803d]",
  amber: "bg-[#fdf6e7] text-[#a16207]",
  neutral: "bg-mist text-muted",
};

export function CustomerRequests({ requests, today, className }: { requests: CustomerRequest[]; today: string; className?: string }) {
  return (
    <section id="your-requests" aria-labelledby="your-requests-title" className={cn("scroll-mt-28", className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="type-eyebrow inline-flex items-center gap-3 text-ink">
            <span aria-hidden className="h-px w-6 bg-red" />
            Signed in
          </p>
          <h2 id="your-requests-title" className="type-h3 mt-4">
            Your quote requests
          </h2>
        </div>
        {requests.length > 0 && <p className="text-[12.5px] text-muted num">Latest {requests.length}</p>}
      </div>

      {requests.length === 0 ? (
        <div className="mt-6 flex items-center gap-4 border border-dashed border-line px-5 py-6">
          <Inbox className="size-5 shrink-0 text-muted" aria-hidden />
          <p className="text-[13.5px] text-muted">Requests you send while signed in appear here, with any quotes the insurers send you.</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {requests.map((r) => {
            const s = CUSTOMER_STATUS[r.status];
            return (
              <li key={r.id} className="grid grid-cols-1 gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-8">
                <div className="flex min-w-0 gap-4">
                  <CompanyLogo company={{ name: r.companyName ?? "Insurer", shortName: null, logo: r.companyLogo }} size="sm" />
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-ink">
                      {r.productRef ? (
                        <Link href={`/insurance/products/${r.productRef}`} className="hover:text-red">
                          {r.productName}
                        </Link>
                      ) : (
                        (r.productName ?? "Plan no longer listed")
                      )}
                      <span className="font-normal text-muted"> · {r.companyName ?? "Insurer"}</span>
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {r.vehicle || "Car not specified"} · <span className="font-mono tracking-wide">{r.reference}</span> · {formatDay(r.createdAt)}
                      {r.indicativePremium ? ` · shown ${formatINR(r.indicativePremium)} indicative` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <span className={cn("inline-flex h-6 items-center rounded-[2px] px-2 text-[11px] font-semibold", TONE[s.tone])}>{s.label}</span>
                  {r.quotes.map((q) => {
                    const ds = quoteDisplayStatus({ status: q.status, validUntil: q.validUntil, viewedAt: q.viewedAt }, today);
                    return (
                      <Link
                        key={q.reference}
                        href={`/insurance/quote/${q.token}`}
                        className="group/q inline-flex h-8 items-center gap-2 rounded-[3px] border border-line bg-white px-3 text-[12.5px] font-medium text-ink transition-colors hover:border-ink"
                      >
                        {QUOTE_LABEL[ds]} · {formatINR(q.total)}
                        <span className="text-[11px] font-normal text-muted">{INS_QUOTE_AUTH_SHORT[q.authorization]}</span>
                        <ArrowUpRight className="size-3.5 text-red transition-transform group-hover/q:-translate-y-0.5 group-hover/q:translate-x-0.5" aria-hidden />
                      </Link>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
