"use client";

import { Copy } from "lucide-react";
import { DAY_LABEL } from "@/partner/application";
import type { DayHours } from "@/partner/types";
import { cn } from "@/lib/utils";
import { FieldError, SwitchButton } from "./controls";

/** Opening hours for each day of the week. */
export function HoursEditor({ value, onChange, errorFor, error }: { value: DayHours[]; onChange: (v: DayHours[]) => void; errorFor: (i: number) => string | undefined; error?: string }) {
  const set = (i: number, patch: Partial<DayHours>) => onChange(value.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const time = "h-10 w-full min-w-0 rounded-[3px] border border-line bg-white px-2.5 text-[13.5px] outline-none transition-colors hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red num";

  return (
    <div data-error={error ? "true" : undefined}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-medium text-ink">Working hours</p>
        <button
          type="button"
          onClick={() => onChange(value.map((h) => ({ ...h, open: value[0].open, close: value[0].close, closed: h.day === "sun" ? h.closed : value[0].closed })))}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-ink"
        >
          <Copy aria-hidden className="size-3.5" /> Copy Monday to Mon–Sat
        </button>
      </div>
      <ul className="divide-y divide-line border border-line bg-white">
        {value.map((h, i) => {
          const err = errorFor(i);
          return (
            <li key={h.day} className="px-3 py-2.5 sm:px-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 sm:grid-cols-[120px_auto_minmax(0,1fr)]">
                <span className="text-[13.5px] font-medium">{DAY_LABEL[h.day]}</span>
                <span className="flex items-center gap-2 justify-self-end sm:justify-self-start">
                  <span className={cn("text-[12px]", h.closed ? "text-muted" : "text-ink")}>{h.closed ? "Closed" : "Open"}</span>
                  <SwitchButton checked={!h.closed} onChange={(open) => set(i, { closed: !open })} label={`${DAY_LABEL[h.day]} open`} />
                </span>
                {!h.closed ? (
                  <span className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:col-span-1">
                    <input type="time" step={900} value={h.open} onChange={(e) => set(i, { open: e.target.value })} aria-label={`${DAY_LABEL[h.day]} opens`} aria-invalid={err ? true : undefined} className={time} />
                    <span className="text-[12px] text-muted">to</span>
                    <input type="time" step={900} value={h.close} onChange={(e) => set(i, { close: e.target.value })} aria-label={`${DAY_LABEL[h.day]} closes`} aria-invalid={err ? true : undefined} className={time} />
                  </span>
                ) : (
                  <span className="hidden text-[12.5px] text-muted sm:block">Closed all day</span>
                )}
              </div>
              {err && <p className="mt-1.5 text-xs text-red">{err}</p>}
            </li>
          );
        })}
      </ul>
      <FieldError>{error}</FieldError>
    </div>
  );
}
