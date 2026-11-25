import type {
  Article,
  Author,
  Brand,
  CarLite,
  VariantLite,
  CarModel,
  CategorySlug,
  Dealer,
  ExpertReview,
  OwnerReview,
  UpcomingCar,
  UsedCar,
} from "@/types";
import type { SiteContent } from "@/content/registry";

/* ──────────────────────────────────────────────────────────────
   The catalogue: everything the public site reads from MySQL,
   plus the lookup helpers pages use. Pure — no database access —
   so it runs on the server (getCatalog) and in the browser
   (useCatalog) from the same data.
   ────────────────────────────────────────────────────────────── */

export interface DealerProfile {
  about: string;
  facilities: string[];
  showroomArea: string;
  serviceBays: number;
  languages: string[];
  /** Compass bearing (0 = north) for the schematic dealer map. */
  bearing: number;
}

export interface DealerReview {
  id: string;
  dealerId: string;
  name: string;
  visit: "Purchase" | "Service" | "Test drive" | "Pre-owned purchase" | "Trade-in";
  date: string;
  rating: number;
  title: string;
  body: string;
  /** The dealer's public reply (from the dealer portal). */
  reply?: string;
  repliedAt?: string;
}

/**
 * The catalogue. On the server `cars` are full CarModels (getCatalog); the browser gets
 * CarLite models (ClientCatalogData, see toClientCatalog) to keep every page's payload small.
 */
export interface CatalogData<C extends CarLite = CarModel> {
  brands: Brand[];
  cars: C[];
  upcoming: UpcomingCar[];
  dealers: Dealer[];
  dealerProfiles: Record<string, DealerProfile>;
  dealerReviews: DealerReview[];
  usedCars: UsedCar[];
  authors: Author[];
  articles: Article[];
  ownerReviews: OwnerReview[];
  /** Editable site copy and settings (see src/content). */
  content: SiteContent;
}

/* ── Pure helpers (no catalogue needed) ─────────────────────── */

const L = 100_000;
const CR = 10_000_000;

/** Marques that appear only in pre-owned inventory or dealer records. */
export const LEGACY_BRANDS: Record<string, string> = {
  ford: "Ford",
  volkswagen: "Volkswagen",
  jaguar: "Jaguar",
  nissan: "Nissan",
  fiat: "Fiat",
  "multi-brand": "Multi-brand",
};

export const carTitle = (car: Pick<CarModel, "brand" | "name">, brandNameFn: (s: string) => string) => `${brandNameFn(car.brand)} ${car.name}`;

export const isElectric = (car: Pick<CarModel, "fuelTypes">) => car.fuelTypes.includes("Electric");

export function carCategories(car: Pick<CarModel, "bodyType" | "isLuxury" | "fuelTypes">): CategorySlug[] {
  const out: CategorySlug[] = [];
  if (car.bodyType === "SUV") out.push("suv");
  if (car.bodyType === "Sedan") out.push("sedan");
  if (car.bodyType === "Hatchback") out.push("hatchback");
  if (car.bodyType === "MUV") out.push("muv");
  if (car.isLuxury) out.push("luxury");
  if (isElectric(car)) out.push("electric");
  return out;
}

export const getVariant = <V extends { slug: string }>(car: { variants: V[] }, variantSlug: string) => car.variants.find((x) => x.slug === variantSlug);

export const BUDGETS = [
  { slug: "under-8", label: "Under ₹8 Lakh", min: 0, max: 8 * L },
  { slug: "8-15", label: "₹8 – 15 Lakh", min: 8 * L, max: 15 * L },
  { slug: "15-25", label: "₹15 – 25 Lakh", min: 15 * L, max: 25 * L },
  { slug: "25-50", label: "₹25 – 50 Lakh", min: 25 * L, max: 50 * L },
  { slug: "50-1cr", label: "₹50 Lakh – 1 Cr", min: 50 * L, max: CR },
  { slug: "above-1cr", label: "Above ₹1 Crore", min: CR, max: Infinity },
] as const;

/** Whether a model's price band overlaps a budget band. */
export function inBudget(car: Pick<CarModel, "priceMin" | "priceMax">, budgetSlug: string) {
  const b = BUDGETS.find((x) => x.slug === budgetSlug);
  if (!b) return true;
  return car.priceMin < b.max && car.priceMax >= b.min;
}

