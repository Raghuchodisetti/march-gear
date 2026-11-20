"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CalendarRange, LayoutGrid, MessageSquareWarning, Plus, Rows3, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { OfferArt } from "@/components/offers/offer-card";
import { Countdown, useNow } from "@/components/offers/countdown";
import { formatWindow } from "@/components/offers/offer-utils";
import { OFFER_CATEGORY_LABEL, type OfferDisplayStatus } from "@/partner/labels";
import type { OfferListItem } from "./offer-input";
import { OfferActions, useOfferCommands } from "./offer-actions";
import { Callout, Meter, StatusPill, windowProgress } from "./offer-ui";

/* The dealer's offers: status tabs, search, category filter, cards or table, and every action. */

const TABS: { value: string; label: string; match: OfferDisplayStatus[] }[] = [
  { value: "all", label: "All", match: [] },
  { value: "draft", label: "Draft", match: ["draft"] },
  { value: "pending", label: "Pending approval", match: ["submitted", "pending_approval"] },
  { value: "changes", label: "Changes requested", match: ["changes_requested"] },
  { value: "scheduled", label: "Scheduled", match: ["scheduled"] },
  { value: "active", label: "Active", match: ["active"] },
  { value: "paused", label: "Paused", match: ["paused"] },
  { value: "expired", label: "Expired", match: ["expired"] },
  { value: "rejected", label: "Rejected", match: ["rejected"] },
  { value: "cancelled", label: "Cancelled", match: ["cancelled"] },
];

const n = (v: number) => v.toLocaleString("en-IN");

