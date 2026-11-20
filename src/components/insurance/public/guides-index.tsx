"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { GuideImage, guideHref, type GuideSummary } from "./guides";

/** All guides with a topic filter: the first match leads large, the rest follow in a grid. */
export function GuidesIndex({ guides }: { guides: GuideSummary[] }) {
  const topics = useMemo(() => [...new Set(guides.map((g) => g.topic))], [guides]);
  const [topic, setTopic] = useState("All");
  const shown = topic === "All" ? guides : guides.filter((g) => g.topic === topic);
  const [lead, ...rest] = shown;

  return (
    <div>
      <div role="tablist" aria-label="Filter guides by topic" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
        {["All", ...topics].map((t) => {
          const on = t === topic;
          const n = t === "All" ? guides.length : guides.filter((g) => g.topic === t).length;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTopic(t)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13.5px] transition-colors duration-[250ms]",
                on ? "border-ink bg-ink text-white" : "border-line text-ink hover:border-ink",
              )}
            >
              {t}
              <span className={cn("text-[11.5px] num", on ? "text-white/60" : "text-muted")}>{n}</span>
            </button>
          );
        })}
      </div>

      {lead && (
        <Link href={guideHref(lead.slug)} className="group mt-10 grid grid-cols-1 items-center gap-8 border-b border-line pb-12 lg:grid-cols-12 lg:gap-12">
          <GuideImage guide={lead} sizes="(min-width: 1024px) 55vw, 100vw" className="aspect-[16/10] lg:col-span-7" priority />
          <div className="lg:col-span-5">
            <p className="flex items-center gap-3 text-[12px] text-muted">
              <span className="font-semibold uppercase tracking-[0.14em] text-red">{lead.topic}</span>
              <span className="inline-flex items-center gap-1 num">
                <Clock aria-hidden className="size-3.5" /> {lead.minutes} min read
              </span>
            </p>
            <h2 className="type-h2 mt-4 text-balance transition-colors duration-[250ms] group-hover:text-red">{lead.title}</h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-muted">{lead.summary}</p>
            <span className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium">
              Read the guide
              <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      )}

      {rest.length > 0 && (
        <ul className="mt-12 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((g) => (
            <li key={g.slug}>
              <Link href={guideHref(g.slug)} className="group block">
                <GuideImage guide={g} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw" className="aspect-[16/10]" />
                <p className="mt-5 flex items-center gap-3 text-[11.5px] text-muted">
                  <span className="font-semibold uppercase tracking-[0.14em] text-red">{g.topic}</span>
                  <span className="inline-flex items-center gap-1 num">
                    <Clock aria-hidden className="size-3" /> {g.minutes} min
                  </span>
                </p>
                <h3 className="mt-2 text-[18px] font-semibold leading-snug transition-colors duration-[250ms] group-hover:text-red">{g.title}</h3>
                <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-muted">{g.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