/** Approximate city centres (lat, lng) for "nearby" calculations. */
export const CITY_COORDS: Record<string, [number, number]> = {
  Mumbai: [19.076, 72.878],
  "New Delhi": [28.614, 77.209],
  Bengaluru: [12.972, 77.595],
  Hyderabad: [17.385, 78.487],
  Chennai: [13.083, 80.271],
  Pune: [18.52, 73.857],
  Kolkata: [22.573, 88.364],
  Ahmedabad: [23.023, 72.571],
  Jaipur: [26.912, 75.787],
  Kochi: [9.931, 76.267],
  Chandigarh: [30.733, 76.779],
  Lucknow: [26.847, 80.947],
  Panaji: [15.49, 73.828],
  Indore: [22.72, 75.858],
  Coimbatore: [11.017, 76.956],
  Bhubaneswar: [20.296, 85.825],
  Visakhapatnam: [17.687, 83.218],
};

const haversineKm = (p: [number, number], q: [number, number]) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(q[0] - p[0]);
  const dLng = rad(q[1] - p[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(p[0])) * Math.cos(rad(q[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
};

/** The covered city closest to a point (e.g. the browser's location), using each city's coordinates. */
export function nearestCity<C extends { name: string; lat?: number | null; lng?: number | null }>(lat: number, lng: number, list: C[]) {
  let best: { city: C; km: number } | null = null;
  for (const city of list) {
    const at: [number, number] | undefined = city.lat != null && city.lng != null ? [city.lat, city.lng] : CITY_COORDS[city.name];
    if (!at) continue;
    const km = haversineKm([lat, lng], at);
    if (!best || km < best.km) best = { city, km };
  }
  return best;
}

/** Great-circle distance between two cities in km (0 when unknown or equal). */
export function cityDistanceKm(a: string, b: string) {
  if (a === b) return 0;
  const p = CITY_COORDS[a];
  const q = CITY_COORDS[b];
  if (!p || !q) return 0;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(q[0] - p[0]);
  const dLng = rad(q[1] - p[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(p[0])) * Math.cos(rad(q[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}

export const FALLBACK_DEALER_PROFILE: DealerProfile = {
  about: "An authorised MarchGear partner showroom.",
  facilities: ["Customer lounge", "Free Wi-Fi", "Covered parking"],
  showroomArea: "—",
  serviceBays: 0,
  languages: ["English", "Hindi"],
  bearing: 0,
};

const REVIEW_AUTHORS = ["kabir", "meera", "aditi", "arjun"];
const REVIEW_DATES = ["2026-11-12", "2026-11-02", "2026-10-24", "2026-10-15", "2026-10-03", "2026-09-21"];

/** Expert review derived from the model's own score and verdict — only for models that have them and a photo (facts-only models don't). */
const hasExpertReview = (car: CarLite): car is CarModel =>
  "expertVerdict" in car && (car as CarModel).expertScore > 0 && Boolean((car as CarModel).expertVerdict.trim()) && car.images.length > 0;

function expertReviewFor(car: CarModel, i: number): ExpertReview {
  const base = car.expertScore;
  const jitter = (n: number) => Math.max(5, Math.min(10, Number((base + n).toFixed(1))));
  return {
    slug: `${car.slug}-review`,
    carSlug: car.slug,
    title: `${car.tagline.replace(/\.$/, "")}: our verdict`,
    dek: car.expertVerdict,
    // getAuthor() falls back to the first author if this one is removed.
    authorId: REVIEW_AUTHORS[i % REVIEW_AUTHORS.length],
    publishedOn: REVIEW_DATES[i % REVIEW_DATES.length],
    score: car.expertScore,
    scores: [
      { label: "Design", value: jitter(0.3) },
      { label: "Comfort", value: jitter(i % 2 ? 0.2 : -0.3) },
      { label: "Performance", value: jitter(i % 3 ? -0.2 : 0.4) },
      { label: "Technology", value: jitter(0.1) },
      { label: "Value", value: jitter(car.isLuxury ? -0.8 : 0.3) },
    ],
    verdict: car.expertVerdict,
    image: car.images[0],
  };
}

export type BrandSegment = "all" | "mainstream" | "luxury" | "electric";

export interface BrandSummary {
  brand: Brand;
  models: number;
  evs: number;
  upcoming: number;
  /** Lowest ex-showroom price across the line-up, if any models are on sale */
  startingPrice?: number;
  segments: BrandSegment[];
}

/* ── Catalogue-bound helpers ────────────────────────────────── */

export function createCatalog<C extends CarLite = CarModel>(data: CatalogData<C>) {
  const { brands, cars, upcoming, dealers, dealerProfiles, dealerReviews, usedCars, authors, articles, ownerReviews } = data;

  const brandBySlug = new Map(brands.map((b) => [b.slug, b]));
  const carBySlug = new Map(cars.map((c) => [c.slug, c]));
  const expertReviews = (cars as CarLite[]).filter(hasExpertReview).map(expertReviewFor);

  const getBrand = (slug: string) => brandBySlug.get(slug);
  const brandName = (slug: string) => brandBySlug.get(slug)?.name ?? LEGACY_BRANDS[slug] ?? slug;
  const getCar = (slug: string) => carBySlug.get(slug);
  const carsByBrand = (brand: string) => cars.filter((c) => c.brand === brand);

  const brandSummary = (brand: Brand): BrandSummary => {
    const line = carsByBrand(brand.slug);
    const evs = line.filter(isElectric).length;
    const segments: BrandSegment[] = ["all", brand.isLuxury ? "luxury" : "mainstream"];
    // "Electric-first": at least half of the current line-up is battery-electric.
    if (line.length > 0 && evs / line.length >= 0.5) segments.push("electric");
    return {
      brand,
      models: line.length,
      evs,
      upcoming: upcoming.filter((c) => c.brand === brand.slug).length,
      startingPrice: line.length ? Math.min(...line.map((c) => c.priceMin)) : undefined,
      segments,
    };
  };

  const getDealer = (id: string) => dealers.find((d) => d.id === id);

  // Cities come from the `cities` content block, which always has at least one.
  const { items: cities, evMarkupShare } = data.content.cities;
  const defaultCity = cities.find((c) => c.isDefault) ?? cities[0];
  const cityBySlug = new Map(cities.map((c) => [c.slug, c]));
  /** A removed or unknown city falls back to the default city. */
  const getCity = (slug: string) => cityBySlug.get(slug) ?? defaultCity;
  /** Indicative on-road price: ex-showroom plus RTO, insurance and handling for the city, to the nearest ₹1,000. */
  const onRoadPrice = (exShowroom: number, citySlug: string, isElectric = false) => {
    const { onRoadFactor } = getCity(citySlug);
    // EVs attract near-zero road tax in most states, so they pay only part of the markup.
    const factor = isElectric ? 1 + (onRoadFactor - 1) * (evMarkupShare / 100) : onRoadFactor;
    return Math.round((exShowroom * factor) / 1000) * 1000;
  };

  return {
    ...data,
    expertReviews,

    // Brands
    getBrand,
    brandName,
    brandSummary,
    brandSummaries: () => brands.map(brandSummary).sort((a, b) => a.brand.name.localeCompare(b.brand.name)),

    // New cars
    getCar,
    carsByBrand,
    carsInCategory: (category: CategorySlug) => cars.filter((c) => carCategories(c).includes(category)),
    trendingCars: () => cars.filter((c) => c.trending),
    latestLaunches: () => cars.filter((c) => c.launchedOn).sort((a, b) => (b.launchedOn! > a.launchedOn! ? 1 : -1)),
    electricCars: () => cars.filter(isElectric),
    getUpcoming: (slug: string) => upcoming.find((c) => c.slug === slug),

    // Used cars
    getUsedCar: (id: string) => usedCars.find((c) => c.id === id),

    // Dealers
    getDealer,
    dealerProfile: (id: string) => dealerProfiles[id] ?? FALLBACK_DEALER_PROFILE,
    reviewsForDealer: (dealerId: string) => dealerReviews.filter((r) => r.dealerId === dealerId).sort((a, b) => (a.date < b.date ? 1 : -1)),
    /** Other showrooms, same city first, then by distance between cities. */
    nearbyDealers: (dealer: Dealer, limit = 3) =>
      dealers
        .filter((d) => d.id !== dealer.id)
        .map((d) => ({ dealer: d, km: cityDistanceKm(dealer.city, d.city) }))
        .sort((a, b) => a.km - b.km || b.dealer.rating - a.dealer.rating)
        .slice(0, limit),

    // Cities & on-road prices
    cities,
    defaultCity,
    getCity,
    onRoadPrice,

    // Editorial
    getAuthor: (id: string) => authors.find((a) => a.id === id) ?? authors[0],
    getArticle: (slug: string) => articles.find((a) => a.slug === slug),
    getExpertReview: (carSlug: string) => expertReviews.find((r) => r.carSlug === carSlug),
    ownerReviewsFor: (carSlug: string) => ownerReviews.filter((r) => r.carSlug === carSlug),
  };
}

export type Catalog<C extends CarLite = CarModel> = ReturnType<typeof createCatalog<C>>;

/* ── The browser's catalogue ────────────────────────────────── */

export type ClientCatalogData = CatalogData<CarLite>;
export type ClientCatalog = Catalog<CarLite>;

/** Only what client components need from each model (see CarLite) — keeps the per-page payload small. */
export function toCarLite(c: CarModel | CarLite): CarLite {
  const lite: CarLite = {
    slug: c.slug,
    brand: c.brand,
    name: c.name,
    bodyType: c.bodyType,
    isLuxury: c.isLuxury,
    priceMin: c.priceMin,
    priceMax: c.priceMax,
    fuelTypes: c.fuelTypes,
    transmissions: c.transmissions,
    efficiency: c.efficiency,
    efficiencyValue: c.efficiencyValue,
    engine: c.engine,
    seats: c.seats,
    images: c.images.slice(0, 1),
    rating: c.rating,
    reviewCount: c.reviewCount,
    safetyRating: c.safetyRating,
    safetyAgency: c.safetyAgency,
    tagline: c.tagline,
    bootSpace: c.bootSpace,
    groundClearance: c.groundClearance,
    topSpeed: c.topSpeed,
    acceleration: c.acceleration,
    expertScore: c.expertScore,
    variants: c.variants.map((v) => ({ slug: v.slug, name: v.name, fuel: v.fuel, transmission: v.transmission, price: v.price })),
  };
  // Optional fields only when set: an `undefined` still costs bytes in the serialised page payload.
  if (c.focus) lite.focus = c.focus;
  if (c.trending) lite.trending = true;
  if (c.launchedOn) lite.launchedOn = c.launchedOn;
  if (c.ev) lite.ev = { rangeKm: c.ev.rangeKm, batteryKwh: c.ev.batteryKwh, dcCharge: c.ev.dcCharge, motorKw: c.ev.motorKw };
  return lite;
}

export function toClientCatalog(data: CatalogData<CarModel | CarLite>): ClientCatalogData {
  return { ...data, cars: data.cars.map(toCarLite) };
}

/* ── Wire format: what <CatalogProvider> receives ───────────────
   With ~2,000 variants, their object keys alone would be a third of
   the page payload, so variants travel as tuples and the slug is
   left out when it's the usual slug of the name. */

/** The usual variant slug for a name: "SX(O)+ 1.5 Turbo DCT" → "sx-o-plus-1-5-turbo-dct". */
export function variantSlugOf(name: string) {
  const out = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 110)
    .replace(/-$/, "");
  return out || "variant";
}

/** [name, fuel, transmission, price, slug — only when it isn't variantSlugOf(name)] */
export type VariantWire = [string, VariantLite["fuel"], VariantLite["transmission"], number] | [string, VariantLite["fuel"], VariantLite["transmission"], number, string];
export type CarLiteWire = Omit<CarLite, "variants"> & { variants: VariantWire[] };
export type ClientCatalogWire = Omit<ClientCatalogData, "cars"> & { cars: CarLiteWire[] };

export function encodeClientCatalog(data: ClientCatalogData): ClientCatalogWire {
  return {
    ...data,
    cars: data.cars.map(({ variants, ...car }) => ({
      ...car,
      variants: variants.map((v): VariantWire => (v.slug === variantSlugOf(v.name) ? [v.name, v.fuel, v.transmission, v.price] : [v.name, v.fuel, v.transmission, v.price, v.slug])),
    })),
  };
}

export function decodeClientCatalog(wire: ClientCatalogWire): ClientCatalogData {
  return {
    ...wire,
    cars: wire.cars.map(({ variants, ...car }) => ({
      ...car,
      variants: variants.map(([name, fuel, transmission, price, slug]) => ({ slug: slug ?? variantSlugOf(name), name, fuel, transmission, price })),
    })),
  };
}
