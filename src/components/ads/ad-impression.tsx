"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Counts one impression for an ad campaign when at least half of it has been on screen for a moment.
 * Once per campaign per page view. Posts to /api/ads/track (best effort — never blocks the page).
 */
export function AdImpression({ campaignId, children, className }: { campaignId: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sent = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (sent) return;
        if (entry.isIntersecting) {
          timer = setTimeout(() => {
            sent = true;
            io.disconnect();
            const body = JSON.stringify({ c: campaignId, k: "i" });
            try {
              if (!navigator.sendBeacon?.("/api/ads/track", new Blob([body], { type: "application/json" })))
                void fetch("/api/ads/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
            } catch {
              // Tracking is best effort.
            }
          }, 600);
        } else if (timer) clearTimeout(timer);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [campaignId]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
