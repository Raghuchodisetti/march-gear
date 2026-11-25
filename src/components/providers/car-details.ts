"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { CarModel } from "@/types";

/* ──────────────────────────────────────────────────────────────
   Full model details in the browser, loaded on demand.

   <CatalogProvider> holds every model as CarLite. Components that
   need more of a model the visitor picked (specs, features,
   colours) ask for it here; details come from /api/catalog/cars
   once per model and page view; pages pass the models they
   already rendered on the server as `initial`.
   ────────────────────────────────────────────────────────────── */

const store = new Map<string, CarModel>();
const pending = new Set<string>();
const failed = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

const emit = () => {
  version++;
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => version;
const serverSnapshot = () => 0;

async function load(slugs: string[]) {
  const todo = slugs.filter((s) => !store.has(s) && !pending.has(s) && !failed.has(s));
  if (!todo.length) return;
  todo.forEach((s) => pending.add(s));
  try {
    const res = await fetch(`/api/catalog/cars?slugs=${encodeURIComponent(todo.join(","))}`);
    if (!res.ok) throw new Error(String(res.status));
    const { cars } = (await res.json()) as { cars: CarModel[] };
    for (const c of cars) store.set(c.slug, c);
    // Unknown slugs (removed models) don't retry on every render.
    for (const s of todo) if (!store.has(s)) failed.add(s);
  } catch {
    // Network trouble: allow a retry on the next request for these models.
  } finally {
    todo.forEach((s) => pending.delete(s));
    emit();
  }
}

/**
 * Full details for the given models: `get(slug)` is undefined until loaded. `loading` is true while any
 * requested model is still on its way. Pass `initial` with models the server already rendered.
 *
 * The shared store is read only in the browser: on the server (and so in the hydrated first render) only
 * `initial` counts, which keeps server and client HTML identical.
 */
export function useCarDetails(slugs: readonly string[], initial?: readonly (CarModel | undefined)[]) {
  const seeded = useMemo(() => new Map((initial ?? []).filter((c): c is CarModel => Boolean(c)).map((c) => [c.slug, c])), [initial]);
  useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const get = (slug: string) => seeded.get(slug) ?? (typeof window === "undefined" ? undefined : store.get(slug));
  const missing = slugs.filter((s) => !get(s) && !failed.has(s));
  const missingKey = missing.join(",");
  useEffect(() => {
    if (missingKey) void load(missingKey.split(","));
  }, [missingKey]);
  return { get, loading: missing.length > 0 };
}
