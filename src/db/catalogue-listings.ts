/**
 * Brings existing dealer listings in line with the catalogue rule (cars come only from MarchGear's catalogue).
 * Idempotent — safe to run again; it only changes what's out of line and prints what it did.
 *
 *   npx tsx --env-file=.env.local src/db/catalogue-listings.ts            apply
 *   npx tsx --env-file=.env.local src/db/catalogue-listings.ts --dry-run  report only
 *
 * For every partner_vehicles row:
 * - Model not linked to the catalogue → linked when brand + model name match a catalogue model exactly
 *   (case-insensitive). Otherwise it's left alone: the dealer sees "Needs a catalogue model" and the listing stays
 *   hidden from the public until they pick one. Nothing is deleted.
 * - Variant resolved by slug or name; names, body type, fuel, gearbox and ex-showroom price refreshed from the
 *   catalogue, and the variant slug stored with the listing's details.
 * - New cars: dealer-entered descriptions, specs, features, photos and videos are cleared (the catalogue's are shown);
 *   pending_approval / approved listings are published (history: "published" by the system).
 * - Used cars: dealer specs, features and videos are cleared (photos and the condition notes stay); the public
 *   /used-cars mirror is re-synced.
 *
 * A running dev server caches public pages; they refresh on the next admin or dealer save, or within the hour.
 */
import Module from "node:module";
import { eq } from "drizzle-orm";
import type { NewVehicleDetails, UsedVehicleDetails } from "@/partner/types";
import { closeDb, getDb } from "./index";
import * as s from "./schema";

// The server modules import "server-only" and Next's cache; neither exists in a script.
type Loader = (request: string, parent: unknown, isMain: boolean) => unknown;
const mod = Module as unknown as { _load: Loader };
const load = mod._load;
mod._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "next/cache")
    return { revalidateTag() {}, revalidatePath() {}, updateTag() {}, refresh() {}, unstable_noStore() {}, unstable_cache: <T,>(fn: T) => fn, cacheTag() {}, cacheLife() {} };
  return load.call(this, request, parent, isMain);
};

const DRY = process.argv.includes("--dry-run");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  const { getCatalog } = await import("@/server/catalog");
  const { findVariant, isUsedDetails, newDetailsOf } = await import("@/components/portal/inventory/shared");
  const { syncPublicVehicle } = await import("@/server/partner/public-sync");
  const db = getDb();
  const cat = await getCatalog();
  const rows = await db.select().from(s.partnerVehicles);
  const report = { checked: rows.length, linked: [] as string[], refreshed: [] as string[], published: [] as string[], needsModel: [] as string[], needsVariant: [] as string[] };
  const resync: number[] = [];

  for (const v of rows) {
    const label = `${v.reference} (${v.kind}, ${v.brand} ${v.model} ${v.variant})`;
    let car = v.modelSlug ? cat.getCar(v.modelSlug) : undefined;
    if (car && car.brand !== v.brand) car = undefined;
    if (!car) {
      const name = v.model.trim().toLowerCase();
      car = name ? cat.carsByBrand(v.brand).find((c) => c.name.toLowerCase() === name) : undefined;
      if (!car) {
        report.needsModel.push(label);
        continue;
      }
      report.linked.push(`${label} → ${car.slug}`);
    }
    const details = isUsedDetails(v.used) ? v.used : null;
    const variant = findVariant(car, v.kind === "new" ? newDetailsOf(v.used).variantSlug : details?.variantSlug, v.variant);
    if (!variant) report.needsVariant.push(label);

    const next: Partial<typeof s.partnerVehicles.$inferInsert> = {
      modelSlug: car.slug,
      model: car.name,
      bodyType: car.bodyType,
      specs: [],
      features: [],
      videos: [],
      ...(variant ? { variant: variant.name, fuel: variant.fuel, transmission: variant.transmission, exShowroom: variant.price } : {}),
    };
    if (v.kind === "new") {
      const nd = newDetailsOf(v.used);
      const used: NewVehicleDetails = { variantSlug: variant?.slug ?? nd.variantSlug, availability: nd.availability, waitingWeeks: nd.waitingWeeks };
      Object.assign(next, { description: "", images: [], used });
      if (variant && (v.status === "pending_approval" || v.status === "approved")) {
        Object.assign(next, { status: "published", publishedAt: v.publishedAt ?? new Date(), adminRemarks: null });
        report.published.push(label);
      }
    } else if (details) {
      const used: UsedVehicleDetails = { ...details, variantSlug: variant?.slug ?? details.variantSlug ?? "" };
      next.used = used;
    }

    const changed = Object.entries(next).filter(([k, val]) => !same((v as Record<string, unknown>)[k], val));
    if (!changed.length) continue;
    if (!report.published.includes(label)) report.refreshed.push(`${label}: ${changed.map(([k]) => k).join(", ")}`);
    if (DRY) continue;
    await db.update(s.partnerVehicles).set(next).where(eq(s.partnerVehicles.id, v.id));
    if (next.status === "published")
      await db.insert(s.partnerApprovals).values({
        partnerId: v.partnerId,
        target: "vehicle",
        targetId: v.id,
        action: "published",
        fromStatus: v.status,
        toStatus: "published",
        remarks: "New-car listings no longer need MarchGear's approval — published automatically when catalogue-only listing launched.",
        actorUserId: null,
        actorSide: "system",
      });
    if (v.kind === "used") resync.push(v.id);
  }
  for (const id of resync) await syncPublicVehicle(id);

  const list = (title: string, items: string[]) => console.log(`\n${title} (${items.length})${items.length ? `\n  ${items.join("\n  ")}` : ""}`);
  console.log(`${DRY ? "[dry run] " : ""}Checked ${report.checked} listings.`);
  list("Linked to a catalogue model by exact name", report.linked);
  list("New-car listings published (no approval needed any more)", report.published);
  list("Refreshed from the catalogue", report.refreshed);
  list("Need a catalogue model — left for the dealer, hidden from the public", report.needsModel);
  list("Model found but no matching variant — the dealer must pick the variant", report.needsVariant);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
