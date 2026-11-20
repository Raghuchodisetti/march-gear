"use client";

import { useSyncExternalStore } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeLeft } from "./offer-utils";

/* A shared one-second clock. Server renders use the render time, so hydration always matches. */

let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  now = Date.now();
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** The current time, ticking every second in the browser; `serverNow` during SSR and hydration. */
export function useNow(serverNow: number) {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => serverNow,
  );
}

/** "Ends in 3d 4h" / "Starts in 2 days" — live. */
export function Countdown({
  startsAt,
  endsAt,
  renderedAt,
  tone = "dark",
  className,
  compact,
}: {
  startsAt: string;
  endsAt: string;
  renderedAt: number;
  tone?: "dark" | "light" | "red";
  className?: string;
  compact?: boolean;
}) {
  const t = useNow(renderedAt);
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const label = t < start ? `Starts in ${timeLeft(start, t)}` : t > end ? "Offer ended" : `Ends in ${timeLeft(end, t)}`;
  const urgent = t >= start && t <= end && end - t < 3 * 86_400_000;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium num",
        tone === "light" ? "text-white/80" : tone === "red" ? "text-red" : urgent ? "text-red" : "text-ink/70",
        className,
      )}
      suppressHydrationWarning
    >
      <Clock aria-hidden className={cn("size-3.5 shrink-0", compact && "size-3")} />
      {label}
    </span>
  );
}
