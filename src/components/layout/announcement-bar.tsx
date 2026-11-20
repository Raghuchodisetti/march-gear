"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, X } from "lucide-react";
import { announcementStore, useStore } from "@/lib/store";
import { EASE } from "@/lib/motion";
import { useCatalog } from "@/components/providers/catalog-provider";

/** Messages come from the "announcements" content block; with none, the bar is hidden. */
export function AnnouncementBar() {
  const announcements = useCatalog().content.announcements.items;
  const count = announcements.length;
  const dismissed = useStore(announcementStore);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (dismissed || paused || count < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => window.clearInterval(id);
  }, [dismissed, paused, count]);

  if (dismissed || count === 0) return null;
  const item = announcements[index % count];

  return (
    <div
      className="relative z-[51] bg-ink text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="container-x flex h-9 items-center justify-center gap-4">
        <div className="relative flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="flex min-w-0 items-center"
            >
              <Link href={item.href} className="group flex min-w-0 items-center gap-3 text-[12.5px]">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-red">{item.tag}</span>
                <span aria-hidden className="h-3 w-px shrink-0 bg-white/20" />
                <span className="truncate text-white/80 transition-colors group-hover:text-white">{item.text}</span>
                <ArrowRight aria-hidden className="hidden size-3.5 shrink-0 text-white/60 transition-transform group-hover:translate-x-0.5 sm:block" />
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="hidden shrink-0 items-center gap-1.5 md:flex" aria-hidden>
          {announcements.map((_, i) => (
            <span key={i} className={`h-px w-4 transition-colors duration-500 ${i === index % count ? "bg-white" : "bg-white/25"}`} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => announcementStore.set(true)}
          aria-label="Dismiss announcements"
          className="-mr-2 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
