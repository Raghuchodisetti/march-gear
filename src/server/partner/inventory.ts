import "server-only";
import { unstable_cache } from "next/cache";
import { and, asc, count, countDistinct, desc, eq, gt, inArray, isNotNull, like, lt, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { dealers, media, partnerApprovals, partnerBrands, partnerFiles, partnerOffers, partnerShowrooms, partnerVehicles, partners, users } from "@/db/schema";
import { PARTNER_VEHICLE_STATUS, type PartnerVehicleStatus } from "@/db/enums";
import { CATALOG_TAG, getCatalog } from "@/server/catalog";
import {
  findVariant,
  isUsedDetails,
  newDetailsOf,
  publicFromCatalogue,
  type InventorySort,
  type InventoryTab,
  type PublicVehicle,
  type VehicleHistoryEntry,
} from "@/components/portal/inventory/shared";

/* ──────────────────────────────────────────────────────────────
   Dealer inventory and media library — reads.
   Portal queries always take the signed-in dealership's id and
   scope by it. Public queries (dealer page, model page, used-car
   page) only ever return published vehicles of approved partners,
   and are cached under the catalogue tag so expireCatalog()
   (called whenever a listing goes live or offline) refreshes them.
   What a listing shows about the car itself is always read from the
   live catalogue; a listing whose model or variant has left the
   catalogue is kept for the dealer but hidden from the public.
   ────────────────────────────────────────────────────────────── */

export type VehicleRow = typeof partnerVehicles.$inferSelect;
type Catalog = Awaited<ReturnType<typeof getCatalog>>;

/** The catalogue model and variant a stored listing refers to (undefined when they've left the catalogue). */
export function catalogueOf(v: Pick<VehicleRow, "kind" | "brand" | "modelSlug" | "variant" | "used">, cat: Catalog) {
  const found = v.modelSlug ? cat.getCar(v.modelSlug) : undefined;
  const car = found && found.brand === v.brand ? found : undefined;
  const slug = v.kind === "new" ? newDetailsOf(v.used).variantSlug : isUsedDetails(v.used) ? v.used.variantSlug : undefined;
  const variant = findVariant(car, slug, v.variant);
  return { car, variant, ok: Boolean(car && variant) };
}

const term = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

export const INVENTORY_PAGE_SIZE = 20;

const SORT_COLUMN = {
  updated: partnerVehicles.updatedAt,
  price: partnerVehicles.sellingPrice,
  stock: partnerVehicles.stock,
  views: partnerVehicles.views,
  enquiries: partnerVehicles.enquiries,
} as const;

export interface InventoryFilters {
  tab: InventoryTab;
  status?: PartnerVehicleStatus;
  q?: string;
  sort: InventorySort;
  dir: "asc" | "desc";
  page: number;
}

/** One page of the dealership's vehicles plus the counts the tabs, filters and summary cards need. */
export async function listPartnerVehicles(partnerId: number, f: InventoryFilters) {
  const db = getDb();
  const mine = eq(partnerVehicles.partnerId, partnerId);
  const kind = f.tab === "all" ? undefined : eq(partnerVehicles.kind, f.tab);
  const q = f.q?.trim();
  const search = q
    ? or(
        like(partnerVehicles.model, term(q)),
        like(partnerVehicles.variant, term(q)),
        like(partnerVehicles.vin, term(q)),
        like(partnerVehicles.reference, term(q)),
        like(partnerVehicles.brand, term(q)),
        like(partnerVehicles.colour, term(q)),
      )
    : undefined;
  // Archived listings stay out of the way unless asked for.
  const status = f.status ? eq(partnerVehicles.status, f.status) : ne(partnerVehicles.status, "archived");
  const where = and(mine, kind, search, status);
  const col = SORT_COLUMN[f.sort];

  const [rows, [{ total }], groups] = await Promise.all([
    db
      .select({
        v: {
          id: partnerVehicles.id,
          reference: partnerVehicles.reference,
          kind: partnerVehicles.kind,
          brand: partnerVehicles.brand,
          model: partnerVehicles.model,
          variant: partnerVehicles.variant,
          year: partnerVehicles.year,
          colour: partnerVehicles.colour,
          fuel: partnerVehicles.fuel,
          transmission: partnerVehicles.transmission,
          sellingPrice: partnerVehicles.sellingPrice,
          exShowroom: partnerVehicles.exShowroom,
          stock: partnerVehicles.stock,
          status: partnerVehicles.status,
          adminRemarks: partnerVehicles.adminRemarks,
          views: partnerVehicles.views,
          enquiries: partnerVehicles.enquiries,
          images: partnerVehicles.images,
          modelSlug: partnerVehicles.modelSlug,
          used: partnerVehicles.used,
          publicUsedCarId: partnerVehicles.publicUsedCarId,
          updatedAt: partnerVehicles.updatedAt,
          submittedAt: partnerVehicles.submittedAt,
        },
        showroom: partnerShowrooms.name,
      })
      .from(partnerVehicles)
      .leftJoin(partnerShowrooms, eq(partnerShowrooms.id, partnerVehicles.showroomId))
      .where(where)
      .orderBy(f.dir === "asc" ? asc(col) : desc(col), desc(partnerVehicles.id))
      .limit(INVENTORY_PAGE_SIZE)
      .offset((f.page - 1) * INVENTORY_PAGE_SIZE),
    db.select({ total: count() }).from(partnerVehicles).where(where),
    db
      .select({ kind: partnerVehicles.kind, status: partnerVehicles.status, n: count() })
      .from(partnerVehicles)
      .where(mine)
      .groupBy(partnerVehicles.kind, partnerVehicles.status),
  ]);

  const byStatus = (k?: "new" | "used") => {
    const out = Object.fromEntries(PARTNER_VEHICLE_STATUS.map((s) => [s, 0])) as Record<PartnerVehicleStatus, number>;
    for (const g of groups) if (!k || g.kind === k) out[g.status] += g.n;
    return out;
  };
  const sumActive = (k?: "new" | "used") => groups.filter((g) => (!k || g.kind === k) && g.status !== "archived").reduce((s, g) => s + g.n, 0);

  return {
    rows,
    total,
    tabCounts: { all: sumActive(), new: sumActive("new"), used: sumActive("used") },
    statusCounts: byStatus(f.tab === "all" ? undefined : f.tab),
    summary: byStatus(),
    byKind: { new: byStatus("new"), used: byStatus("used") },
  };
}

/** Active listings whose model or variant isn't in the catalogue any more (hidden from the website until fixed). */
export async function needsCatalogueCount(partnerId: number) {
  const [rows, cat] = await Promise.all([
    getDb()
      .select({ kind: partnerVehicles.kind, brand: partnerVehicles.brand, modelSlug: partnerVehicles.modelSlug, variant: partnerVehicles.variant, used: partnerVehicles.used })
      .from(partnerVehicles)
      .where(and(eq(partnerVehicles.partnerId, partnerId), ne(partnerVehicles.status, "archived"))),
    getCatalog(),
  ]);
  return rows.filter((r) => !catalogueOf(r, cat).ok).length;
}

export async function getPartnerVehicle(partnerId: number, id: number) {
  const [row] = await getDb()
    .select()
    .from(partnerVehicles)
    .where(and(eq(partnerVehicles.id, id), eq(partnerVehicles.partnerId, partnerId)))
    .limit(1);
  return row ?? null;
}

export async function getPartnerVehicles(partnerId: number, ids: number[]) {
  if (!ids.length) return [];
  return getDb()
    .select()
    .from(partnerVehicles)
    .where(and(eq(partnerVehicles.partnerId, partnerId), inArray(partnerVehicles.id, ids)));
}

/** Active showrooms, primary first — the "Showroom" picker on the vehicle form. */
export async function listShowroomOptions(partnerId: number) {
  return getDb()
    .select({ id: partnerShowrooms.id, name: partnerShowrooms.name, city: partnerShowrooms.city, address: partnerShowrooms.address, isPrimary: partnerShowrooms.isPrimary })
    .from(partnerShowrooms)
    .where(and(eq(partnerShowrooms.partnerId, partnerId), eq(partnerShowrooms.isActive, true)))
    .orderBy(desc(partnerShowrooms.isPrimary), asc(partnerShowrooms.name));
}

/** Brand slugs MarchGear has authorised this dealership to sell new. */
export async function approvedBrandSlugs(partnerId: number) {
  return (await brandLineups(partnerId)).map((r) => r.brand);
}

export interface BrandLineup {
  brand: string;
  /** Catalogue model slugs ticked on /dealer/models — empty means the dealer hasn't narrowed the line-up yet. */
  models: string[];
  /** "model-slug/variant-slug" keys ticked on /dealer/models. */
  variants: string[];
}

/** The approved brand authorisations and the line-up chosen for each — what a dealer may list as new cars. */
export async function brandLineups(partnerId: number): Promise<BrandLineup[]> {
  return getDb()
    .select({ brand: partnerBrands.brand, models: partnerBrands.models, variants: partnerBrands.variants })
    .from(partnerBrands)
    .where(and(eq(partnerBrands.partnerId, partnerId), eq(partnerBrands.status, "approved")));
}

/**
 * Whether a new car fits the dealership's authorisations: an approved brand and, once the dealer has ticked
 * models (and variants) on /dealer/models, one of those. Null when it fits, else the field and a message.
 */
export function lineupError(lineups: BrandLineup[], brand: string, modelSlug: string, variantSlug: string): { field: "brand" | "modelSlug" | "variantSlug"; message: string } | null {
  const line = lineups.find((l) => l.brand === brand);
  if (!line) return { field: "brand", message: "Your dealership isn't authorised to sell this brand new — add it under Brands first" };
  if (line.models.length && !line.models.includes(modelSlug)) return { field: "modelSlug", message: "This model isn't in your line-up — tick it on Models & variants first" };
  const ticked = line.variants.filter((k) => k.startsWith(`${modelSlug}/`));
  if (ticked.length && !ticked.includes(`${modelSlug}/${variantSlug}`)) return { field: "variantSlug", message: "This variant isn't in your line-up — tick it on Models & variants first" };
  return null;
}

/** Which of these /media ids belong to the dealership (vehicle photos must be its own uploads). */
export async function ownedMediaIds(partnerId: number, ids: number[]) {
  if (!ids.length) return new Set<number>();
  const rows = await getDb()
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.partnerId, partnerId), inArray(media.id, ids)));
  return new Set(rows.map((r) => r.id));
}

