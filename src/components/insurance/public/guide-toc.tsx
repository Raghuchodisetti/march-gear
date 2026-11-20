"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TocItem {
  id: string;
  text: string;
}

/** The guide's headings — a sticky list on desktop (highlighting the section in view) and a collapsible panel on mobile. */
export function GuideToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => Boolean(e));
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-140px 0px -60% 0px", threshold: 0 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);

  if (!items.length) return null;

  const list = (onPick?: () => void) => (
    <ol className="space-y-1">
      {items.map((it, i) => (
        <li key={it.id}>
          <a
            href={`#${it.id}`}
            onClick={onPick}
            aria-current={active === it.id ? "location" : undefined}
            className={cn(
              "flex gap-3 border-l-2 py-1.5 pl-3 text-[13.5px] leading-snug transition-colors duration-[250ms]",
              active === it.id ? "border-red font-medium text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            <span className="w-4 shrink-0 text-[11px] num">{i + 1}</span>
            {it.text}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      {/* Mobile */}
      <div className="border border-line lg:hidden">
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[14px] font-semibold">
          In this guide
          <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-[350ms]", open && "rotate-180 text-red")} />
        </button>
        {open && <div className="border-t border-line px-2 py-3">{list(() => setOpen(false))}</div>}
      </div>
      {/* Desktop */}
      <nav aria-label="In this guide" className="hidden lg:block">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">In this guide</p>
        {list()}
      </nav>
    </>
  );
}
