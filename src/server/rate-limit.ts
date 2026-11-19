import "server-only";
import { headers } from "next/headers";

/* ──────────────────────────────────────────────────────────────
   Fixed-window rate limits, per server instance. Good enough to
   blunt brute force and form spam; a shared store (Redis / DB)
   would make limits global across serverless instances.
   ────────────────────────────────────────────────────────────── */

const windows = new Map<string, { count: number; resetAt: number }>();

function prune(now: number) {
  if (windows.size < 5_000) return;
  for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
}

/**
 * Records one hit for `key` and reports whether it is still within `max` per `windowMs`.
 * Count first, decide second — so concurrent requests can't all slip under the limit.
 */
export function take(key: string, max: number, windowMs: number) {
  const now = Date.now();
  prune(now);
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  w.count += 1;
  return w.count <= max;
}

export const reset = (key: string) => windows.delete(key);

/**
 * The client IP, only where a trusted proxy sets it (Vercel overwrites x-forwarded-for).
 * Elsewhere the header is client-controlled, so we return null and skip per-IP limits.
 */
export async function clientIp() {
  const h = await headers();
  if (!process.env.VERCEL) return null;
  return (h.get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 64) || null;
}

/** Per-IP limit for public forms; a no-op when the IP isn't trustworthy. */
export async function allowFromIp(bucket: string, max: number, windowMs: number) {
  const ip = await clientIp();
  return ip ? take(`${bucket}:${ip}`, max, windowMs) : true;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
