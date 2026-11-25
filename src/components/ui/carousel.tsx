"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Native scroll-snap carousel. Touch devices get momentum swipe for free;
 * mouse users get arrows and click-drag. Items size themselves via itemClassName.
 */
export function Carousel({
  children,
  itemClassName,
  className,
  tone = "dark",
  label,
  controls = "top",
  headerSlot,
  bleed = true,
}: {
  children: ReactNode;
  itemClassName?: string;
  className?: string;
  tone?: "dark" | "light";
  label: string;
  controls?: "top" | "bottom" | "none";
  /** Rendered to the left of the arrows when controls="top" */
  headerSlot?: ReactNode;
  /** Let the track run to the viewport edge on the right */
  bleed?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState({ start: true, end: false, ratio: 0, visible: 1 });
  // A track whose slides hold nothing focusable is made focusable itself, so keyboard users can scroll it.
  const [focusableTrack, setFocusableTrack] = useState(false);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft >= max - 4,
      ratio: max > 0 ? el.scrollLeft / max : 0,
      visible: el.scrollWidth > 0 ? Math.min(1, el.clientWidth / el.scrollWidth) : 1,
    });
    setFocusableTrack(el.scrollWidth > el.clientWidth && !el.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'));
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const raf = requestAnimationFrame(measure);
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const step = first ? first.getBoundingClientRect().width + 20 : el.clientWidth * 0.8;
    const perPage = Math.max(1, Math.floor(el.clientWidth / step));
    el.scrollBy({ left: dir * step * perPage, behavior: "smooth" });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !track.current) return;
    drag.current = { x: e.clientX, left: track.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = track.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 5) {
      d.moved = true;
      el.style.scrollSnapType = "none";
      el.scrollLeft = d.left - dx;
    }
  };
  const endDrag = () => {
    const el = track.current;
    if (el) el.style.scrollSnapType = "";
    setTimeout(() => (drag.current = null), 0);
  };

  const arrows = (
    <div className="flex items-center gap-2">
      <ArrowBtn tone={tone} disabled={progress.start} onClick={() => scrollByPage(-1)} label={`Previous ${label}`}>
        <ArrowLeft className="size-4" />
      </ArrowBtn>
      <ArrowBtn tone={tone} disabled={progress.end} onClick={() => scrollByPage(1)} label={`Next ${label}`}>
        <ArrowRight className="size-4" />
      </ArrowBtn>
    </div>
  );

  return (
    <div className={className} role="region" aria-roledescription="carousel" aria-label={label}>
      {controls === "top" && (
        <div className="mb-8 flex items-end justify-between gap-6">
          <div className="min-w-0 flex-1">{headerSlot}</div>
          <div className="hidden md:block">{arrows}</div>
        </div>
      )}
      <div
        ref={track}
        tabIndex={focusableTrack ? 0 : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={(e) => {
          if (drag.current?.moved) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className={cn(
          "no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain scroll-smooth",
          bleed && "-mr-5 pr-5 md:-mr-8 md:pr-8 xl:-mr-12 xl:pr-12",
        )}
      >
        {Children.map(children, (child) => (
          <div className={cn("shrink-0 snap-start", itemClassName)}>{child}</div>
        ))}
      </div>
      <div className="mt-8 flex items-center gap-6">
        <div className={cn("relative h-px flex-1", tone === "dark" ? "bg-line" : "bg-white/15")} aria-hidden>
          <div
            className={cn("absolute inset-y-0 h-px transition-[left] duration-150", tone === "dark" ? "bg-ink" : "bg-white")}
            style={{ width: `${progress.visible * 100}%`, left: `${progress.ratio * (1 - progress.visible) * 100}%` }}
          />
        </div>
        {controls === "bottom" && <div className="hidden md:block">{arrows}</div>}
      </div>
    </div>
  );
}

function ArrowBtn({
  children,
  onClick,
  disabled,
  label,
  tone,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
  tone: "dark" | "light";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full border transition-[background-color,border-color,color,opacity] duration-[250ms] ease-[var(--ease-premium)] disabled:cursor-default disabled:opacity-30",
        tone === "dark"
          ? "border-ink/15 text-ink enabled:hover:border-ink enabled:hover:bg-ink enabled:hover:text-white"
          : "border-white/25 text-white enabled:hover:border-white enabled:hover:bg-white enabled:hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
