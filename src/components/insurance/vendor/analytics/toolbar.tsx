"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarRange, Download, Loader2 } from "lucide-react";
import { Segmented } from "@/components/ui/field";
import { istDate } from "@/components/portal/billing/shared";
import { MAX_RANGE_DAYS, insRangeQuery, type InsDateRange, type InsRangePreset } from "./report";

const input = "h-10 rounded-[3px] border border-line bg-white px-3 text-[13.5px] outline-none transition-colors hover:border-ink/30 focus:border-ink";

export function InsAnalyticsToolbar({ range }: { range: InsDateRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [preset, setPreset] = useState<InsRangePreset>(range.preset);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const today = istDate();

  const go = (q: Record<string, string>) => start(() => router.push(`${pathname}?${new URLSearchParams(q).toString()}`, { scroll: false }));
  const pick = (p: InsRangePreset) => {
    setPreset(p);
    if (p !== "custom") go({ range: p });
  };
  const customInvalid = !from || !to || from > to || to > today;
  const exportHref = `/insurance-vendor/analytics/export?${new URLSearchParams(insRangeQuery(range)).toString()}`;

  return (
    <div className="mb-6 border border-line bg-white p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Segmented
            ariaLabel="Date range"
            className="w-full sm:w-auto"
            value={preset}
            onChange={pick}
            options={[
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
              { value: "365", label: "12 months" },
              { value: "custom", label: "Custom" },
            ]}
          />
          {pending && <Loader2 className="size-4 shrink-0 animate-spin text-muted" aria-label="Loading" />}
        </div>
        <a href={exportHref} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[3px] bg-ink px-4 text-[13px] font-medium text-white transition-colors hover:bg-ink-3 sm:w-auto">
          <Download className="size-4" aria-hidden /> Export CSV
        </a>
      </div>
      {preset === "custom" && (
        <form
          className="mt-3 flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!customInvalid) go({ range: "custom", from, to });
          }}
        >
          <label className="flex flex-col gap-1 text-[12px] font-medium text-muted">
            From
            <input type="date" className={input} value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-muted">
            To
            <input type="date" className={input} value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="submit" disabled={customInvalid || pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-[3px] border border-ink px-4 text-[13px] font-medium transition-colors hover:bg-ink hover:text-white disabled:opacity-40">
            <CalendarRange className="size-4" aria-hidden /> Apply range
          </button>
          <p className="text-[12px] text-muted sm:ml-2 sm:self-center">Up to {MAX_RANGE_DAYS} days · dates in IST</p>
        </form>
      )}
    </div>
  );
}
