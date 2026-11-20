"use client";

import { useCallback, useSyncExternalStore } from "react";

/* ──────────────────────────────────────────────────────────────
   The insurance compare list (product references), kept in
   localStorage so it survives navigation between the quotes,
   product and compare pages. The compare page's URL
   (?products=PRD-…) is the source of truth there; it writes back
   here. Every storage access is wrapped — private windows and
   blocked storage just mean the list isn't remembered.
   ────────────────────────────────────────────────────────────── */

export const MAX_COMPARE = 4;
const KEY = "mg.insurance.compare";
const REF = /^PRD-[A-Z0-9]{6}$/;
const EMPTY: string[] = [];

let cache: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === "string" && REF.test(s)))].slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

const snapshot = () => (cache ??= read());

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = read();
    cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function setCompareRefs(next: string[]) {
  cache = [...new Set(next.filter((s) => REF.test(s)))].slice(0, MAX_COMPARE);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Not remembered — fine.
  }
  for (const l of listeners) l();
}

/** The stored list right now (outside React). */
export const readCompareRefs = () => snapshot();

/** The compare list. `toggle` returns what happened so the caller can say so. */
export function useInsCompare() {
  const refs = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const toggle = useCallback((ref: string): "added" | "removed" | "full" => {
    const cur = snapshot();
    if (cur.includes(ref)) {
      setCompareRefs(cur.filter((r) => r !== ref));
      return "removed";
    }
    if (cur.length >= MAX_COMPARE) return "full";
    setCompareRefs([...cur, ref]);
    return "added";
  }, []);
  const clear = useCallback(() => setCompareRefs([]), []);
  return { refs, toggle, clear, set: setCompareRefs, max: MAX_COMPARE };
}
