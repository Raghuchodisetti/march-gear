import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { WEEKDAYS, formatIstDay, formatTime, istDay, istMinutes, monthLabel } from "@/components/portal/crm/pipeline";
import type { TestDriveItem } from "@/components/portal/crm/types";

/* Test-drive calendar (IST): a week time-grid and a month overview. Server-rendered; every entry links to its drawer. */

const DAY = 86_400_000;
export const parseYmd = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => ymd(new Date(parseYmd(s).getTime() + n * DAY));
export const weekStart = (s: string) => addDays(s, -((parseYmd(s).getUTCDay() + 6) % 7));
export const monthStart = (s: string) => `${s.slice(0, 7)}-01`;
export const addMonths = (s: string, n: number) => {
  const d = parseYmd(monthStart(s));
  return ymd(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
};
/** UTC instant of IST midnight on a day. */
export const istMidnight = (s: string) => new Date(`${s}T00:00:00+05:30`);

/** The visible range for a calendar view, as IST days [from, to). */
export function calendarRange(view: "week" | "month", anchor: string) {
  if (view === "week") {
    const from = weekStart(anchor);
    return { from, to: addDays(from, 7) };
  }
  const first = monthStart(anchor);
  const from = weekStart(first);
  const nextMonth = addMonths(first, 1);
  let to = addDays(from, 35);
  if (to < nextMonth) to = addDays(from, 42);
  return { from, to };
}

const when = (t: TestDriveItem) => t.scheduledAt ?? t.requestedFor;

function chipClass(t: TestDriveItem) {
  switch (t.status) {
    case "requested":
      return "border border-dashed border-red/60 bg-white text-red";
    case "completed":
      return "border border-[#cfe6d6] bg-[#e8f5ec] text-[#1e5f33]";
    case "no_show":
      return "border border-[#f3dfb8] bg-[#fdf3e1] text-[#7a4a00]";
    case "accepted":
      return "border border-ink/20 bg-white text-ink";
    default:
      return "border border-ink bg-ink text-white";
  }
}

const START_MIN = 8 * 60;
const END_MIN = 21 * 60;
const HOUR_PX = 56;

export function CalendarView({
  view,
  anchor,
  today,
  items,
  href,
}: {
  view: "week" | "month";
  anchor: string;
  today: string;
  items: TestDriveItem[];
  /** Builds a link keeping the other params. */
  href: (patch: Record<string, string | undefined>) => string;
}) {
  const { from, to } = calendarRange(view, anchor);
  const byDay = new Map<string, TestDriveItem[]>();
  for (const t of items) {
    const at = when(t);
    if (!at) continue;
    const d = istDay(at);
    byDay.set(d, [...(byDay.get(d) ?? []), t]);
  }
  for (const list of byDay.values()) list.sort((a, b) => (when(a)! < when(b)! ? -1 : 1));

  const prev = view === "week" ? addDays(anchor, -7) : addMonths(anchor, -1);
  const next = view === "week" ? addDays(anchor, 7) : addMonths(anchor, 1);
  const first = parseYmd(monthStart(anchor));
  const title =
    view === "week"
      ? `${formatIstDay(istMidnight(from), false)} – ${formatIstDay(istMidnight(addDays(to, -1)), true)}`
      : monthLabel(first.getUTCFullYear(), first.getUTCMonth());
  const nav = "inline-flex size-9 items-center justify-center rounded-[3px] border border-line bg-white transition-colors hover:border-ink";

  return (
    <div className="border border-line bg-white">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link href={href({ d: prev, td: undefined })} className={nav} aria-label={view === "week" ? "Previous week" : "Previous month"} scroll={false}>
            <ChevronLeft aria-hidden className="size-4" />
          </Link>
          <Link href={href({ d: next, td: undefined })} className={nav} aria-label={view === "week" ? "Next week" : "Next month"} scroll={false}>
            <ChevronRight aria-hidden className="size-4" />
          </Link>
          <Link href={href({ d: undefined, td: undefined })} className="inline-flex h-9 items-center rounded-[3px] border border-line px-3 text-[13px] font-medium transition-colors hover:border-ink" scroll={false}>
            Today
          </Link>
          <h2 className="ml-2 text-[15px] font-semibold num">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden text-[11.5px] text-muted lg:block">All times IST</p>
          <div className="inline-flex rounded-[3px] bg-mist p-1" role="tablist" aria-label="Calendar view">
            {(["week", "month"] as const).map((v) => (
              <Link
                key={v}
                role="tab"
                aria-selected={view === v}
                href={href({ cal: v === "week" ? undefined : "month", td: undefined })}
                scroll={false}
                className={cn("inline-flex h-8 items-center rounded-[2px] px-4 text-[13px] font-medium capitalize transition-colors duration-300", view === v ? "bg-white text-ink shadow-soft" : "text-muted hover:text-ink")}
              >
                {v}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {view === "week" ? <Week from={from} today={today} byDay={byDay} href={href} /> : <Month from={from} to={to} month={anchor.slice(0, 7)} today={today} byDay={byDay} href={href} />}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-3 text-[11.5px] text-muted">
        {[
          ["Scheduled", "border border-ink bg-ink"],
          ["Accepted, time to confirm", "border border-ink/20 bg-white"],
          ["Requested", "border border-dashed border-red/60 bg-white"],
          ["Completed", "border border-[#cfe6d6] bg-[#e8f5ec]"],
          ["No-show", "border border-[#f3dfb8] bg-[#fdf3e1]"],
        ].map(([label, cls]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("inline-block size-3 rounded-[2px]", cls)} /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Week({ from, today, byDay, href }: { from: string; today: string; byDay: Map<string, TestDriveItem[]>; href: (p: Record<string, string | undefined>) => string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const hours = Array.from({ length: (END_MIN - START_MIN) / 60 }, (_, i) => START_MIN / 60 + i);
  return (
    <>
      {/* Phones: agenda */}
      <ol className="divide-y divide-line md:hidden">
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          const date = parseYmd(d);
          return (
            <li key={d} className="flex gap-4 px-4 py-3.5">
              <div className={cn("w-11 shrink-0 text-center", d === today && "text-red")}>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{WEEKDAYS[date.getUTCDay()]}</p>
                <p className="font-display text-[20px] font-semibold leading-tight num">{date.getUTCDate()}</p>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {list.length ? (
                  list.map((t) => (
                    <Link key={t.id} href={href({ td: String(t.id) })} scroll={false} className={cn("block rounded-[3px] px-3 py-2 text-[12.5px] transition-opacity hover:opacity-85", chipClass(t))}>
                      <span className="font-semibold num">{formatTime(when(t)!)}</span> · {t.customerName}
                      <span className="block truncate opacity-75">{t.carLabel}</span>
                    </Link>
                  ))
                ) : (
                  <p className="pt-2 text-[12.5px] text-muted/70">No test drives</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Tablets and up: time grid */}
      <div className="hidden md:block">
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-line">
          <div />
          {days.map((d) => {
            const date = parseYmd(d);
            return (
              <div key={d} className={cn("border-l border-line px-2 py-2.5 text-center", d === today && "bg-red-50/60")}>
                <p className={cn("text-[11px] font-medium uppercase tracking-[0.08em]", d === today ? "text-red" : "text-muted")}>{WEEKDAYS[date.getUTCDay()]}</p>
                <p className={cn("font-display text-[18px] font-semibold leading-tight num", d === today && "text-red")}>{date.getUTCDate()}</p>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h, i) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10.5px] text-muted num" style={{ top: i * HOUR_PX }}>
                {i === 0 ? "" : `${((h + 11) % 12) + 1} ${h >= 12 ? "pm" : "am"}`}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const list = byDay.get(d) ?? [];
            // Side-by-side lanes for overlapping bookings.
            const lanes: number[] = [];
            const placed = list.map((t) => {
              const start = Math.min(Math.max(istMinutes(when(t)!), START_MIN), END_MIN - 45);
              let lane = lanes.findIndex((end) => end <= start);
              if (lane === -1) lane = lanes.push(0) - 1;
              lanes[lane] = start + 45;
              return { t, start, lane };
            });
            const width = 100 / Math.max(1, lanes.length);
            return (
              <div
                key={d}
                className={cn("relative border-l border-line", d === today && "bg-red-50/30")}
                style={{ height: hours.length * HOUR_PX, backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--color-line) ${HOUR_PX - 1}px, var(--color-line) ${HOUR_PX}px)` }}
              >
                {placed.map(({ t, start, lane }) => (
                  <Link
                    key={t.id}
                    href={href({ td: String(t.id) })}
                    scroll={false}
                    title={`${formatTime(when(t)!)} · ${t.customerName} · ${t.carLabel}`}
                    className={cn("absolute overflow-hidden rounded-[3px] px-2 py-1.5 text-[11.5px] leading-tight transition-[opacity,transform] duration-300 hover:-translate-y-px hover:opacity-90", chipClass(t))}
                    style={{ top: ((start - START_MIN) / 60) * HOUR_PX + 2, height: HOUR_PX * 0.75 - 4, left: `calc(${lane * width}% + 3px)`, width: `calc(${width}% - 6px)` }}
                  >
                    <span className="block truncate font-semibold num">{formatTime(when(t)!)}</span>
                    <span className="block truncate">{t.customerName}</span>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Month({ from, to, month, today, byDay, href }: { from: string; to: string; month: string; today: string; byDay: Map<string, TestDriveItem[]>; href: (p: Record<string, string | undefined>) => string }) {
  const days: string[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) days.push(d);
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
          <p key={w} className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            {w}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const list = byDay.get(d) ?? [];
          const inMonth = d.startsWith(month);
          const date = parseYmd(d);
          return (
            <div key={d} className={cn("min-h-[64px] border-line p-1 md:min-h-[118px] md:p-1.5", i % 7 !== 0 && "border-l", i >= 7 && "border-t", !inMonth && "bg-mist/50")}>
              <Link
                href={href({ cal: undefined, d, td: undefined })}
                scroll={false}
                aria-label={`Week of ${formatIstDay(istMidnight(d))}${list.length ? `, ${list.length} test drive${list.length === 1 ? "" : "s"}` : ""}`}
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-full text-[12.5px] font-medium transition-colors num hover:bg-mist",
                  d === today ? "bg-red text-white hover:bg-red-600" : inMonth ? "text-ink" : "text-muted/60",
                )}
              >
                {date.getUTCDate()}
              </Link>
              {list.length > 0 && <span className="mt-1 block text-center text-[10.5px] font-semibold text-ink md:hidden num">{list.length}</span>}
              <ul className="mt-1 hidden space-y-1 md:block">
                {list.slice(0, 3).map((t) => (
                  <li key={t.id}>
                    <Link href={href({ td: String(t.id) })} scroll={false} title={`${t.customerName} · ${t.carLabel}`} className={cn("block truncate rounded-[2px] px-1.5 py-0.5 text-[11px] leading-snug transition-opacity hover:opacity-85", chipClass(t))}>
                      <span className="font-semibold num">{formatTime(when(t)!).replace(":00", "")}</span> {t.customerName}
                    </Link>
                  </li>
                ))}
                {list.length > 3 && (
                  <li>
                    <Link href={href({ cal: undefined, d, td: undefined })} scroll={false} className="block px-1.5 text-[11px] font-medium text-muted hover:text-ink">
                      +{list.length - 3} more
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
