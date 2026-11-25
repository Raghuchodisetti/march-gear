"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CalendarRange, LayoutGrid, Megaphone, MessageSquareWarning, Plus, Rows3, Search } from "lucide-react";
import { INS_CAMPAIGN_TYPES } from "@/db/enums";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { INS_CAMPAIGN_STATUS_LABEL, INS_CAMPAIGN_STATUS_TONE, INS_CAMPAIGN_TYPE_LABEL, type InsCampaignDisplay } from "@/insurance/labels";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/portal/ui";
import { Callout } from "@/components/portal/offers/offer-ui";
import { formatWindow } from "@/components/offers/offer-utils";
import { CampaignArt } from "./campaign-preview";
import { CampaignActions, useCampaignCommands } from "./campaign-actions";
import type { CampaignListItem } from "./shared";

/* The vendor's promotional campaigns: status tabs, search, type filter, cards or table, and every action. */

const TABS: { value: string; label: string; match: InsCampaignDisplay[] }[] = [
  { value: "all", label: "All", match: [] },
  { value: "draft", label: "Drafts", match: ["draft"] },
  { value: "pending", label: "In review", match: ["pending_approval"] },
  { value: "changes", label: "Changes requested", match: ["changes_requested"] },
  { value: "scheduled", label: "Scheduled", match: ["scheduled"] },
  { value: "active", label: "Live", match: ["active"] },
  { value: "paused", label: "Paused", match: ["paused"] },
  { value: "expired", label: "Ended", match: ["expired"] },
  { value: "rejected", label: "Rejected", match: ["rejected"] },
  { value: "cancelled", label: "Cancelled", match: ["cancelled"] },
];

const n = (v: number) => v.toLocaleString("en-IN");
const ctr = (views: number, clicks: number) => (views ? `${((clicks / views) * 100).toFixed(1)}%` : "—");

