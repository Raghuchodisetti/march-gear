"use client";

import { Copy } from "lucide-react";
import { DAY_LABEL } from "@/partner/application";
import type { DayHours } from "@/partner/types";
import { cn } from "@/lib/utils";

/** Weekly opening hours: open/closed per day with times, and "copy Monday to all days". */
export function HoursEditor({ value, onChange, errors = {}, prefix = "hours" }: { value: DayHours[]; onChange: (v: DayHours[]) => void; errors?: Record<string, string>; prefix?: string }) {
  const set = (i: number, patch: Partial<DayHours>) => onChange(value.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const copyFirst = () => onChange(value.map((h) => ({ ...h, open: value[0].open, close: value[0].close, closed: value[0].closed })));
  const time = "h-10 w-full min-w-0 rounded-[3px] border border-line bg-white px-2.5 text-[13.5px] outline-none transition-colors hover:border-ink/30 focus:border-ink disabled:bg-mist disabled:text-muted/60 aria-[invalid=true]:border-red";

  return (
    <div className="@container">
      <ul className="divide-y divide-line border border-line">
        {value.map((h, i) => {
          const err = errors[`${prefix}.${i}.close`] ?? errors[`${prefix}.${i}.open`];
          return (
            <li key={h.day} className="px-3 py-2.5 @md:px-4">
              <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 @md:grid-cols-[100px_80px_minmax(0,1fr)]">
                <span className="text-[13.5px] font-medium">{DAY_LABEL[h.day]}</span>
                <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
                  <input type="checkbox" checked={!h.closed} onChange={(e) => set(i, { closed: !e.target.checked })} className="size-4 accent-[#111111]" />
                  {h.closed ? "Closed" : "Open"}
                </label>
                <div className={cn("col-span-2 flex items-center gap-2 @md:col-span-1", h.closed && "opacity-50")}>
                  <input type="time" aria-label={`${DAY_LABEL[h.day]} opens`} value={h.open} disabled={h.closed} onChange={(e) => set(i, { open: e.target.value })} className={time} aria-invalid={Boolean(err) || undefined} />
                  <span className="text-[12px] text-muted">to</span>
                  <input type="time" aria-label={`${DAY_LABEL[h.day]} closes`} value={h.close} disabled={h.closed} onChange={(e) => set(i, { close: e.target.value })} className={time} aria-invalid={Boolean(err) || undefined} />
                </div>
              </div>
              {err && <p className="mt-1.5 text-xs text-red">{err}</p>}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={copyFirst} className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition-colors hover:text-ink">
        <Copy aria-hidden className="size-3.5" /> Copy Monday&apos;s hours to every day
      </button>
      {errors[prefix] && <p className="mt-1.5 text-xs text-red">{errors[prefix]}</p>}
    </div>
  );
}
