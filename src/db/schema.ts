import { relations } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  datetime,
  double,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import type {
  BodyType,
  CarColor,
  Dimensions,
  EvSpec,
  FeatureGroup,
  FuelType,
  Transmission,
} from "@/types";
import type { UserPreferences } from "@/lib/action-result";
import { LEAD_STATUS, PUBLISH_STATUS, REVIEW_STATUS, USED_STATUS, USER_ROLES, type LeadType } from "./enums";

export * from "./enums";

/* ──────────────────────────────────────────────────────────────
   MarchGear database schema (MySQL / MariaDB, via Drizzle).

   JSON is stored as LONGTEXT so the same schema runs on MariaDB
   (local XAMPP) and MySQL 8 (hosted).
   ────────────────────────────────────────────────────────────── */

const json = <T>(name: string) =>
  customType<{ data: T; driverData: string }>({
    dataType: () => "longtext",
    toDriver: (value) => JSON.stringify(value),
    fromDriver: (value) => (typeof value === "string" ? JSON.parse(value) : value) as T,
  })(name);

const created = () => timestamp("created_at").notNull().defaultNow();
const updated = () => timestamp("updated_at").notNull().defaultNow().onUpdateNow();

/* ── Catalogue ──────────────────────────────────────────────── */

export const brands = mysqlTable("brands", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 80 }).notNull(),
  country: varchar("country", { length: 60 }).notNull(),
  founded: int("founded").notNull(),
  tagline: varchar("tagline", { length: 160 }).notNull(),
  description: text("description").notNull(),
  heroImage: varchar("hero_image", { length: 500 }).notNull(),
  isLuxury: boolean("is_luxury").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});

