import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, formatDay } from "@/components/portal/ui";
import type { CustomerEnquiry } from "@/server/customer/requests";

/* The customer's enquiries as a responsive list: columns on desktop, stacked cards on phones. Server-safe. */

const COLS = "md:grid-cols-[minmax(0,1fr)_minmax(0,190px)_minmax(0,200px)_96px_16px]";

export function EnquiryList({ items, empty }: { items: CustomerEnquiry[]; empty: ReactNode }) {
  return (
    <div className="border border-line bg-white">
      <div className={cn("hidden gap-5 border-b border-line bg-mist/60 px-5 py-3 text-[12px] font-semibold text-muted md:grid", COLS)}>
        <span>Request</span>
        <span>Handled by</span>
        <span>Status</span>
        <span>Sent</span>
        <span aria-hidden />
      </div>
      {items.length === 0 ? (
        empty
      ) : (
        <ul className="divide-y divide-line">
          {items.map((e) => (
            <li key={e.reference}>
              <Link href={e.href} className={cn("group grid grid-cols-1 gap-5 px-5 py-4 transition-colors duration-300 hover:bg-mist/40 md:items-center", COLS)}>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{e.typeLabel}</p>
                  <p className="mt-1 truncate text-[14.5px] font-semibold text-ink transition-colors group-hover:text-red">{e.title}</p>
                  <p className="mt-0.5 font-mono text-[12px] text-muted">{e.reference}</p>
                  {/* Phones: the other columns, inline. */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 md:hidden">
                    <Badge tone={e.status.tone}>{e.status.label}</Badge>
                    <span className="text-[12.5px] text-muted">
                      {e.dealerName ?? "MarchGear team"} · <span className="num">{formatDay(e.createdAt)}</span>
                    </span>
                  </div>
                </div>
                <p className="hidden truncate text-[13.5px] text-ink/80 md:block">{e.dealerName ?? <span className="text-muted">MarchGear team</span>}</p>
                <div className="hidden md:block">
                  <Badge tone={e.status.tone}>{e.status.label}</Badge>
                </div>
                <p className="hidden text-[12.5px] text-muted num md:block">{formatDay(e.createdAt)}</p>
                <ChevronRight aria-hidden className="hidden size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink md:block" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
