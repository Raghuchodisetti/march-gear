"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatPriceShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { useUI } from "@/components/providers/app-provider";
import { useCarDetail } from "./context";
import { scrollToSection } from "./buy-actions";
import { NAV_OFFSET } from "./utils";

export interface NavSection {
  id: string;
  label: string;
}

/**
 * Sticky in-page navigation with scroll-spy. Once the hero's buy panel has
 * scrolled away, desktop gains a compact price + CTA so enquiry stays one
 * click away; mobile relies on the bottom action bar instead.
 */
export function SectionNav({ sections }: { sections: NavSection[] }) {
  const { car, title, variant, onRoad, city } = useCarDetail();
  const { openEnquiry } = useUI();
  const [active, setActive] = useState(sections[0]?.id);
  const [compact, setCompact] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        let current = sections[0]?.id;
        for (const s of sections) {
          const el = document.getElementById(s.id);
          if (el && el.getBoundingClientRect().top - NAV_OFFSET - 24 <= 0) current = s.id;
        }
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
        const last = document.getElementById(sections[sections.length - 1].id);
        if (atBottom && last && last.getBoundingClientRect().top < window.innerHeight) current = sections[sections.length - 1].id;
        setActive(current);

        const panel = document.getElementById("buy-panel");
        setCompact(panel ? panel.getBoundingClientRect().bottom < NAV_OFFSET : window.scrollY > 640);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sections]);

  // Keep the active link visible inside the horizontally scrolling list.
  useEffect(() => {
    const list = listRef.current;
    const link = list?.querySelector<HTMLElement>(`[data-section="${active}"]`);
    if (!list || !link) return;
    const target = link.offsetLeft - list.clientWidth / 2 + link.offsetWidth / 2;
    list.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active]);

  return (
    <nav
      aria-label={`${title} sections`}
      className={cn("sticky top-[72px] z-40 border-b border-line bg-white/95 backdrop-blur-md", !compact && "border-t")}
    >
      <div className="container-x flex h-14 items-stretch gap-6">
        <AnimatePresence initial={false}>
          {compact && (
            <motion.div
              key="identity"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="hidden shrink-0 items-center gap-3 border-r border-line pr-6 lg:flex"
            >
              <span className="relative h-9 w-12 overflow-hidden bg-mist">
                <Image src={car.images[0]} alt="" fill sizes="48px" className="object-cover" style={{ objectPosition: car.focus ?? "50% 55%" }} />
              </span>
              <span className="min-w-0">
                <span className="block max-w-[180px] truncate text-[13px] font-semibold">{title}</span>
                <span className="block max-w-[180px] truncate text-[11.5px] text-muted">
                  <span className="font-medium text-ink num">{formatPriceShort(onRoad)}</span> on-road · {city.name}
                </span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          ref={listRef}
          className="no-scrollbar relative -mx-5 flex min-w-0 flex-1 items-stretch gap-6 overflow-x-auto px-5 md:mx-0 md:px-0 [mask-image:linear-gradient(to_right,transparent,#000_20px,#000_calc(100%-28px),transparent)] md:[mask-image:linear-gradient(to_right,#000_calc(100%-40px),transparent)]"
        >
          {sections.map((s) => {
            const isActive = s.id === active;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                data-section={s.id}
                aria-current={isActive ? "location" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setActive(s.id);
                  scrollToSection(s.id, NAV_OFFSET);
                }}
                className={cn(
                  "relative flex shrink-0 items-center whitespace-nowrap text-[13px] font-medium transition-colors duration-[250ms]",
                  isActive ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                {s.label}
                {isActive && (
                  <motion.span
                    layoutId="car-section-indicator"
                    className="absolute inset-x-0 -bottom-px h-[2px] bg-red"
                    transition={{ duration: 0.4, ease: EASE }}
                  />
                )}
              </a>
            );
          })}
          <span aria-hidden className="w-2 shrink-0" />
        </div>

        <AnimatePresence initial={false}>
          {compact && (
            <motion.div
              key="cta"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="hidden shrink-0 items-center gap-2 lg:flex"
            >
              <Button
                size="sm"
                variant="ghost"
                className="hidden xl:inline-flex"
                onClick={() => openEnquiry({ kind: "test-drive", subject: title, detail: variant.name, carSlug: car.slug })}
              >
                Test drive
              </Button>
              <Button size="sm" onClick={() => openEnquiry({ kind: "best-price", subject: title, detail: `${variant.name} · ${city.name}`, carSlug: car.slug })}>
                Get best price
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
