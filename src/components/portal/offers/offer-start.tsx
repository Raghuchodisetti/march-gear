"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, CalendarRange, FilePlus2, History, Info, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { useUI } from "@/components/providers/app-provider";
import { PortalHeader } from "@/components/portal/ui";
import { OfferArt } from "@/components/offers/offer-card";
import { formatWindow } from "@/components/offers/offer-utils";
import { duplicateOfferAction } from "@/server/actions/partner-offers";
import type { OfferListItem, OfferTemplateView } from "./offer-input";
import { StatusPill } from "./offer-ui";

const TONE: Record<OfferTemplateView["tone"], string> = {
  red: "bg-[#E31E24]",
  ink: "bg-[#111111]",
  gold: "bg-[#8a6a2f]",
  green: "bg-[#1f5c44]",
  blue: "bg-[#1d3b6e]",
  violet: "bg-[#463868]",
};

/** How would you like to start? Blank, a festival/campaign template, or a previous offer. */
export function OfferStart({ templates, previous }: { templates: OfferTemplateView[]; previous: OfferListItem[] }) {
  const [reuseOpen, setReuseOpen] = useState(false);
  return (
    <>
      <PortalHeader title="Create offer" description="Start from a festival or campaign template, reuse a past offer, or begin with a blank form. Drafts save as you type." back={{ href: "/dealer/offers", label: "Offers" }} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link href="/dealer/offers/create?start=blank" className="group/start relative flex min-h-[176px] flex-col justify-between overflow-hidden border border-line bg-white p-6 transition-[border-color] duration-500 hover:border-ink">
          <span aria-hidden className="absolute -right-12 -top-12 size-40 rounded-full bg-red/[0.06] transition-transform duration-[900ms] ease-[var(--ease-premium)] group-hover/start:scale-125" />
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-red text-white">
            <FilePlus2 aria-hidden className="size-5" />
          </span>
          <span>
            <span className="mt-6 block font-display text-[21px] font-semibold tracking-[-0.02em]">Start from scratch</span>
            <span className="mt-1 flex items-center justify-between gap-3 text-[13.5px] text-muted">
              A blank offer, starting tomorrow for 30 days.
              <ArrowRight aria-hidden className="size-5 shrink-0 text-ink transition-transform duration-300 group-hover/start:translate-x-1" />
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setReuseOpen(true)}
          disabled={!previous.length}
          className="group/start relative flex min-h-[176px] flex-col justify-between overflow-hidden border border-line bg-white p-6 text-left transition-[border-color] duration-500 hover:border-ink disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line"
        >
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-ink text-white">
            <History aria-hidden className="size-5" />
          </span>
          <span>
            <span className="mt-6 block font-display text-[21px] font-semibold tracking-[-0.02em]">Reuse a previous offer</span>
            <span className="mt-1 flex items-center justify-between gap-3 text-[13.5px] text-muted">
              {previous.length ? `Copy one of your ${previous.length} offers into a new draft.` : "Your past offers will appear here."}
              <ArrowRight aria-hidden className="size-5 shrink-0 text-ink transition-transform duration-300 group-hover/start:translate-x-1" />
            </span>
          </span>
        </button>
      </div>

      <section id="templates" className="mt-12 scroll-mt-24">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="type-eyebrow text-red">Templates</p>
            <h2 className="mt-2 font-display text-[24px] font-semibold tracking-[-0.02em]">Festival & campaign templates</h2>
          </div>
          <p className="max-w-md text-[13px] text-muted sm:text-right">Each prefills the title, tagline, category, terms and a suggested window — everything stays editable.</p>
        </div>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {templates.map((t) => (
            <li key={t.key} className="min-w-0">
              <Link href={`/dealer/offers/create?template=${t.key}`} className="group/t flex h-full flex-col overflow-hidden border border-line bg-white transition-[border-color] duration-500 hover:border-ink">
                <div className={cn("relative h-28 overflow-hidden text-white", TONE[t.tone])}>
                  <span aria-hidden className="absolute -right-8 -top-10 size-36 rotate-12 bg-white/10 transition-transform duration-[900ms] ease-[var(--ease-premium)] group-hover/t:rotate-[20deg] group-hover/t:scale-110" />
                  <span aria-hidden className="absolute -right-2 top-16 h-px w-48 rotate-12 bg-white/25" />
                  <p className="absolute left-5 top-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/70">{t.categoryLabel}</p>
                  <p className="absolute bottom-4 left-5 right-5 font-display text-[24px] font-semibold leading-none tracking-[-0.025em]">{t.name}</p>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-[13.5px] leading-relaxed text-ink/80">{t.blurb}</p>
                  <p className="mt-4 flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                    <CalendarRange aria-hidden className="size-3.5 shrink-0 text-red" /> {t.windowLabel}
                  </p>
                  <p className="mt-1.5 flex gap-1.5 text-[11.5px] leading-snug text-muted">
                    <Info aria-hidden className="mt-px size-3 shrink-0" />
                    <span className="line-clamp-3">{t.dateNote}</span>
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1 pt-4 text-[13px] font-medium">
                    Use template <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-300 group-hover/t:-translate-y-0.5 group-hover/t:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Modal open={reuseOpen} onClose={() => setReuseOpen(false)} title="Reuse a previous offer" description="Copies everything into a new draft. Past dates move to start tomorrow with the same length." size="lg">
        {reuseOpen && <ReusePicker items={previous} />}
      </Modal>
    </>
  );
}

function ReusePicker({ items }: { items: OfferListItem[] }) {
  const router = useRouter();
  const { toast } = useUI();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return items.filter((i) => !n || `${i.title} ${i.reference} ${i.campaignName} ${i.categoryLabel}`.toLowerCase().includes(n));
  }, [items, q]);

  const reuse = async (item: OfferListItem) => {
    setBusy(item.id);
    try {
      const r = await duplicateOfferAction({ id: item.id, mode: "reuse" });
      if (!r.ok) {
        toast((r as { error?: string }).error ?? "Couldn't copy the offer.", { tone: "error" });
        setBusy(null);
        return;
      }
      toast(`New draft ${r.reference} created from ${item.reference}`, { tone: "success" });
      router.push(`/dealer/offers/${r.id}/edit`);
    } catch {
      toast("Couldn't reach the server. Check your connection.", { tone: "error" });
      setBusy(null);
    }
  };

  return (
    <div className="p-5 sm:p-6">
      <label className="relative block">
        <span className="sr-only">Search your offers</span>
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          data-autofocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title, reference or campaign"
          className="h-11 w-full rounded-[3px] border border-line pl-10 pr-3 text-[14px] outline-none hover:border-ink/30 focus:border-ink"
        />
      </label>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {shown.length === 0 && <li className="py-10 text-center text-[13.5px] text-muted">No offers match.</li>}
        {shown.map((o) => (
          <li key={o.id} className="flex items-center gap-4 py-3">
            <div className="relative hidden aspect-[4/3] w-20 shrink-0 overflow-hidden bg-ink sm:block">
              <OfferArt image={o.image} headline="" sizes="80px" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{o.title || "Untitled offer"}</p>
              <p className="truncate text-[12px] text-muted">
                <span className="font-mono">{o.reference}</span> · {o.categoryLabel} · {formatWindow(o.startsAt, o.endsAt)}
              </p>
              <div className="mt-1.5">
                <StatusPill status={o.display} />
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => reuse(o)} disabled={busy !== null} icon={busy === o.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : undefined}>
              Reuse
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