export const cars = mysqlTable(
  "cars",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    brand: varchar("brand", { length: 80 })
      .notNull()
      .references(() => brands.slug, { onUpdate: "cascade", onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    bodyType: varchar("body_type", { length: 20 }).$type<BodyType>().notNull(),
    isLuxury: boolean("is_luxury").notNull().default(false),
    priceMin: int("price_min").notNull(),
    priceMax: int("price_max").notNull(),
    fuelTypes: json<FuelType[]>("fuel_types").notNull(),
    transmissions: json<Transmission[]>("transmissions").notNull(),
    efficiency: varchar("efficiency", { length: 60 }).notNull(),
    efficiencyValue: double("efficiency_value").notNull(),
    engine: varchar("engine", { length: 160 }).notNull(),
    power: varchar("power", { length: 80 }).notNull(),
    torque: varchar("torque", { length: 80 }).notNull(),
    seats: json<number[]>("seats").notNull(),
    safetyRating: int("safety_rating").notNull().default(0),
    safetyAgency: varchar("safety_agency", { length: 20 }).notNull().default("Not tested"),
    airbags: int("airbags").notNull().default(2),
    bootSpace: int("boot_space").notNull(),
    groundClearance: int("ground_clearance").notNull(),
    fuelTank: int("fuel_tank"),
    topSpeed: int("top_speed").notNull(),
    acceleration: varchar("acceleration", { length: 40 }).notNull(),
    dimensions: json<Dimensions>("dimensions").notNull(),
    rating: double("rating").notNull().default(0),
    reviewCount: int("review_count").notNull().default(0),
    images: json<string[]>("images").notNull(),
    focus: varchar("focus", { length: 40 }),
    colors: json<CarColor[]>("colors").notNull(),
    tagline: varchar("tagline", { length: 200 }).notNull(),
    overview: text("overview").notNull(),
    highlights: json<string[]>("highlights").notNull(),
    pros: json<string[]>("pros").notNull(),
    cons: json<string[]>("cons").notNull(),
    features: json<FeatureGroup[]>("features").notNull(),
    ev: json<EvSpec | null>("ev"),
    expertScore: double("expert_score").notNull().default(0),
    expertVerdict: text("expert_verdict").notNull(),
    competitors: json<string[]>("competitors").notNull(),
    trending: boolean("trending").notNull().default(false),
    launchedOn: date("launched_on", { mode: "string" }),
    status: mysqlEnum("status", PUBLISH_STATUS).notNull().default("published"),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("cars_brand_idx").on(t.brand), index("cars_status_idx").on(t.status)],
);

export const variants = mysqlTable(
  "variants",
  {
    id: int("id").autoincrement().primaryKey(),
    carId: int("car_id")
      .notNull()
      .references(() => cars.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    fuel: varchar("fuel", { length: 20 }).$type<FuelType>().notNull(),
    transmission: varchar("transmission", { length: 20 }).$type<Transmission>().notNull(),
    price: int("price").notNull(),
    efficiency: varchar("efficiency", { length: 40 }).notNull(),
    features: json<string[]>("features").notNull(),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("variants_car_slug_uq").on(t.carId, t.slug)],
);

export const upcomingCars = mysqlTable("upcoming_cars", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  brand: varchar("brand", { length: 80 })
    .notNull()
    .references(() => brands.slug, { onUpdate: "cascade", onDelete: "restrict" }),
  name: varchar("name", { length: 120 }).notNull(),
  bodyType: varchar("body_type", { length: 20 }).$type<BodyType>().notNull(),
  fuel: varchar("fuel", { length: 20 }).$type<FuelType>().notNull(),
  expectedLaunch: varchar("expected_launch", { length: 40 }).notNull(),
  priceMin: int("price_min").notNull(),
  priceMax: int("price_max").notNull(),
  image: varchar("image", { length: 500 }).notNull(),
  teaser: text("teaser").notNull(),
  highlights: json<string[]>("highlights").notNull(),
  status: mysqlEnum("status", PUBLISH_STATUS).notNull().default("published"),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});

export interface DealerProfileData {
  about: string;
  facilities: string[];
  showroomArea: string;
  serviceBays: number;
  languages: string[];
  bearing: number;
}

export const dealers = mysqlTable(
  "dealers",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    /** Brand slug, or "multi-brand". */
    brand: varchar("brand", { length: 80 }).notNull(),
    city: varchar("city", { length: 64 }).notNull(),
    area: varchar("area", { length: 120 }).notNull(),
    address: varchar("address", { length: 300 }).notNull(),
    rating: double("rating").notNull().default(0),
    reviewCount: int("review_count").notNull().default(0),
    phone: varchar("phone", { length: 30 }).notNull(),
    email: varchar("email", { length: 190 }).notNull(),
    hours: varchar("hours", { length: 120 }).notNull(),
    image: varchar("image", { length: 500 }).notNull(),
    services: json<string[]>("services").notNull(),
    established: int("established").notNull(),
    distanceKm: double("distance_km").notNull().default(0),
    usedInventory: boolean("used_inventory").notNull().default(false),
    profile: json<DealerProfileData | null>("profile"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("dealers_city_idx").on(t.city)],
);

export const usedCars = mysqlTable(
  "used_cars",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    modelSlug: varchar("model_slug", { length: 120 }),
    /** Brand slug — may be a marque no longer sold new (e.g. "ford"). */
    brand: varchar("brand", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    variant: varchar("variant", { length: 120 }).notNull(),
    year: int("year").notNull(),
    km: int("km").notNull(),
    fuel: varchar("fuel", { length: 20 }).$type<FuelType>().notNull(),
    transmission: varchar("transmission", { length: 20 }).$type<Transmission>().notNull(),
    owners: int("owners").notNull().default(1),
    city: varchar("city", { length: 64 }).notNull(),
    price: int("price").notNull(),
    newPrice: int("new_price"),
    bodyType: varchar("body_type", { length: 20 }).$type<BodyType>().notNull(),
    images: json<string[]>("images").notNull(),
    focus: varchar("focus", { length: 40 }),
    verified: boolean("verified").notNull().default(false),
    inspectionScore: int("inspection_score").notNull().default(0),
    registration: varchar("registration", { length: 40 }).notNull(),
    insurance: varchar("insurance", { length: 80 }).notNull(),
    color: varchar("color", { length: 60 }).notNull(),
    sellerName: varchar("seller_name", { length: 120 }).notNull(),
    sellerType: mysqlEnum("seller_type", ["Dealer", "Individual"]).notNull(),
    dealerId: varchar("dealer_id", { length: 64 }).references(() => dealers.id, { onDelete: "set null", onUpdate: "cascade" }),
    highlights: json<string[]>("highlights").notNull(),
    postedOn: date("posted_on", { mode: "string" }).notNull(),
    status: mysqlEnum("status", USED_STATUS).notNull().default("active"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("used_status_idx").on(t.status), index("used_city_idx").on(t.city)],
);

/* ── Editorial ──────────────────────────────────────────────── */

export const authors = mysqlTable("authors", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  role: varchar("role", { length: 120 }).notNull(),
  createdAt: created(),
});

export const articles = mysqlTable(
  "articles",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    dek: text("dek").notNull(),
    category: varchar("category", { length: 32 }).notNull(),
    authorId: varchar("author_id", { length: 64 })
      .notNull()
      .references(() => authors.id, { onDelete: "restrict", onUpdate: "cascade" }),
    publishedOn: date("published_on", { mode: "string" }).notNull(),
    readMinutes: int("read_minutes").notNull().default(3),
    image: varchar("image", { length: 500 }).notNull(),
    body: json<string[]>("body").notNull(),
    pullQuote: text("pull_quote"),
    tags: json<string[]>("tags").notNull(),
    relatedCar: varchar("related_car", { length: 120 }),
    videoDuration: varchar("video_duration", { length: 16 }),
    status: mysqlEnum("status", PUBLISH_STATUS).notNull().default("published"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("articles_published_idx").on(t.publishedOn)],
);

export const ownerReviews = mysqlTable(
  "owner_reviews",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    carSlug: varchar("car_slug", { length: 120 })
      .notNull()
      .references(() => cars.slug, { onDelete: "cascade", onUpdate: "cascade" }),
    userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
    name: varchar("name", { length: 120 }).notNull(),
    city: varchar("city", { length: 64 }).notNull(),
    variant: varchar("variant", { length: 120 }).notNull(),
    ownedFor: varchar("owned_for", { length: 60 }).notNull(),
    kmDriven: int("km_driven").notNull(),
    rating: double("rating").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    helpful: int("helpful").notNull().default(0),
    ratings: json<{ exterior: number; comfort: number; performance: number; value: number }>("ratings").notNull(),
    status: mysqlEnum("status", REVIEW_STATUS).notNull().default("pending"),
    createdAt: created(),
  },
  (t) => [index("owner_reviews_car_idx").on(t.carSlug), index("owner_reviews_status_idx").on(t.status)],
);

