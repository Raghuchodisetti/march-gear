"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Clock, FileText, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GuideCover } from "./guide-cover";

export interface BrowserGuide {
  slug: string;
  href: string;
  subject: string;
  subjectSlug: string;
  title: string;
  summary: string;
  minutes: number;
  /** Already formatted ("25 Nov 2026"), so server and browser render the same text. */
  updated: string;
  pdfPages: number | null;
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

export function GuideCard({ g }: { g: BrowserGuide }) {
  return (
    <Link
      href={g.href}
      className="group flex h-full flex-col overflow-hidden rounded-[4px] border border-line bg-white transition-[border-color,box-shadow,transform] duration-[250ms] ease-[var(--ease-premium)] hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-[0_18px_40px_-24px_rgba(17,17,17,0.45)]"
    >
      <GuideCover subject={g.subject} title={g.title} className="aspect-[16/10] p-6" />
      <div className="flex flex-1 flex-col p-6">
        {g.summary ? <p className="line-clamp-3 text-[14px] leading-relaxed text-muted">{g.summary}</p> : <p className="text-[14px] text-muted">{g.title}</p>}
        <div className="mt-auto flex items-center justify-between gap-4 pt-6">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted num">
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden className="size-3.5" /> {g.minutes} min read
            </span>
            {g.pdfPages ? (
              <span className="inline-flex items-center gap-1">
                <FileText aria-hidden className="size-3.5" /> {g.pdfPages}-page guide
              </span>
            ) : null}
          </p>
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-colors duration-[250ms] group-hover:border-red group-hover:bg-red group-hover:text-white">
            <ArrowUpRight aria-hidden className="size-4" />
            <span className="sr-only">Read {g.title}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Guides with subject chips and a search box (all on the page already — filtering is instant). */
export function GuidesBrowser({ guides }: { guides: BrowserGuide[] }) {
  const [subject, setSubject] = useState("all");
  const [q, setQ] = useState("");

  const subjects = useMemo(() => {
    const m = new Map<string, { slug: string; name: string; count: number }>();
    for (const g of guides) {
      const s = m.get(g.subjectSlug) ?? { slug: g.subjectSlug, name: g.subject, count: 0 };
      s.count++;
      m.set(g.subjectSlug, s);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
  }, [guides]);

  const terms = norm(q).split(/\s+/).filter(Boolean);
  const shown = guides.filter((g) => (subject === "all" || g.subjectSlug === subject) && terms.every((t) => norm(`${g.title} ${g.subject} ${g.summary}`).includes(t)));
  const active = subjects.find((s) => s.slug === subject);

  const chip = (on: boolean) =>
    cn(
      "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13.5px] font-medium transition-colors duration-200",
      on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/40",
    );

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label="Subjects" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          <button type="button" aria-pressed={subject === "all"} onClick={() => setSubject("all")} className={chip(subject === "all")}>
            All <span className={cn("text-[12px] num", subject === "all" ? "text-white/60" : "text-muted")}>{guides.length}</span>
          </button>
          {subjects.map((s) => (
            <button key={s.slug} type="button" aria-pressed={subject === s.slug} onClick={() => setSubject(s.slug)} className={chip(subject === s.slug)}>
              {s.name} <span className={cn("text-[12px] num", subject === s.slug ? "text-white/60" : "text-muted")}>{s.count}</span>
            </button>
          ))}
        </div>
        <label className="relative block w-full md:w-80">
          <span className="sr-only">Search guides</span>
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search guides"
            className="h-11 w-full rounded-full border border-line bg-white pl-11 pr-10 text-[14px] text-ink outline-none transition-colors placeholder:text-muted hover:border-ink/30 focus:border-ink [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink" aria-label="Clear search">
              <X aria-hidden className="size-4" />
            </button>
          )}
        </label>
      </div>

      <p className="mt-8 text-[13px] text-muted" aria-live="polite">
        {shown.length === guides.length && !terms.length
          ? `${guides.length} ${guides.length === 1 ? "guide" : "guides"}`
          : `${shown.length} ${shown.length === 1 ? "guide" : "guides"}${active ? ` in ${active.name}` : ""}${terms.length ? ` matching “${q.trim()}”` : ""}`}
      </p>

      {shown.length ? (
        <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {shown.map((g) => (
            <li key={g.slug}>
              <GuideCard g={g} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 flex flex-col items-center rounded-[4px] border border-dashed border-line px-6 py-16 text-center">
          <p className="text-[15px] font-medium">No guides match that.</p>
          <p className="mt-1.5 text-[14px] text-muted">Try fewer words, or another subject.</p>
          <button
            type="button"
            onClick={() => {
              setQ("");
              setSubject("all");
            }}
            className="mt-5 text-[14px] font-medium underline underline-offset-4 hover:text-red"
          >
            Show all guides
          </button>
        </div>
      )}
    </div>
  );
}
