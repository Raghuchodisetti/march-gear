export type FuelType = "Petrol" | "Diesel" | "Electric" | "Hybrid" | "CNG";
export type Transmission = "Manual" | "Automatic" | "AMT" | "DCT" | "CVT";
export type BodyType = "SUV" | "Sedan" | "Hatchback" | "MUV" | "Coupe";
export type CategorySlug = "suv" | "sedan" | "hatchback" | "muv" | "luxury" | "electric";

export interface Brand {
  slug: string;
  name: string;
  country: string;
  founded: number;
  tagline: string;
  description: string;
  heroImage: string;
  isLuxury?: boolean;
}

export interface Variant {
  slug: string;
  name: string;
  fuel: FuelType;
  transmission: Transmission;
  price: number;
  /** "18.4 kmpl" or "473 km" for EVs */
  efficiency: string;
  features: string[];
}

export interface EvSpec {
  rangeKm: number;
  batteryKwh: number;
  /** e.g. "20 min (20–80%)" — "" when not published */
  dcCharge: string;
  /** "" when not published */
  acCharge: string;
  /** 0 when not published */
  motorKw: number;
  /** Test cycle of the claimed range as published: "ARAI", "MIDC", "WLTP"… */
  rangeStandard?: string;
}

export interface Dimensions {
  length: number;
  width: number;
  height: number;
  wheelbase: number;
}

export interface FeatureGroup {
  group: "Comfort" | "Infotainment" | "Safety" | "Exterior" | "Interior" | "Performance";
  items: string[];
}

export interface CarColor {
  name: string;
  hex: string;
}

export interface CarModel {
  slug: string;
  brand: string;
  name: string;
  bodyType: BodyType;
  isLuxury: boolean;
  priceMin: number;
  priceMax: number;
  fuelTypes: FuelType[];
  transmissions: Transmission[];
  /** Display string: "17.4 – 21.8 kmpl" or "Up to 533 km" */
  efficiency: string;
  /** Best claimed figure in kmpl (or km range for EVs) — used for sorting */
  efficiencyValue: number;
  engine: string;
  power: string;
  torque: string;
  seats: number[];
  safetyRating: number;
  safetyAgency: "Bharat NCAP" | "Global NCAP" | "Euro NCAP" | "ASEAN NCAP" | "Not tested";
  airbags: number;
  bootSpace: number;
  groundClearance: number;
  fuelTank?: number;
  topSpeed: number;
  acceleration: string;
  dimensions: Dimensions;
  rating: number;
  reviewCount: number;
  images: string[];
  /** CSS object-position for the primary image in tight crops */
  focus?: string;
  colors: CarColor[];
  tagline: string;
  overview: string;
  highlights: string[];
  pros: string[];
  cons: string[];
  features: FeatureGroup[];
  variants: Variant[];
  ev?: EvSpec;
  expertScore: number;
  expertVerdict: string;
  competitors: string[];
  trending?: boolean;
  /** ISO date when recently launched */
  launchedOn?: string;
  /** Researched facts: when prices/specs were checked and the city of the ex-showroom prices. */
  dataAsOf?: string;
  priceCity?: string;
}

/* ── Client catalogue ───────────────────────────────────────────
   The browser gets every model in this lighter shape (via
   <CatalogProvider>), enough for cards, rows, pickers, filters and
   search. A full CarModel is assignable to it, so components typed
   on CarLite take either. Full details (features, colours, copy,
   specs) load server-side on the pages that show them.
   `images` holds at most the primary photo here. */

export type VariantLite = Pick<Variant, "slug" | "name" | "fuel" | "transmission" | "price">;

export type CarLite = Pick<
  CarModel,
  | "slug"
  | "brand"
  | "name"
  | "bodyType"
  | "isLuxury"
  | "priceMin"
  | "priceMax"
  | "fuelTypes"
  | "transmissions"
  | "efficiency"
  | "efficiencyValue"
  | "engine"
  | "seats"
  | "images"
  | "focus"
  | "rating"
  | "reviewCount"
  | "safetyRating"
  | "safetyAgency"
  | "trending"
  | "launchedOn"
  | "tagline"
  | "bootSpace"
  | "groundClearance"
  | "topSpeed"
  | "acceleration"
  | "expertScore"
> & {
  variants: VariantLite[];
  ev?: Pick<EvSpec, "rangeKm" | "batteryKwh" | "dcCharge" | "motorKw">;
};

export interface UsedCar {
  id: string;
  modelSlug?: string;
  brand: string;
  name: string;
  variant: string;
  year: number;
  km: number;
  fuel: FuelType;
  transmission: Transmission;
  owners: number;
  city: string;
  price: number;
  /** Original ex-showroom price, for savings display */
  newPrice?: number;
  bodyType: BodyType;
  images: string[];
  focus?: string;
  verified: boolean;
  inspectionScore: number;
  registration: string;
  insurance: string;
  color: string;
  seller: { name: string; type: "Dealer" | "Individual"; dealerId?: string };
  highlights: string[];
  postedOn: string;
}

export interface UpcomingCar {
  slug: string;
  brand: string;
  name: string;
  bodyType: BodyType;
  fuel: FuelType;
  expectedLaunch: string;
  priceMin: number;
  priceMax: number;
  image: string;
  teaser: string;
  highlights: string[];
}

export type ArticleCategory =
  | "News"
  | "Expert Review"
  | "First Drive"
  | "Industry"
  | "Electric"
  | "Video"
  | "Ownership";

export interface Author {
  id: string;
  name: string;
  role: string;
  /** Optional profile, edited in the admin panel. */
  bio?: string;
  beat?: string;
  base?: string;
  joined?: number;
}

export interface Article {
  slug: string;
  title: string;
  dek: string;
  category: ArticleCategory;
  authorId: string;
  publishedOn: string;
  readMinutes: number;
  image: string;
  body: string[];
  pullQuote?: string;
  tags: string[];
  relatedCar?: string;
  videoDuration?: string;
}

export interface ExpertReview {
  slug: string;
  carSlug: string;
  title: string;
  dek: string;
  authorId: string;
  publishedOn: string;
  score: number;
  scores: { label: string; value: number }[];
  verdict: string;
  image: string;
}

export interface OwnerReview {
  id: string;
  carSlug: string;
  name: string;
  city: string;
  variant: string;
  ownedFor: string;
  kmDriven: number;
  rating: number;
  title: string;
  body: string;
  date: string;
  helpful: number;
  ratings: { exterior: number; comfort: number; performance: number; value: number };
}

export interface Dealer {
  id: string;
  name: string;
  brand: string;
  city: string;
  area: string;
  address: string;
  rating: number;
  reviewCount: number;
  phone: string;
  email: string;
  hours: string;
  image: string;
  services: string[];
  established: number;
  distanceKm: number;
  usedInventory?: boolean;
}

export interface City {
  slug: string;
  name: string;
  state: string;
  /** Multiplier applied to ex-showroom for an indicative on-road price */
  onRoadFactor: number;
  popular?: boolean;
}