export const dealerReviews = mysqlTable(
  "dealer_reviews",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    dealerId: varchar("dealer_id", { length: 64 })
      .notNull()
      .references(() => dealers.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    visit: varchar("visit", { length: 40 }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    rating: double("rating").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    status: mysqlEnum("status", REVIEW_STATUS).notNull().default("approved"),
    createdAt: created(),
  },
  (t) => [index("dealer_reviews_dealer_idx").on(t.dealerId)],
);

/* ── Accounts ───────────────────────────────────────────────── */

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 190 }).notNull().unique(),
  phone: varchar("phone", { length: 15 }),
  city: varchar("city", { length: 64 }),
  passwordHash: varchar("password_hash", { length: 100 }).notNull(),
  role: mysqlEnum("role", USER_ROLES).notNull().default("customer"),
  /** Contact & alert preferences from the profile page (null = defaults). */
  preferences: json<UserPreferences | null>("preferences"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: datetime("last_login_at"),
  createdAt: created(),
  updatedAt: updated(),
});

export const sessions = mysqlTable(
  "sessions",
  {
    /** SHA-256 of the cookie token — the raw token is never stored. */
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: datetime("expires_at").notNull(),
    userAgent: varchar("user_agent", { length: 255 }),
    ip: varchar("ip", { length: 64 }),
    createdAt: created(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const wishlistItems = mysqlTable(
  "wishlist_items",
  {
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", ["cars", "used"]).notNull(),
    itemId: varchar("item_id", { length: 120 }).notNull(),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.itemId] })],
);

/* ── Leads ──────────────────────────────────────────────────── */

export const leads = mysqlTable(
  "leads",
  {
    id: int("id").autoincrement().primaryKey(),
    reference: varchar("reference", { length: 16 }).notNull().unique(),
    type: varchar("type", { length: 32 }).$type<LeadType>().notNull(),
    status: mysqlEnum("status", LEAD_STATUS).notNull().default("new"),
    /** Optional: quick forms (e.g. a used-car offer) only ask for a mobile number. */
    name: varchar("name", { length: 120 }),
    email: varchar("email", { length: 190 }),
    phone: varchar("phone", { length: 15 }),
    city: varchar("city", { length: 64 }),
    /** What the lead is about — "Hyundai Creta SX(O)", a dealer name, etc. */
    subject: varchar("subject", { length: 200 }),
    carSlug: varchar("car_slug", { length: 120 }),
    usedCarId: varchar("used_car_id", { length: 64 }),
    dealerId: varchar("dealer_id", { length: 64 }),
    message: text("message"),
    /** Form-specific answers (plan, delivery date, fuel, km…). */
    details: json<Record<string, string | number | boolean | null>>("details"),
    source: varchar("source", { length: 200 }),
    userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
    assignedTo: int("assigned_to").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index("leads_type_idx").on(t.type),
    index("leads_status_idx").on(t.status),
    index("leads_created_idx").on(t.createdAt),
    index("leads_email_idx").on(t.email),
    index("leads_phone_idx").on(t.phone),
  ],
);

export const leadNotes = mysqlTable(
  "lead_notes",
  {
    id: int("id").autoincrement().primaryKey(),
    leadId: int("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    authorId: int("author_id").references(() => users.id, { onDelete: "set null" }),
    kind: mysqlEnum("kind", ["note", "status", "assign"]).notNull().default("note"),
    body: text("body").notNull(),
    createdAt: created(),
  },
  (t) => [index("lead_notes_lead_idx").on(t.leadId)],
);

export const subscribers = mysqlTable("newsletter_subscribers", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 190 }).notNull().unique(),
  source: varchar("source", { length: 200 }),
  createdAt: created(),
});

/* ── Relations ──────────────────────────────────────────────── */

export const carsRelations = relations(cars, ({ many }) => ({ variants: many(variants) }));
export const variantsRelations = relations(variants, ({ one }) => ({ car: one(cars, { fields: [variants.carId], references: [cars.id] }) }));
export const leadsRelations = relations(leads, ({ one, many }) => ({
  user: one(users, { fields: [leads.userId], references: [users.id], relationName: "lead_user" }),
  assignee: one(users, { fields: [leads.assignedTo], references: [users.id], relationName: "lead_assignee" }),
  notes: many(leadNotes),
}));
export const leadNotesRelations = relations(leadNotes, ({ one }) => ({
  lead: one(leads, { fields: [leadNotes.leadId], references: [leads.id] }),
  author: one(users, { fields: [leadNotes.authorId], references: [users.id] }),
}));
