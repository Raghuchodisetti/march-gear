"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useOptimistic, useTransition } from "react";

/** Reads a comma-separated list param, de-duplicated and optionally whitelisted. */
export function readList(params: URLSearchParams, key: string, allowed?: readonly string[]) {
  const raw = params.get(key);
  if (!raw) return [];
  const unique = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  return allowed ? unique.filter((v) => allowed.includes(v)) : unique;
}

export function writeList(params: URLSearchParams, key: string, list: readonly string[]) {
  if (list.length) params.set(key, list.join(","));
  else params.delete(key);
}

export function toggleValue(list: readonly string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * URL-backed filter state. The query string is the source of truth so links
 * from menus and search land on the right view; updates are applied
 * optimistically so the UI responds instantly while router.replace settles.
 */
export function useQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setOptimisticQuery] = useOptimistic(searchParams.toString());
  const [isPending, startTransition] = useTransition();
  const params = useMemo(() => new URLSearchParams(query), [query]);

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(query);
      mutate(next);
      // Keep list separators readable: ?body=suv,sedan rather than %2C.
      const qs = next.toString().replace(/%2C/gi, ",");
      startTransition(() => {
        setOptimisticQuery(qs);
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [query, pathname, router, setOptimisticQuery],
  );

  return { params, update, isPending };
}
