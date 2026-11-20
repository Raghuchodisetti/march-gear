"use client";

import { useEffect, useRef } from "react";
import type { InsTrackKind } from "@/db/enums";

/**
 * Sends one analytics beacon for an insurance vendor (POST /api/insurance/track → ins_events).
 * Best effort: never throws, never blocks the page. The server ignores ids that aren't public or
 * don't belong to the vendor.
 */
export function trackInsurance(kind: InsTrackKind, vendorId: number, refId: number) {
  try {
    const payload = JSON.stringify({ kind, vendorId, refId });
    if (!navigator.sendBeacon?.("/api/insurance/track", new Blob([payload], { type: "application/json" }))) {
      fetch("/api/insurance/track", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => undefined);
    }
  } catch {
    // Analytics must never break the page.
  }
}

/** Drop on a public page to count one view (once per page load), e.g. `<TrackInsuranceView kind="product_view" vendorId={…} refId={product.id} />`. */
export function TrackInsuranceView({ kind, vendorId, refId }: { kind: InsTrackKind; vendorId: number; refId: number }) {
  // Strict mode runs effects twice in development; count the view once per mounted component.
  const sent = useRef("");
  useEffect(() => {
    const key = `${kind}:${vendorId}:${refId}`;
    if (sent.current === key) return;
    sent.current = key;
    trackInsurance(kind, vendorId, refId);
  }, [kind, vendorId, refId]);
  return null;
}
