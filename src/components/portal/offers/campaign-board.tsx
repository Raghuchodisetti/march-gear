"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, ListOrdered, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/portal/ui";
import { OfferArt } from "@/components/offers/offer-card";
import { Countdown, useNow } from "@/components/offers/countdown";
import { addDays, formatIst, formatWindow, istDay } from "@/components/offers/offer-utils";
import { CRM_STATUS_LABEL, CRM_STATUS_TONE, OFFER_STATUS_LABEL, type OfferDisplayStatus } from "@/partner/labels";
import type { CrmStatus } from "@/db/enums";
import type { OfferListItem } from "./offer-input";
import { OfferActions, useOfferCommands } from "./offer-actions";
import { BAR_TONE, Meter, StatusPill, windowProgress } from "./offer-ui";

export interface OfferLead {
  id: number;
  reference: string;
  name: string;
  carLabel: string | null;
  status: CrmStatus;
  offerId: number;
  createdAt: string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const HIDDEN: OfferDisplayStatus[] = ["rejected", "cancelled"];
const n = (v: number) => v.toLocaleString("en-IN");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "—");

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const shiftMonth = (ym: string, by: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};

function monthWeeks(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const first = `${ym}-01`;
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const start = addDays(first, -lead);
  return Array.from({ length: Math.ceil((lead + days) / 7) }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

export function CampaignBoard({ items, leads, canManage, canSeeLeads, renderedAt, initialMonth }: { items: OfferListItem[]; leads: OfferLead[]; canManage: boolean; canSeeLeads: boolean; renderedAt: number; initialMonth: string }) {
  const [view, setView] = useState<"calendar" | "schedule">("calendar");
  const [month, setMonth] = useState(initialMonth);
  const [showClosed, setShowClosed] = useState(false);
  const [selected, setSelected] = useState<OfferListItem | null>(null);
  const { run, node } = useOfferCommands();
  const now = useNow(renderedAt);

  const visible = items.filter((i) => showClosed || !HIDDEN.includes(i.display));

  return (
    <div className="space-y-10">
      <section className="border border-line bg-white">
        <header className="flex flex-col gap-4 border-b border-line px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div role="radiogroup" aria-label="View" className="inline-flex self-start rounded-[3px] bg-mist p-1">
            {(
              [
                ["calendar", "Calendar", CalendarDays],
                ["schedule", "Schedule", ListOrdered],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                onClick={() => setView(v)}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-[2px] px-3 text-[13px] font-medium transition-colors", view === v ? "bg-white text-ink shadow-soft" : "text-muted hover:text-ink")}
              >
                <Icon aria-hidden className="size-4" /> {label}
              </button>
            ))}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-muted">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="size-4 accent-[var(--color-red)]" />
            Show rejected &amp; cancelled
          </label>
        </header>
        {view === "calendar" ? (
          <MonthView items={visible} month={month} setMonth={setMonth} today={istDay(now)} thisMonth={initialMonth} onSelect={setSelected} />
        ) : (
          <ScheduleView items={visible} now={now} renderedAt={renderedAt} onSelect={setSelected} />
        )}
      </section>

      <Performance items={items} />

      <Enquiries items={items} leads={leads} canSeeLeads={canSeeLeads} />

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title="Offer">
        {selected && (
          <div>
            <div className="relative aspect-[16/8] overflow-hidden bg-ink">
              <OfferArt image={selected.image} headline={selected.headline} sizes="448px" />
              <div className="absolute left-3 top-3">
                <StatusPill status={selected.display} solid />
              </div>
            </div>
            <div className="space-y-5 p-5">
              <div>
                <p className="font-mono text-[11.5px] text-muted">
                  {selected.reference}
                  {selected.campaignName ? ` · ${selected.campaignName}` : ""}
                </p>
                <h3 className="mt-1 text-[17px] font-semibold leading-snug">{selected.title || "Untitled offer"}</h3>
                <p className="mt-1 font-display text-[18px] font-semibold text-red">{selected.headline}</p>
              </div>
              <dl className="grid grid-cols-2 gap-4 border-y border-line py-4 text-[13px]">
                <div>
                  <dt className="text-[11.5px] text-muted">Starts</dt>
                  <dd>{formatIst(selected.startsAt)}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-muted">{selected.display === "expired" ? "Expired" : "Expires automatically"}</dt>
                  <dd>{formatIst(selected.endsAt)}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-muted">Vehicles</dt>
                  <dd>{selected.vehicleLabel}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-muted">Valid at</dt>
                  <dd>{selected.locationLabel}</dd>
                </div>
              </dl>
              {(selected.display === "active" || selected.display === "scheduled") && <Countdown startsAt={selected.startsAt} endsAt={selected.endsAt} renderedAt={renderedAt} />}
              <dl className="grid grid-cols-3 gap-3">
                {(
                  [
                    ["Views", selected.views],
                    ["Enquiries", selected.enquiries],
                    ["Conversions", selected.conversions],
                  ] as const
                ).map(([l, v]) => (
                  <div key={l}>
                    <dt className="text-[11.5px] text-muted">{l}</dt>
                    <dd className="font-display text-[20px] font-semibold num">{n(v)}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <OfferActions item={selected} canManage={canManage} run={(c, i) => {
                    setSelected(null);
                    run(c, i);
                  }} />
                {selected.enquiries > 0 && (
                  <Button href={`/dealer/enquiries?offer=${selected.id}`} size="sm" variant="ghost">
                    View enquiries
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>
      {node}
    </div>
  );
}

/* ── Month calendar ─────────────────────────────────────────── */

function MonthView({ items, month, setMonth, today, thisMonth, onSelect }: { items: OfferListItem[]; month: string; setMonth: (m: string) => void; today: string; thisMonth: string; onSelect: (o: OfferListItem) => void }) {
  const weeks = useMemo(() => monthWeeks(month), [month]);
  const spans = useMemo(() => items.map((o) => ({ o, s: istDay(o.startsAt), e: istDay(o.endsAt) })), [items]);
  const [y, m] = month.split("-").map(Number);
  const inMonth = spans.filter((x) => x.s <= `${month}-31` && x.e >= `${month}-01`).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month" className="inline-flex size-9 items-center justify-center rounded-full border border-line hover:border-ink">
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month" className="inline-flex size-9 items-center justify-center rounded-full border border-line hover:border-ink">
            <ChevronRight aria-hidden className="size-4" />
          </button>
          <h3 className="ml-2 font-display text-[20px] font-semibold tracking-[-0.02em]" aria-live="polite">
            {MONTHS[m - 1]} {y}
          </h3>
          {month !== thisMonth && (
            <button type="button" onClick={() => setMonth(thisMonth)} className="ml-1 h-8 rounded-[3px] px-2.5 text-[12.5px] font-medium text-muted hover:bg-mist hover:text-ink">
              Today
            </button>
          )}
        </div>
        <p className="text-[12.5px] text-muted">
          {inMonth} offer{inMonth === 1 ? "" : "s"} this month
        </p>
      </div>
      <div className="border-t border-line">
        <div className="grid grid-cols-7 border-b border-line bg-[#F6F6F6]">
          {WEEKDAYS.map((d) => (
            <p key={d} className="px-1.5 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted sm:text-left sm:px-2.5">
              <span className="sm:hidden">{d[0]}</span>
              <span className="hidden sm:inline">{d}</span>
            </p>
          ))}
        </div>
        {weeks.map((week) => {
          const ws = week[0];
          const we = week[6];
          const bars = spans
            .filter((x) => x.s <= we && x.e >= ws)
            .sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : a.e < b.e ? 1 : -1))
            .map((x) => ({ ...x, from: Math.max(0, dayDiff(ws, x.s)), to: Math.min(6, dayDiff(ws, x.e)), cont: x.s < ws, more: x.e > we }));
          const lanes: number[] = [];
          const placed = bars.map((b) => {
            let lane = lanes.findIndex((end) => end < b.from);
            if (lane === -1) lane = lanes.push(-1) - 1;
            lanes[lane] = b.to;
            return { ...b, lane };
          });
          const height = 34 + Math.max(lanes.length, 1) * 26 + 10;
          return (
            <div key={ws} className="relative grid grid-cols-7 border-b border-line last:border-b-0" style={{ minHeight: Math.max(96, height) }}>
              {week.map((d) => {
                const out = d.slice(0, 7) !== month;
                return (
                  <div key={d} className={cn("border-r border-line px-1.5 py-1.5 last:border-r-0 sm:px-2.5", out && "bg-[#FAFAFA]")}>
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-[12px] num",
                        d === today ? "bg-red font-semibold text-white" : out ? "text-ink/30" : "text-ink/70",
                      )}
                    >
                      {Number(d.slice(8))}
                    </span>
                  </div>
                );
              })}
              <div className="pointer-events-none absolute inset-x-0 top-[34px] grid grid-cols-7" style={{ gridAutoRows: "26px" }}>
                {placed.map((b) => (
                  <button
                    key={b.o.id}
                    type="button"
                    onClick={() => onSelect(b.o)}
                    title={`${b.o.title || "Untitled offer"} · ${OFFER_STATUS_LABEL[b.o.display]} · ${formatWindow(b.o.startsAt, b.o.endsAt)}`}
                    style={{ gridColumn: `${b.from + 1} / ${b.to + 2}`, gridRow: b.lane + 1 }}
                    className={cn(
                      "pointer-events-auto mx-0.5 my-[2px] flex min-w-0 items-center gap-1 overflow-hidden rounded-[3px] px-1.5 text-left text-[11px] font-medium leading-none transition-[filter,transform] duration-300 hover:brightness-95",
                      BAR_TONE[b.o.display],
                      b.cont && "ml-0 rounded-l-none",
                      b.more && "mr-0 rounded-r-none",
                    )}
                  >
                    <span className="truncate">{b.o.title || b.o.reference}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line px-5 py-3 text-[11.5px] text-muted">
        {(["active", "scheduled", "paused", "pending_approval", "draft", "expired"] as OfferDisplayStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn("inline-block h-2.5 w-5 rounded-[2px]", BAR_TONE[s])} />
            {OFFER_STATUS_LABEL[s]}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Schedule (list) ────────────────────────────────────────── */

function ScheduleView({ items, now, renderedAt, onSelect }: { items: OfferListItem[]; now: number; renderedAt: number; onSelect: (o: OfferListItem) => void }) {
  const byEnd = (a: OfferListItem, b: OfferListItem) => a.endsAt.localeCompare(b.endsAt);
  const groups: { title: string; note: string; items: OfferListItem[] }[] = [
    { title: "Live now", note: "Each expires automatically at its end time", items: items.filter((i) => i.display === "active").sort(byEnd) },
    { title: "Scheduled", note: "Approved — goes live on its start date", items: items.filter((i) => i.display === "scheduled").sort((a, b) => a.startsAt.localeCompare(b.startsAt)) },
    { title: "Paused", note: "Approved but hidden until you resume", items: items.filter((i) => i.display === "paused").sort(byEnd) },
    { title: "Awaiting approval", note: "With MarchGear, or waiting for your changes", items: items.filter((i) => ["submitted", "pending_approval", "changes_requested"].includes(i.display)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)) },
    { title: "Drafts", note: "Not submitted yet", items: items.filter((i) => i.display === "draft").sort((a, b) => a.startsAt.localeCompare(b.startsAt)) },
    { title: "Ended", note: "Expired automatically", items: items.filter((i) => i.display === "expired").sort((a, b) => b.endsAt.localeCompare(a.endsAt)).slice(0, 12) },
    { title: "Closed", note: "Rejected or cancelled", items: items.filter((i) => HIDDEN.includes(i.display)) },
  ].filter((g) => g.items.length);

  if (!groups.length) return <p className="px-5 py-16 text-center text-[14px] text-muted">No offers yet. Create one to see it scheduled here.</p>;

  return (
    <div className="divide-y divide-line">
      {groups.map((g) => (
        <div key={g.title} className="px-5 py-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-[14px] font-semibold">
              {g.title} <span className="ml-1 text-[12px] font-normal text-muted num">{g.items.length}</span>
            </h3>
            <p className="hidden text-[12px] text-muted sm:block">{g.note}</p>
          </div>
          <ul className="space-y-2">
            {g.items.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => onSelect(o)} className="group/row grid w-full grid-cols-1 gap-2 rounded-[4px] border border-line bg-white px-4 py-3 text-left transition-colors hover:border-ink/30 sm:grid-cols-[minmax(0,1fr)_220px_160px] sm:items-center sm:gap-5">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">{o.title || "Untitled offer"}</span>
                    <span className="block truncate text-[12px] text-muted">
                      <span className="font-mono">{o.reference}</span> · {o.headline}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px]">{formatWindow(o.startsAt, o.endsAt)}</span>
                    {o.display === "active" && <Meter value={windowProgress(o.startsAt, o.endsAt, now)} tone="green" className="mt-1.5" />}
                  </span>
                  <span className="flex items-center justify-between gap-2 sm:justify-end">
                    {o.display === "active" || o.display === "scheduled" ? (
                      <Countdown startsAt={o.startsAt} endsAt={o.endsAt} renderedAt={renderedAt} />
                    ) : o.display === "expired" ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                        <Timer aria-hidden className="size-3.5" /> Ended {formatIst(o.endsAt, false)}
                      </span>
                    ) : (
                      <StatusPill status={o.display} />
                    )}
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-ink/30 transition-colors group-hover/row:text-ink" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ── Performance ────────────────────────────────────────────── */

function Performance({ items }: { items: OfferListItem[] }) {
  const rows = items.filter((i) => i.approvedAt || i.views || i.enquiries || ["scheduled", "active", "paused", "expired"].includes(i.display)).sort((a, b) => b.views - a.views || b.enquiries - a.enquiries);
  const max = Math.max(1, ...rows.map((r) => r.views));
  return (
    <section>
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="type-eyebrow text-red">Performance</p>
          <h2 className="mt-2 font-display text-[22px] font-semibold tracking-[-0.02em]">How each offer is doing</h2>
        </div>
        <p className="text-[12.5px] text-muted">Views from the offer page · enquiries from the website and CRM · conversions are bookings or sales</p>
      </div>
      {rows.length === 0 ? (
        <div className="border border-dashed border-line bg-white px-6 py-12 text-center text-[13.5px] text-muted">Numbers appear once an offer is approved and customers start seeing it.</div>
      ) : (
        <div className="relative overflow-x-auto border border-line bg-white">
          <table className="w-full min-w-[820px] border-collapse text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-line bg-[#F6F6F6] text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">
                <th className="px-4 py-3 font-semibold">Offer</th>
                <th className="w-[26%] px-4 py-3 font-semibold">Views</th>
                <th className="px-4 py-3 text-right font-semibold">Enquiries</th>
                <th className="px-4 py-3 text-right font-semibold">Enquiry rate</th>
                <th className="px-4 py-3 text-right font-semibold">Conversions</th>
                <th className="px-4 py-3 text-right font-semibold">Win rate</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Enquiries</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-b-0 hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3">
                    <div className="min-w-0 max-w-[280px]">
                      <Link href={`/dealer/offers/${o.id}/edit`} className="block truncate font-medium hover:underline">
                        {o.title || "Untitled offer"}
                      </Link>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusPill status={o.display} />
                        <span className="truncate text-[12px] text-muted">{formatWindow(o.startsAt, o.endsAt)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Meter value={o.views / max} className="flex-1" />
                      <span className="w-12 shrink-0 text-right num">{n(o.views)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right num">{n(o.enquiries)}</td>
                  <td className="px-4 py-3 text-right text-muted num">{pct(o.enquiries, o.views)}</td>
                  <td className="px-4 py-3 text-right font-medium num">{n(o.conversions)}</td>
                  <td className="px-4 py-3 text-right text-muted num">{pct(o.conversions, o.enquiries)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dealer/enquiries?offer=${o.id}`} className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-medium hover:underline">
                      Enquiries <ArrowUpRight aria-hidden className="size-3.5 text-red" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ── Offer-wise enquiries ───────────────────────────────────── */

function Enquiries({ items, leads, canSeeLeads }: { items: OfferListItem[]; leads: OfferLead[]; canSeeLeads: boolean }) {
  const withLeads = items.filter((i) => i.enquiries > 0).sort((a, b) => b.enquiries - a.enquiries);
  return (
    <section>
      <div className="mb-4">
        <p className="type-eyebrow text-red">Enquiries</p>
        <h2 className="mt-2 font-display text-[22px] font-semibold tracking-[-0.02em]">Enquiries by offer</h2>
      </div>
      {withLeads.length === 0 ? (
        <div className="border border-dashed border-line bg-white px-6 py-12 text-center text-[13.5px] text-muted">No enquiries from offers yet. They appear here — and in Enquiries — as soon as customers respond.</div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {withLeads.map((o) => {
            const mine = leads.filter((l) => l.offerId === o.id);
            return (
              <li key={o.id} className="min-w-0 border border-line bg-white">
                <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold">{o.title || "Untitled offer"}</p>
                    <p className="text-[12px] text-muted">
                      {n(o.enquiries)} enquir{o.enquiries === 1 ? "y" : "ies"} · {n(o.conversions)} converted
                    </p>
                  </div>
                  <Link href={`/dealer/enquiries?offer=${o.id}`} className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium hover:underline">
                    Open in CRM <ArrowUpRight aria-hidden className="size-3.5 text-red" />
                  </Link>
                </div>
                {canSeeLeads && mine.length > 0 ? (
                  <ul className="divide-y divide-line">
                    {mine.slice(0, 4).map((l) => (
                      <li key={l.id}>
                        <Link href={`/dealer/enquiries?offer=${o.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#FAFAFA]">
                          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-mist text-[12px] font-semibold">{l.name.slice(0, 1).toUpperCase()}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium">{l.name}</span>
                            <span className="block truncate text-[12px] text-muted">
                              {l.carLabel || l.reference} · {new Date(l.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
                            </span>
                          </span>
                          <Badge tone={CRM_STATUS_TONE[l.status]}>{CRM_STATUS_LABEL[l.status]}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-4 text-[12.5px] text-muted">
                    {canSeeLeads ? "Website enquiries for this offer will show here once they reach your CRM." : "You don't have access to enquiry details."}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
