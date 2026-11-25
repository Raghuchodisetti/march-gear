"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Sticky table of contents that tracks the section in view. */
export function LegalToc({ sections }: { sections: { id: string; title: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        const first = sections.find((s) => visible.get(s.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-100px 0px -55% 0px" },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="On this page">
      <p className="type-eyebrow text-muted">On this page</p>
      <ol className="mt-5 border-l border-line">
        {sections.map((s, i) => {
          const current = active === s.id;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={current ? "location" : undefined}
                className={cn(
                  "relative -ml-px flex gap-3 border-l py-2 pl-4 text-[13.5px] leading-snug transition-colors duration-[250ms]",
                  current ? "border-red font-medium text-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                <span className="w-5 shrink-0 text-[11.5px] num">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
