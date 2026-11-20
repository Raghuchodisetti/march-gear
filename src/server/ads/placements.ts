import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { adPlacements } from "@/db/schema";
import { PLACEMENTS, type PlacementDefinition } from "@/ads/placements";
import type { PlacementView } from "@/components/ads/shared";

/* ──────────────────────────────────────────────────────────────
   ad_placements is seeded from the code list (src/ads/placements.ts):
   missing keys are inserted, existing rows are never touched, so
   staff edits to names, prices and slots always win.
   ────────────────────────────────────────────────────────────── */

export type PlacementRow = typeof adPlacements.$inferSelect;

const g = globalThis as unknown as { mgAdPlacementsSync?: Promise<void> };

export const placementDefinition = (key: string): PlacementDefinition | undefined => (PLACEMENTS as readonly PlacementDefinition[]).find((p) => p.key === key);

/** The code defaults for a placement, as column values. */
export function placementDefaults(def: PlacementDefinition) {
  return {
    key: def.key,
    name: def.name,
    description: def.description,
    location: def.location,
    format: def.format,
    desktopSize: def.desktopSize,
    mobileSize: def.mobileSize,
    pricePerDay: def.pricePerDay,
    minDays: def.minDays,
    maxDays: def.maxDays,
    slots: def.slots,
    audience: def.audience,
    isActive: true,
    sortOrder: def.sortOrder,
  } satisfies typeof adPlacements.$inferInsert;
}

async function sync() {
  const db = getDb();
  const keys = PLACEMENTS.map((p) => p.key);
  const have = new Set((await db.select({ key: adPlacements.key }).from(adPlacements).where(inArray(adPlacements.key, keys))).map((r) => r.key));
  const missing = (PLACEMENTS as readonly PlacementDefinition[]).filter((p) => !have.has(p.key));
  if (!missing.length) return;
  // A concurrent first request may have inserted the same keys: keep whatever is there.
  await db
    .insert(adPlacements)
    .values(missing.map(placementDefaults))
    .onDuplicateKeyUpdate({ set: { key: sql`\`key\`` } });
}

/** Inserts any placement rows that don't exist yet. Runs once per server process; a failure is retried next time. */
export function ensureAdPlacements(): Promise<void> {
  g.mgAdPlacementsSync ??= sync().catch((err) => {
    g.mgAdPlacementsSync = undefined;
    throw err;
  });
  return g.mgAdPlacementsSync;
}

/** Forgets the sync, so the next call re-checks (after restoring a placement's defaults). */
export const resyncAdPlacements = () => {
  g.mgAdPlacementsSync = undefined;
};

export function toPlacementView(r: PlacementRow): PlacementView {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    location: r.location,
    format: r.format,
    desktopSize: r.desktopSize,
    mobileSize: r.mobileSize,
    pricePerDay: r.pricePerDay,
    minDays: r.minDays,
    maxDays: r.maxDays,
    slots: r.slots,
    audience: r.audience,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
  };
}

/** Every placement, in display order. */
export async function listPlacements(): Promise<PlacementRow[]> {
  await ensureAdPlacements();
  return getDb().select().from(adPlacements).orderBy(asc(adPlacements.sortOrder), asc(adPlacements.id));
}

export async function getPlacement(id: number): Promise<PlacementRow | null> {
  await ensureAdPlacements();
  const [row] = await getDb().select().from(adPlacements).where(eq(adPlacements.id, id));
  return row ?? null;
}

export async function getPlacementByKey(key: string): Promise<PlacementRow | null> {
  await ensureAdPlacements();
  const [row] = await getDb().select().from(adPlacements).where(eq(adPlacements.key, key));
  return row ?? null;
}