export function CampaignList({ items, canManage, initial }: { items: CampaignListItem[]; canManage: boolean; initial: { status?: string; q?: string; type?: string; view?: string } }) {
  const [tab, setTab] = useState(TABS.some((t) => t.value === initial.status) ? initial.status! : "all");
  const [q, setQ] = useState(initial.q ?? "");
  const [type, setType] = useState(initial.type && (INS_CAMPAIGN_TYPES as readonly string[]).includes(initial.type) ? initial.type : "");
  const [view, setView] = useState<"cards" | "table">(initial.view === "table" ? "table" : "cards");
  const { run, node } = useCampaignCommands();

  const sync = (patch: Record<string, string>) => {
    const next = { status: tab, q, type, view, ...patch };
    const p = new URLSearchParams();
    if (next.status !== "all") p.set("status", next.status);
    if (next.q.trim()) p.set("q", next.q.trim());
    if (next.type) p.set("type", next.type);
    if (next.view === "table") p.set("view", "table");
    const s = p.toString();
    window.history.replaceState(window.history.state, "", s ? `/insurance-vendor/campaigns?${s}` : "/insurance-vendor/campaigns");
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TABS) c[t.value] = t.match.length ? items.filter((i) => t.match.includes(i.display)).length : items.length;
    return c;
  }, [items]);

  const shown = useMemo(() => {
    const t = TABS.find((x) => x.value === tab)!;
    const needle = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!t.match.length || t.match.includes(i.display)) &&
        (!type || i.type === type) &&
        (!needle || `${i.title} ${i.reference} ${i.summary} ${i.productNames.join(" ")}`.toLowerCase().includes(needle)),
    );
  }, [items, tab, q, type]);

  if (!items.length) return <FirstCampaign canManage={canManage} />;

  return (
    <div>
      <Tabs
        ariaLabel="Campaign status"
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
          <span className="sr-only">Search campaigns</span>
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              sync({ q: e.target.value });
            }}
            placeholder="Search title, reference or product"
            className="h-10 w-full rounded-[3px] border border-line bg-white pl-10 pr-3 text-[13.5px] outline-none transition-colors hover:border-ink/30 focus:border-ink"
          />
        </label>
        <select
          aria-label="Campaign type"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            sync({ type: e.target.value });
          }}
          className="h-10 cursor-pointer rounded-[3px] border border-line bg-white px-3 text-[13.5px] outline-none transition-colors hover:border-ink/30 focus:border-ink"
        >
          <option value="">All types</option>
          {INS_CAMPAIGN_TYPES.map((t) => (
            <option key={t} value={t}>
              {INS_CAMPAIGN_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3 md:ml-auto">
          <p className="text-[12.5px] text-muted num">
            {shown.length} of {items.length}
          </p>
          <div role="radiogroup" aria-label="Layout" className="ml-auto inline-flex rounded-[3px] bg-white p-1 ring-1 ring-inset ring-line md:ml-0">
            {(
              [
                ["cards", "Cards", LayoutGrid],
                ["table", "Table", Rows3],
              ] as const
            ).map(([val, label, Icon]) => (
              <button
                key={val}
                type="button"
                role="radio"
                aria-checked={view === val}
                onClick={() => {
                  setView(val);
                  sync({ view: val });
                }}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-[2px] px-3 text-[12.5px] font-medium transition-colors", view === val ? "bg-ink text-white" : "text-muted hover:text-ink")}
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
            <p className="type-h4">No campaigns here</p>
            <p className="mt-1.5 text-[13.5px] text-muted">Try another tab, type or search.</p>
          </div>
        ) : view === "cards" ? (
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {shown.map((c, i) => (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: EASE, delay: Math.min(i, 6) * 0.04 }}
                  className="min-w-0"
                >
                  <CampaignTile item={c} canManage={canManage} run={run} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <CampaignTable items={shown} canManage={canManage} run={run} />
        )}
      </div>
      {node}
    </div>
  );
}

type Run = Parameters<typeof CampaignActions>[0]["run"];

function CampaignTile({ item, canManage, run }: { item: CampaignListItem; canManage: boolean; run: Run }) {
  const remarks = item.adminRemarks && (item.display === "changes_requested" || item.display === "rejected");
  return (
    <article className="flex h-full flex-col border border-line bg-white transition-[border-color] duration-500 hover:border-ink/25">
      <Link href={`/insurance-vendor/campaigns/${item.id}`} className="relative block" aria-label={`Open ${item.title}`}>
        <CampaignArt banner={item.banner} type={item.type} className="aspect-[16/7]" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-ink/15" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="inline-flex shadow-soft">
            <Badge tone={INS_CAMPAIGN_STATUS_TONE[item.display]}>{INS_CAMPAIGN_STATUS_LABEL[item.display]}</Badge>
          </span>
          <span className="inline-flex h-6 max-w-[55%] items-center truncate rounded-[2px] bg-ink/65 px-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white backdrop-blur-sm">{item.typeLabel}</span>
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="truncate font-mono text-[11px] text-muted">{item.reference}</p>
        <h3 className="mt-1.5 line-clamp-2 text-[16px] font-semibold leading-snug">
          <Link href={`/insurance-vendor/campaigns/${item.id}`} className="hover:underline">
            {item.title}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-[13px] text-muted">{item.summary || "No summary yet."}</p>
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted">
          <CalendarRange aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{formatWindow(item.startsAt, item.endsAt)}</span>
        </p>
        <p className="mt-1 truncate text-[12.5px] text-muted">{item.productNames.length ? item.productNames.join(", ") : "No products selected"}</p>
        {remarks && (
          <Callout tone={item.display === "rejected" ? "red" : "amber"} icon={<MessageSquareWarning />} title="MarchGear says" className="mt-4">
            <p className="line-clamp-3 whitespace-pre-line">{item.adminRemarks}</p>
          </Callout>
        )}
        <div className="mt-auto pt-5">
          <dl className="grid grid-cols-4 gap-2 border-t border-line pt-4">
            {(
              [
                ["Views", n(item.views)],
                ["Clicks", n(item.clicks)],
                ["CTR", ctr(item.views, item.clicks)],
                ["Enquiries", n(item.enquiries)],
              ] as const
            ).map(([l, v]) => (
              <div key={l} className="min-w-0">
                <dt className="text-[11px] text-muted">{l}</dt>
                <dd className="mt-0.5 truncate font-display text-[16px] font-semibold tracking-[-0.02em] num">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <footer className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
        <Link href={`/insurance-vendor/campaigns/${item.id}`} className="truncate text-[12.5px] font-medium text-ink underline-offset-4 hover:underline">
          View details<span className="sr-only">: {item.title}</span>
        </Link>
        <CampaignActions item={item} canManage={canManage} run={run} compact />
      </footer>
    </article>
  );
}

function CampaignTable({ items, canManage, run }: { items: CampaignListItem[]; canManage: boolean; run: Run }) {
  return (
    <div className="relative overflow-x-auto border border-line bg-white">
      <table className="w-full min-w-[960px] border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-line bg-[#F6F6F6] text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">
            <th className="px-3 py-3 font-semibold">Campaign</th>
            <th className="px-3 py-3 font-semibold">Status</th>
            <th className="px-3 py-3 font-semibold">Runs</th>
            <th className="px-3 py-3 text-right font-semibold">Performance</th>
            <th className="px-3 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id} className="border-b border-line align-middle transition-colors last:border-b-0 hover:bg-[#FAFAFA]">
              <td className="px-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <CampaignArt banner={c.banner} type={c.type} className="aspect-[16/9] w-16 shrink-0 rounded-[2px]" />
                  <div className="min-w-0 max-w-[260px]">
                    <Link href={`/insurance-vendor/campaigns/${c.id}`} className="block truncate font-medium hover:underline">
                      {c.title}
                    </Link>
                    <p className="truncate text-[12px] text-muted">
                      <span className="font-mono">{c.reference}</span> · {c.typeLabel}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3">
                <Badge tone={INS_CAMPAIGN_STATUS_TONE[c.display]}>{INS_CAMPAIGN_STATUS_LABEL[c.display]}</Badge>
              </td>
              <td className="whitespace-nowrap px-3 py-3">{formatWindow(c.startsAt, c.endsAt)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right text-[12.5px] num">
                <p>
                  {n(c.views)} <span className="text-muted">views</span> · {n(c.clicks)} <span className="text-muted">clicks</span>
                </p>
                <p className="text-muted">
                  {n(c.enquiries)} enq. · {n(c.conversions)} policies
                </p>
              </td>
              <td className="px-3 py-3">
                <CampaignActions item={c} canManage={canManage} run={run} compact className="justify-end" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FirstCampaign({ canManage }: { canManage: boolean }) {
  return (
    <div className="border border-line bg-white px-6 py-16 text-center">
      <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-mist">
        <Megaphone aria-hidden className="size-5 text-ink/60" />
      </span>
      <h2 className="mt-4 font-display text-[18px] font-semibold">Launch your first campaign</h2>
      <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">
        Promote a product launch, a renewal drive or an EV cover. MarchGear reviews it against the insurance advertising rules, then it runs on the insurance pages between your dates.
      </p>
      {canManage && (
        <div className="mt-7 flex justify-center">
          <Button href="/insurance-vendor/campaigns/new" icon={<Plus className="size-4" aria-hidden />}>
            Create a campaign
          </Button>
        </div>
      )}
    </div>
  );
}