export function OfferList({
  items,
  canManage,
  renderedAt,
  initial,
}: {
  items: OfferListItem[];
  canManage: boolean;
  renderedAt: number;
  initial: { status?: string; q?: string; category?: string; view?: string };
}) {
  const [tab, setTab] = useState(TABS.some((t) => t.value === initial.status) ? initial.status! : "all");
  const [q, setQ] = useState(initial.q ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [view, setView] = useState<"cards" | "table">(initial.view === "table" ? "table" : "cards");
  const { run, node } = useOfferCommands();

  const sync = (patch: Record<string, string>) => {
    const next = { status: tab, q, category, view, ...patch };
    const p = new URLSearchParams();
    if (next.status !== "all") p.set("status", next.status);
    if (next.q.trim()) p.set("q", next.q.trim());
    if (next.category) p.set("category", next.category);
    if (next.view === "table") p.set("view", "table");
    const s = p.toString();
    window.history.replaceState(null, "", s ? `/dealer/offers?${s}` : "/dealer/offers");
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TABS) c[t.value] = t.match.length ? items.filter((i) => t.match.includes(i.display)).length : items.length;
    return c;
  }, [items]);

  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))], [items]);

  const shown = useMemo(() => {
    const t = TABS.find((x) => x.value === tab)!;
    const needle = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!t.match.length || t.match.includes(i.display)) &&
        (!category || i.category === category) &&
        (!needle || `${i.title} ${i.reference} ${i.campaignName} ${i.tagline}`.toLowerCase().includes(needle)),
    );
  }, [items, tab, q, category]);

  if (!items.length) return <FirstOffer canManage={canManage} />;

  return (
    <div>
      <Tabs
        ariaLabel="Offer status"
        size="sm"
        value={tab}
        onChange={(v) => {
          setTab(v);
          sync({ status: v });
        }}
        items={TABS.filter((t) => t.value === "all" || counts[t.value] > 0 || t.value === tab).map((t) => ({ value: t.value, label: t.label, count: counts[t.value] }))}
      />

      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative block min-w-0 flex-1 md:max-w-sm">
          <span className="sr-only">Search offers</span>
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              sync({ q: e.target.value });
            }}
            placeholder="Search title, reference or campaign"
            className="h-10 w-full rounded-[3px] border border-line bg-white pl-10 pr-3 text-[13.5px] outline-none transition-colors hover:border-ink/30 focus:border-ink"
          />
        </label>
        <select
          aria-label="Category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            sync({ category: e.target.value });
          }}
          className="h-10 cursor-pointer rounded-[3px] border border-line bg-white px-3 text-[13.5px] outline-none transition-colors hover:border-ink/30 focus:border-ink"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {OFFER_CATEGORY_LABEL[c as keyof typeof OFFER_CATEGORY_LABEL] ?? c}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3 md:ml-auto">
          <p className="text-[12.5px] text-muted num">
            {shown.length} of {items.length}
          </p>
          <div role="radiogroup" aria-label="Layout" className="inline-flex rounded-[3px] bg-white p-1 ring-1 ring-inset ring-line">
            {(
              [
                ["cards", "Cards", LayoutGrid],
                ["table", "Table", Rows3],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                onClick={() => {
                  setView(v);
                  sync({ view: v });
                }}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-[2px] px-3 text-[12.5px] font-medium transition-colors", view === v ? "bg-ink text-white" : "text-muted hover:text-ink")}
              >
                <Icon aria-hidden className="size-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        {shown.length === 0 ? (
          <div className="border border-dashed border-line bg-white px-6 py-16 text-center">
            <p className="type-h4">No offers here</p>
            <p className="mt-1.5 text-[13.5px] text-muted">Try another tab, category or search.</p>
          </div>
        ) : view === "cards" ? (
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {shown.map((o, i) => (
                <motion.li
                  key={o.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: EASE, delay: Math.min(i, 6) * 0.04 }}
                  className="min-w-0"
                >
                  <OfferTile item={o} canManage={canManage} run={run} renderedAt={renderedAt} eager={i < 2} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <OfferTable items={shown} canManage={canManage} run={run} renderedAt={renderedAt} />
        )}
      </div>
      {node}
    </div>
  );
}

function Thumb({ item, className }: { item: OfferListItem; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-ink", className)}>
      <OfferArt image={item.image} headline="" sizes="200px" />
    </div>
  );
}

function OfferTile({ item, canManage, run, renderedAt, eager }: { item: OfferListItem; canManage: boolean; run: Parameters<typeof OfferActions>[0]["run"]; renderedAt: number; eager?: boolean }) {
  const now = useNow(renderedAt);
  const running = item.display === "active";
  const remarks = item.adminRemarks && (item.display === "changes_requested" || item.display === "rejected");
  return (
    <article className="group/offer flex h-full flex-col border border-line bg-white transition-[border-color] duration-500 hover:border-ink/25">
      <div className="relative aspect-[16/8] overflow-hidden bg-ink">
        <OfferArt image={item.image} headline="" sizes="(min-width: 1536px) 30vw, (min-width: 768px) 45vw, 92vw" eager={eager} />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-ink/20" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <StatusPill status={item.display} solid />
          <span className="inline-flex h-6 max-w-[55%] items-center truncate rounded-[2px] bg-ink/65 px-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white backdrop-blur-sm">{item.categoryLabel}</span>
        </div>
        {(running || item.display === "scheduled") && (
          <span className="absolute bottom-3 left-3 inline-flex h-6 items-center rounded-[2px] bg-ink/70 px-2 backdrop-blur-sm">
            <Countdown startsAt={item.startsAt} endsAt={item.endsAt} renderedAt={renderedAt} tone="light" compact />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="truncate font-mono text-[11px] text-muted">
          {item.reference}
          {item.campaignName ? ` · ${item.campaignName}` : ""}
        </p>
        <h3 className="mt-1.5 line-clamp-2 text-[16px] font-semibold leading-snug">
          <Link href={`/dealer/offers/${item.id}/edit`} className="hover:underline">
            {item.title || "Untitled offer"}
          </Link>
        </h3>
        <p className="mt-1 font-display text-[17px] font-semibold tracking-[-0.01em] text-red">{item.benefits ? item.headline : "No benefits yet"}</p>
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted">
          <CalendarRange aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{formatWindow(item.startsAt, item.endsAt)}</span>
        </p>
        {running && <Meter value={windowProgress(item.startsAt, item.endsAt, now)} tone="green" className="mt-2" />}
        <p className="mt-2 truncate text-[12.5px] text-muted">
          {item.vehicleLabel} · {item.locationLabel}
        </p>
        {remarks && (
          <Callout tone={item.display === "rejected" ? "red" : "amber"} icon={<MessageSquareWarning />} title="MarchGear says" className="mt-4">
            <p className="line-clamp-3 whitespace-pre-line">{item.adminRemarks}</p>
          </Callout>
        )}
        <div className="mt-auto pt-5">
        <dl className="grid grid-cols-3 gap-3 border-t border-line pt-4">
          {(
            [
              ["Views", item.views],
              ["Enquiries", item.enquiries],
              ["Conversions", item.conversions],
            ] as const
          ).map(([l, v]) => (
            <div key={l} className="min-w-0">
              <dt className="text-[11px] text-muted">{l}</dt>
              <dd className="mt-0.5 font-display text-[17px] font-semibold tracking-[-0.02em] num">{n(v)}</dd>
            </div>
          ))}
        </dl>
        </div>
      </div>
      <footer className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
        {item.enquiries > 0 ? (
          <Link href={`/dealer/enquiries?offer=${item.id}`} className="truncate text-[12.5px] font-medium text-ink underline-offset-4 hover:underline">
            View enquiries
          </Link>
        ) : (
          <span className="truncate text-[12px] text-muted">Updated {new Date(item.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</span>
        )}
        <OfferActions item={item} canManage={canManage} run={run} compact />
      </footer>
    </article>
  );
}

function OfferTable({ items, canManage, run, renderedAt }: { items: OfferListItem[]; canManage: boolean; run: Parameters<typeof OfferActions>[0]["run"]; renderedAt: number }) {
  return (
    <div className="relative overflow-x-auto border border-line bg-white">
      <table className="w-full min-w-[980px] border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-line bg-[#F6F6F6] text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">
            <th className="px-3 py-3 font-semibold">Offer</th>
            <th className="px-3 py-3 font-semibold">Status</th>
            <th className="px-3 py-3 font-semibold">Validity</th>
            <th className="px-3 py-3 font-semibold">Discount</th>
            <th className="px-3 py-3 text-right font-semibold">Performance</th>
            <th className="px-3 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((o) => (
            <tr key={o.id} className="border-b border-line align-middle transition-colors last:border-b-0 hover:bg-[#FAFAFA]">
              <td className="px-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Thumb item={o} className="aspect-[4/3] w-16 shrink-0 rounded-[2px]" />
                  <div className="min-w-0 max-w-[200px]">
                    <Link href={`/dealer/offers/${o.id}/edit`} className="block truncate font-medium hover:underline">
                      {o.title || "Untitled offer"}
                    </Link>
                    <p className="truncate text-[12px] text-muted">
                      <span className="font-mono">{o.reference}</span> · {o.categoryLabel}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3">
                <StatusPill status={o.display} />
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                <p>{formatWindow(o.startsAt, o.endsAt)}</p>
                {(o.display === "active" || o.display === "scheduled") && <Countdown startsAt={o.startsAt} endsAt={o.endsAt} renderedAt={renderedAt} compact />}
              </td>
              <td className="px-3 py-3">
                {/* Auto table layout ignores a cell's max-width — cap the text so long headlines truncate. */}
                <p className="max-w-[170px] truncate font-medium text-red" title={o.benefits ? o.headline : undefined}>
                  {o.benefits ? o.headline : "—"}
                </p>
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right text-[12.5px] num">
                <p>
                  {n(o.views)} <span className="text-muted">views</span>
                </p>
                <p className="text-muted">
                  {o.enquiries > 0 ? (
                    <Link href={`/dealer/enquiries?offer=${o.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                      {n(o.enquiries)} enq.
                    </Link>
                  ) : (
                    "0 enq."
                  )}{" "}
                  · {n(o.conversions)} won
                </p>
              </td>
              <td className="px-3 py-3">
                <OfferActions item={o} canManage={canManage} run={run} compact className="justify-end" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FirstOffer({ canManage }: { canManage: boolean }) {
  return (
    <div className="relative overflow-hidden border border-line bg-white px-6 py-16 text-center md:py-24">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-red/[0.06]" />
      <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-red-50 text-red">
        <Sparkles aria-hidden className="size-6" />
      </span>
      <h2 className="type-h3 mt-6">Launch your first offer</h2>
      <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">
        Start from a festival template or from scratch. MarchGear reviews it, then it goes live on your showroom page, the model pages and the offers hub — and expires on its own.
      </p>
      {canManage && (
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <Button href="/dealer/offers/create" icon={<Plus className="size-4" aria-hidden />}>
            Create an offer
          </Button>
          <Button href="/dealer/offers/create#templates" variant="outline">
            Browse templates
          </Button>
        </div>
      )}
    </div>
  );
}