/** True when the private file is this dealership's inspection report. */
export async function ownsInspectionFile(partnerId: number, fileId: number) {
  const [row] = await getDb()
    .select({ id: partnerFiles.id })
    .from(partnerFiles)
    .where(and(eq(partnerFiles.id, fileId), eq(partnerFiles.partnerId, partnerId), eq(partnerFiles.kind, "inspection_report")))
    .limit(1);
  return Boolean(row);
}

/** The vehicle's approval trail, newest first, with who did what. */
export async function vehicleHistory(partnerId: number, vehicleId: number): Promise<VehicleHistoryEntry[]> {
  const rows = await getDb()
    .select({
      id: partnerApprovals.id,
      action: partnerApprovals.action,
      fromStatus: partnerApprovals.fromStatus,
      toStatus: partnerApprovals.toStatus,
      remarks: partnerApprovals.remarks,
      actorSide: partnerApprovals.actorSide,
      actorName: users.name,
      createdAt: partnerApprovals.createdAt,
    })
    .from(partnerApprovals)
    .leftJoin(users, eq(users.id, partnerApprovals.actorUserId))
    .where(and(eq(partnerApprovals.partnerId, partnerId), eq(partnerApprovals.target, "vehicle"), eq(partnerApprovals.targetId, vehicleId), ne(partnerApprovals.action, "internal_note")))
    .orderBy(desc(partnerApprovals.createdAt), desc(partnerApprovals.id))
    .limit(100);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/* ── Public shape ───────────────────────────────────────────── */

type PublicRow = {
  v: VehicleRow;
  partnerName: string | null;
  legalName: string | null;
  room: { name: string; city: string; address: string } | null;
  dealer: { id: string; name: string; city: string; area: string } | null;
};

/** The listing as buyers see it: catalogue data for the car, the dealer's own facts for the rest. */
export function toPublicVehicle({ v, partnerName, legalName, room, dealer }: PublicRow, cat: Catalog): PublicVehicle {
  const { car, variant } = catalogueOf(v, cat);
  const u = isUsedDetails(v.used) ? v.used : null;
  const nd = newDetailsOf(v.used);
  return publicFromCatalogue(car, variant, {
    id: v.id,
    partnerId: v.partnerId,
    reference: v.reference,
    kind: v.kind,
    brand: v.brand,
    model: v.model,
    variant: v.variant,
    year: v.year,
    colour: v.colour,
    sellingPrice: v.sellingPrice,
    stock: v.stock,
    availability: nd.availability,
    waitingWeeks: nd.waitingWeeks,
    images: v.images,
    notes: v.description,
    fallback: { bodyType: v.bodyType, fuel: v.fuel, transmission: v.transmission, exShowroom: v.exShowroom },
    showroom: room?.name ? room : null,
    dealer: {
      id: dealer?.id ?? null,
      name: dealer?.name || partnerName || legalName || "MarchGear dealer partner",
      city: dealer?.city || room?.city || "",
      area: dealer?.area || "",
    },
    used:
      v.kind === "used" && u
        ? {
            registrationYear: u.registrationYear,
            km: u.km,
            owners: u.owners,
            registrationState: u.registrationState,
            accident: u.accident,
            insurance: u.insurance,
            hasInspection: Boolean(u.inspection),
            condition: u.condition ?? "",
          }
        : null,
  });
}

const publicSelect = {
  v: partnerVehicles,
  partnerName: partners.tradeName,
  legalName: partners.legalName,
  room: { name: partnerShowrooms.name, city: partnerShowrooms.city, address: partnerShowrooms.address },
  dealer: { id: dealers.id, name: dealers.name, city: dealers.city, area: dealers.area },
};

/** For the portal's preview: the vehicle exactly as the public pages would render it. */
export async function previewVehicle(partnerId: number, id: number) {
  const [[row], cat] = await Promise.all([
    getDb()
      .select(publicSelect)
      .from(partnerVehicles)
      .innerJoin(partners, eq(partners.id, partnerVehicles.partnerId))
      .leftJoin(partnerShowrooms, eq(partnerShowrooms.id, partnerVehicles.showroomId))
      .leftJoin(dealers, eq(dealers.id, partners.publicDealerId))
      .where(and(eq(partnerVehicles.id, id), eq(partnerVehicles.partnerId, partnerId)))
      .limit(1),
    getCatalog(),
  ]);
  return row ? toPublicVehicle(row as PublicRow, cat) : null;
}

/** A new car on order: no units yet, but buyers can book it with a waiting period. */
const onOrder = sql`json_unquote(json_extract(${partnerVehicles.used}, '$.availability')) = 'on_order'`;

const liveNew = and(
  eq(partnerVehicles.kind, "new"),
  eq(partnerVehicles.status, "published"),
  or(gt(partnerVehicles.stock, 0), onOrder),
  eq(partners.status, "approved"),
);

/** Only listings whose catalogue model and variant still exist are shown — the rest wait for the dealer to fix them. */
const visible = (rows: PublicRow[], cat: Catalog) => rows.filter((r) => catalogueOf(r.v, cat).ok).map((r) => toPublicVehicle(r, cat));

const dealerStockRows = unstable_cache(
  async (dealerId: string): Promise<PublicRow[]> => {
    const rows = await getDb()
      .select(publicSelect)
      .from(partnerVehicles)
      .innerJoin(partners, eq(partners.id, partnerVehicles.partnerId))
      .innerJoin(dealers, and(eq(dealers.id, partners.publicDealerId), eq(dealers.isActive, true)))
      .leftJoin(partnerShowrooms, eq(partnerShowrooms.id, partnerVehicles.showroomId))
      .where(and(liveNew, eq(partners.publicDealerId, dealerId)))
      // In stock first, then the newest.
      .orderBy(desc(gt(partnerVehicles.stock, 0)), desc(partnerVehicles.publishedAt), desc(partnerVehicles.id))
      .limit(48);
    return rows as PublicRow[];
  },
  ["partner-dealer-stock", "v2"],
  // The catalogue tag refreshes it the moment a listing changes; the timer is a safety net.
  { tags: [CATALOG_TAG], revalidate: 600 },
);

/** Published new-car stock (in stock or on order) of the partner behind a public /dealers/<id> page. */
export async function getDealerStock(dealerId: string): Promise<PublicVehicle[]> {
  const [rows, cat] = await Promise.all([dealerStockRows(dealerId), getCatalog()]);
  return visible(rows, cat);
}

const modelStockRows = unstable_cache(
  async (modelSlug: string): Promise<{ rows: PublicRow[]; dealers: number }> => {
    const db = getDb();
    const where = and(liveNew, eq(partnerVehicles.modelSlug, modelSlug), isNotNull(partners.publicDealerId));
    const [rows, [{ n }]] = await Promise.all([
      db
        .select(publicSelect)
        .from(partnerVehicles)
        .innerJoin(partners, eq(partners.id, partnerVehicles.partnerId))
        .innerJoin(dealers, and(eq(dealers.id, partners.publicDealerId), eq(dealers.isActive, true)))
        .leftJoin(partnerShowrooms, eq(partnerShowrooms.id, partnerVehicles.showroomId))
        .where(where)
        // In stock first, then cheapest. A few spare rows in case a variant has left the catalogue.
        .orderBy(desc(gt(partnerVehicles.stock, 0)), asc(partnerVehicles.sellingPrice), desc(partnerVehicles.publishedAt))
        .limit(8),
      db
        .select({ n: countDistinct(partnerVehicles.partnerId) })
        .from(partnerVehicles)
        .innerJoin(partners, eq(partners.id, partnerVehicles.partnerId))
        .innerJoin(dealers, and(eq(dealers.id, partners.publicDealerId), eq(dealers.isActive, true)))
        .where(where),
    ]);
    return { rows: rows as PublicRow[], dealers: n };
  },
  ["partner-model-stock", "v2"],
  { tags: [CATALOG_TAG], revalidate: 600 },
);

/** Published new-car stock of one catalogue model across approved dealers: in stock first, then cheapest. */
export async function getModelStock(modelSlug: string): Promise<{ items: PublicVehicle[]; dealers: number }> {
  const [{ rows, dealers: n }, cat] = await Promise.all([modelStockRows(modelSlug), getCatalog()]);
  return { items: visible(rows, cat).slice(0, 3), dealers: n };
}

/** For a mirrored used car (id "pv-<n>"): which partner and vehicle it is, for view tracking. */
export const getUsedMirrorRef = unstable_cache(
  async (usedCarId: string): Promise<{ partnerId: number; vehicleId: number } | null> => {
    const [row] = await getDb()
      .select({ partnerId: partnerVehicles.partnerId, vehicleId: partnerVehicles.id })
      .from(partnerVehicles)
      .where(eq(partnerVehicles.publicUsedCarId, usedCarId))
      .limit(1);
    return row ?? null;
  },
  ["partner-used-mirror", "v1"],
  { tags: [CATALOG_TAG], revalidate: 3600 },
);

/* ── Media library ──────────────────────────────────────────── */

export const PARTNER_MEDIA_PAGE = 30;

export interface PartnerMediaItem {
  id: number;
  url: string;
  filename: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  uploader: string | null;
  createdAt: string;
}

const mediaColumns = {
  id: media.id,
  filename: media.filename,
  mime: media.mime,
  size: media.size,
  width: media.width,
  height: media.height,
  alt: media.alt,
  createdAt: media.createdAt,
  uploader: users.name,
};

/** Newest first; `before` is the last id of the previous page. Metadata only — never the blob. */
export async function listPartnerMedia(partnerId: number, { q, before }: { q?: string; before?: number } = {}) {
  const db = getDb();
  const query = q?.trim();
  const search = query ? or(like(media.filename, term(query)), like(media.alt, term(query))) : undefined;
  const base = and(eq(media.partnerId, partnerId), search);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select(mediaColumns)
      .from(media)
      .leftJoin(users, eq(users.id, media.createdBy))
      .where(and(base, before ? lt(media.id, before) : undefined))
      .orderBy(desc(media.id))
      .limit(PARTNER_MEDIA_PAGE + 1),
    db.select({ total: count() }).from(media).where(base),
  ]);
  const page = rows.slice(0, PARTNER_MEDIA_PAGE);
  return {
    items: page.map((r): PartnerMediaItem => ({ ...r, url: `/media/${r.id}/${r.filename}`, createdAt: r.createdAt.toISOString() })),
    nextCursor: rows.length > PARTNER_MEDIA_PAGE ? page[page.length - 1].id : null,
    total,
  };
}

