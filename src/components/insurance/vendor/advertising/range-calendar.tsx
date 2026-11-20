"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays } from "@/components/portal/billing/shared";
import { dayLabel } from "@/components/ads/shared";

/* ──────────────────────────────────────────────────────────────
   A month calendar for picking a booking's first and last day.
   Sold-out days (every slot taken) can't be part of a range; days
   before `min` or after `max` are disabled. Two months side by
   side from tablet width, one on phones.
   ────────────────────────────────────────────────────────────── */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const monthKey = (iso: string) => iso.slice(0, 7);
const firstOfMonth = (ym: string) => `${ym}-01`;
const shiftMonth = (ym: string, n: number) => {
  const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const daysIn = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
/** Monday-first weekday index of a day (0 = Monday). */
const weekday = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;

export function RangeCalendar({
  start,
  end,
  onChange,
  min,
  max,
  occupancy,
  slots,
  invalid,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  /** First selectable day. */
  min: string;
  /** Last selectable day. */
  max: string;
  /** Campaigns holding a slot per day. */
  occupancy: Record<string, number>;
  slots: number;
  invalid?: boolean;
}) {
  const [month, setMonth] = useState(() => monthKey(start || min));
  const [hover, setHover] = useState<string | null>(null);
  const full = (d: string) => (occupancy[d] ?? 0) >= slots;
  const disabled = (d: string) => d < min || d > max;

  // While choosing the last day, preview the range under the pointer.
  const previewEnd = start && !end && hover && hover >= start ? hover : end;
  const months = [month, shiftMonth(month, 1)];
  const canPrev = monthKey(min) < month;
  const canNext = shiftMonth(month, 1) < monthKey(max);

  const pick = (d: string) => {
    if (disabled(d) || full(d)) return;
    if (!start || end || d < start) onChange(d, "");
    else onChange(start, d);
  };

  return (
    <div className={cn("border bg-white p-4 md:p-5", invalid ? "border-red" : "border-line")}>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} disabled={!canPrev} aria-label="Previous month" className="inline-flex size-9 items-center justify-center rounded-full border border-line transition-colors hover:border-ink disabled:pointer-events-none disabled:opacity-30">
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <p className="text-[12.5px] text-muted" aria-live="polite">
          {start && !end ? "Now choose the last day" : start && end ? `${dayLabel(start)} – ${dayLabel(end)}` : "Choose the first day"}
        </p>
        <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={!canNext} aria-label="Next month" className="inline-flex size-9 items-center justify-center rounded-full border border-line transition-colors hover:border-ink disabled:pointer-events-none disabled:opacity-30">
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2" onMouseLeave={() => setHover(null)}>
        {months.map((ym, mi) => (
          <Month key={ym} ym={ym} className={mi === 1 ? "hidden md:block" : undefined}>
            {(d) => {
              const off = disabled(d);
              const sold = !off && full(d);
              const few = !off && !sold && slots > 1 && (occupancy[d] ?? 0) === slots - 1;
              const inRange = start && previewEnd && d >= start && d <= previewEnd;
              const edge = d === start || d === previewEnd;
              return (
                <button
                  type="button"
                  key={d}
                  onClick={() => pick(d)}
                  onMouseEnter={() => setHover(d)}
                  disabled={off || sold}
                  aria-pressed={Boolean(inRange)}
                  aria-label={`${dayLabel(d)}${sold ? ", sold out" : few ? ", 1 slot left" : ""}`}
                  title={sold ? "Sold out — every slot is booked" : few ? "1 slot left" : undefined}
                  className={cn(
                    "relative flex h-10 items-center justify-center text-[13px] num transition-colors",
                    off && "cursor-not-allowed text-ink/20",
                    sold && "cursor-not-allowed bg-[repeating-linear-gradient(135deg,#fdf2f2_0_4px,#fbe4e4_4px_8px)] text-red/60 line-through",
                    !off && !sold && !inRange && "hover:bg-mist",
                    inRange && !edge && "bg-ink/[0.07] text-ink",
                    edge && "rounded-[3px] bg-ink font-semibold text-white",
                  )}
                >
                  {Number(d.slice(8, 10))}
                  {few && !edge && <span aria-hidden className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-[#e09200]" />}
                </button>
              );
            }}
          </Month>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-line pt-3 text-[11.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[2px] bg-ink" /> Selected
        </span>
        {slots > 1 && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-1.5 rounded-full bg-[#e09200]" /> 1 slot left
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[2px] bg-[repeating-linear-gradient(135deg,#fdf2f2_0_3px,#f6caca_3px_6px)]" /> Sold out
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[2px] border border-line bg-white" /> Available
        </span>
      </div>
    </div>
  );
}

function Month({ ym, children, className }: { ym: string; children: (day: string) => ReactNode; className?: string }) {
  const days = useMemo(() => Array.from({ length: daysIn(ym) }, (_, i) => addDays(firstOfMonth(ym), i)), [ym]);
  const lead = weekday(firstOfMonth(ym));
  return (
    <div className={className}>
      <p className="mb-2 text-center text-[13.5px] font-semibold">
        {MONTHS[Number(ym.slice(5, 7)) - 1]} {ym.slice(0, 4)}
      </p>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1.5">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {days.map((d) => children(d))}
      </div>
    </div>
  );
}
