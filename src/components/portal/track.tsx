"use client";

import { useEffect } from "react";
import type { PartnerEventKind } from "@/db/enums";

/** Sends one analytics beacon for a dealer partner. */
export function trackPartner(p: number, k: PartnerEventKind, r?: number) {
  try {
    const payload = JSON.stringify({ p, k, ...(r ? { r } : {}) });
    if (!navigator.sendBeacon?.("/api/track", new Blob([payload], { type: "application/json" }))) {
      fetch("/api/track", { method: "POST", body: payload, keepalive: true }).catch(() => undefined);
    }
  } catch {
    // Analytics must never break the page.
  }
}

/** Drop on a public page to count a view (once per page load). */
export function TrackView({ partnerId, kind, refId }: { partnerId: number; kind: "profile_view" | "vehicle_view" | "offer_view"; refId?: number }) {
  useEffect(() => {
    trackPartner(partnerId, kind, refId);
  }, [partnerId, kind, refId]);
  return null;
}