export async function getPartnerMediaItem(partnerId: number, id: number) {
  const [row] = await getDb()
    .select(mediaColumns)
    .from(media)
    .leftJoin(users, eq(users.id, media.createdBy))
    .where(and(eq(media.id, id), eq(media.partnerId, partnerId)))
    .limit(1);
  return row ? ({ ...row, url: `/media/${row.id}/${row.filename}`, createdAt: row.createdAt.toISOString() } satisfies PartnerMediaItem) : null;
}

export interface PartnerMediaUsage {
  kind: string;
  label: string;
  href: string;
}

/**
 * Where the dealership uses an image: its vehicles, profile/application, showrooms and offers.
 * A plain LIKE on the stored JSON — the trailing slash keeps /media/1/ from matching /media/12/.
 */
export async function partnerMediaUsage(partnerId: number, mediaId: number): Promise<PartnerMediaUsage[]> {
  const db = getDb();
  const pattern = `%/media/${mediaId}/%`;
  const [vehicles, profile, rooms, offers] = await Promise.all([
    db
      .select({ id: partnerVehicles.id, reference: partnerVehicles.reference, model: partnerVehicles.model, status: partnerVehicles.status })
      .from(partnerVehicles)
      .where(and(eq(partnerVehicles.partnerId, partnerId), like(partnerVehicles.images, pattern))),
    db
      .select({ id: partners.id, inProfile: like(partners.profile, pattern), inApplication: like(partners.application, pattern) })
      .from(partners)
      .where(and(eq(partners.id, partnerId), or(like(partners.profile, pattern), like(partners.application, pattern)))),
    db
      .select({ id: partnerShowrooms.id, name: partnerShowrooms.name })
      .from(partnerShowrooms)
      .where(and(eq(partnerShowrooms.partnerId, partnerId), like(partnerShowrooms.photos, pattern))),
    db
      .select({ id: partnerOffers.id, title: partnerOffers.title })
      .from(partnerOffers)
      .where(and(eq(partnerOffers.partnerId, partnerId), like(partnerOffers.media, pattern))),
  ]);
  const p = profile[0] as { inProfile: unknown; inApplication: unknown } | undefined;
  return [
    ...vehicles.map((v) => ({ kind: v.status === "published" ? "Live vehicle" : "Vehicle", label: `${v.reference} · ${v.model || "Untitled"}`, href: `/dealer/inventory/${v.id}` })),
    ...(p && Number(p.inProfile) ? [{ kind: "Profile", label: "Dealership profile (logo, banner or gallery)", href: "/dealer/profile" }] : []),
    ...(p && Number(p.inApplication) ? [{ kind: "Application", label: "Partner application (showroom or personal photo)", href: "/dealer/application-status" }] : []),
    ...rooms.map((r) => ({ kind: "Showroom", label: r.name, href: "/dealer/showrooms" })),
    ...offers.map((o) => ({ kind: "Offer", label: o.title, href: "/dealer/offers" })),
  ];
}
