import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AD_FORMAT_LABEL, AD_STATUS_LABEL, adDisplayStatus } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { scheduleData, type ScheduleBar } from "@/server/ads/admin";
import { AdminHeader, strParam } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { addDays, daysBetween, istDate, rupees } from "@/components/portal/billing/shared";
import { dayLabel, occupancyByDay, rangeLabel } from "@/components/ads/shared";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ad schedule" };

const WEEKS = 8;
const DAYS = WEEKS * 7;
const DOW = ["M", "T", "W", "T", "F", "S", "S"];

/** Monday of the IST week containing `iso`. */
const monday = (iso: string) => addDays(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));
const isDay = (v: string | undefined) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)));

/** Greedy lanes so overlapping campaigns sit on separate rows. */
function lanes(bars: ScheduleBar[]) {
  const out: ScheduleBar[][] = [];
  for (const b of [...bars].sort((a, z) => a.startsOn.localeCompare(z.startsOn))) {
    const lane = out.find((l) => l[l.length - 1].endsOn < b.startsOn);
    if (lane) lane.push(b);
    else out.push([b]);
  }
  return out;
}

const BAR: Record<string, string> = {
  live: "bg-ink text-white",
  scheduled: "bg-[#2456a6] text-white",
  ended: "bg-ink/15 text-ink/60",
  paused: "bg-[#fdf3e1] text-[#9a5b00] ring-1 ring-inset ring-[#e0b66a]",
  pending_approval: "border border-dashed border-[#2456a6]/60 bg-[#eef3fc] text-[#2456a6]",
  changes_requested: "border border-dashed border-[#d08a16]/70 bg-[#fdf3e1] text-[#9a5b00]",
};

export default async function AdSchedulePage({ searchParams }: PageProps<"/admin/advertising/schedule">) {
  await requireStaff();
  const sp = await searchParams;
  const today = istDate();
  const fromParam = strParam(sp.from);
  const from = monday(isDay(fromParam) ? fromParam! : today);
  const { placements, bars } = await scheduleData(from, DAYS);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));
  const base = "/admin/advertising/schedule";
  const to = days[DAYS - 1];

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/advertising", label: "Ad campaigns" }}
        title="Schedule"
        description="Eight weeks of every placement: how many slots each day has taken (booked and awaiting review) and which campaigns hold them."
        actions={
          <Button href="/admin/advertising/new" size="sm" icon={<Plus className="size-4" aria-hidden />}>
            House campaign
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`${base}?from=${addDays(from, -DAYS)}`} aria-label="Previous eight weeks" className="inline-flex size-9 items-center justify-center rounded-full border border-line bg-white hover:border-ink">
            <ChevronLeft aria-hidden className="size-4" />
          </Link>
          <p className="min-w-[200px] text-center text-[14px] font-semibold">{rangeLabel(from, to)}</p>
          <Link href={`${base}?from=${addDays(from, DAYS)}`} aria-label="Next eight weeks" className="inline-flex size-9 items-center justify-center rounded-full border border-line bg-white hover:border-ink">
            <ChevronRight aria-hidden className="size-4" />
          </Link>
          {from !== monday(today) && (
            <Link href={base} className="ml-1 text-[13px] font-medium text-red hover:underline">
              This week
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-muted">
          {(["live", "scheduled", "pending_approval", "changes_requested", "paused"] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cn("inline-block h-2.5 w-5 rounded-[2px]", BAR[s])} /> {AD_STATUS_LABEL[s]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-5 rounded-[2px] bg-red" /> House
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {placements.map((p) => {
          const list = bars.get(p.id) ?? [];
          const occ = occupancyByDay(list, from, to);
          const full = days.filter((d) => occ[d] >= p.slots).length;
          const taken = days.reduce((s, d) => s + Math.min(occ[d], p.slots), 0);
          const rows = lanes(list);
          return (
            <section key={p.id} className="border border-line bg-white">
              <header className="flex flex-col gap-1 border-b border-line px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-[14.5px] font-semibold">
                    {p.name} {!p.isActive && <span className="ml-1 rounded-full bg-mist px-2 py-0.5 text-[11px] font-semibold text-muted">Off</span>}
                  </h2>
                  <p className="text-[12px] text-muted">
                    {AD_FORMAT_LABEL[p.format]} · {p.slots} slot{p.slots === 1 ? "" : "s"} · {rupees(p.pricePerDay)}/day
                  </p>
                </div>
                <p className="text-[12.5px] text-muted num">
                  {Math.round((taken / (p.slots * DAYS)) * 100)}% booked · {full} sold-out day{full === 1 ? "" : "s"}
                </p>
              </header>
              <div className="overflow-x-auto">
                <div className="min-w-[1000px] px-4 pb-4 pt-3" style={{ display: "grid", gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))`, rowGap: 4 }}>
                  {/* Week labels */}
                  {days.map((d, i) =>
                    i % 7 === 0 ? (
                      <div key={`w-${d}`} style={{ gridColumn: `${i + 1} / span 7` }} className="border-l border-line pl-1.5 text-[11px] font-semibold text-ink/70">
                        {dayLabel(d, false)}
                      </div>
                    ) : null,
                  )}
                  {/* Day letters */}
                  {days.map((d, i) => (
                    <div key={`d-${d}`} className={cn("text-center text-[10px] text-muted", d === today && "font-bold text-red")}>
                      {DOW[i % 7]}
                    </div>
                  ))}
                  {/* Occupancy */}
                  {days.map((d) => {
                    const v = occ[d] ?? 0;
                    const isFull = v >= p.slots;
                    return (
                      <div
                        key={`o-${d}`}
                        title={`${dayLabel(d)}: ${v} of ${p.slots} slot${p.slots === 1 ? "" : "s"} taken`}
                        className={cn(
                          "mx-px flex h-7 items-center justify-center rounded-[2px] text-[10.5px] font-semibold num",
                          isFull ? "bg-red text-white" : v > 0 ? "bg-ink/[0.12] text-ink" : "bg-[#F6F6F6] text-ink/30",
                          d === today && "ring-2 ring-red ring-offset-1",
                          d < today && "opacity-50",
                        )}
                      >
                        {v}
                      </div>
                    );
                  })}
                  {/* Campaign lanes */}
                  {rows.length === 0 && (
                    <div style={{ gridColumn: `1 / span ${DAYS}` }} className="py-3 text-center text-[12.5px] text-muted">
                      No campaigns in these weeks.
                    </div>
                  )}
                  {rows.map((lane, li) =>
                    lane.map((b) => {
                      const s = b.startsOn < from ? from : b.startsOn;
                      const e = b.endsOn > to ? to : b.endsOn;
                      const start = daysBetween(from, s) + 1;
                      const span = daysBetween(s, e) + 1;
                      const display = adDisplayStatus(b, today);
                      return (
                        <Link
                          key={b.id}
                          href={`/admin/advertising/${b.id}`}
                          title={`${b.name} · ${b.advertiser} · ${rangeLabel(b.startsOn, b.endsOn)} · ${AD_STATUS_LABEL[display]}`}
                          style={{ gridColumn: `${start} / span ${span}`, gridRow: 4 + li }}
                          className={cn("mx-px flex h-7 min-w-0 items-center overflow-hidden rounded-[3px] px-2 text-[11.5px] font-medium transition-opacity hover:opacity-85", b.house && (display === "live" || display === "scheduled") ? "bg-red text-white" : BAR[display] ?? "bg-mist")}
                        >
                          <span className="truncate">
                            {b.advertiser} · {b.name}
                          </span>
                        </Link>
                      );
                    }),
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
