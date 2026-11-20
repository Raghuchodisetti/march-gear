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
  type AnyMySqlColumn,
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
import {
  AD_AUDIENCE,
  AD_CAMPAIGN_STATUS,
  AD_CREATIVE_STATUS,
  AD_FORMATS,
  APPROVAL_TARGETS,
  BRAND_AUTH_STATUS,
  CRM_STATUS,
  FILE_REVIEW_STATUS,
  INS_APPROVAL_TARGETS,
  INS_CAMPAIGN_STATUS,
  INS_CAMPAIGN_TYPES,
  INS_COVER_STATUS,
  INS_COVER_TYPES,
  INS_INTENTS,
  INS_INVOICE_KINDS,
  INS_LEAD_EVENT_KINDS,
  INS_LEAD_STATUS,
  INS_POLICY_STATUS,
  INS_PRODUCT_CATEGORIES,
  INS_PRODUCT_STATUS,
  INS_QUOTE_AUTHORIZATION,
  INS_QUOTE_STATUS,
  INS_RENEWAL_STATUS,
  INS_ROLES,
  INS_TRACK_KINDS,
  INS_VENDOR_CATEGORIES,
  INS_VENDOR_STATUS,
  INVOICE_STATUS,
  LEAD_EVENT_KINDS,
  LEAD_STATUS,
  OFFER_STATUS,
  PARTNER_EVENT_KINDS,
  PARTNER_ROLES,
  PARTNER_STATUS,
  PARTNER_VEHICLE_STATUS,
  PAYMENT_STATUS,
  PLAN_STATUS,
  PUBLISH_STATUS,
  REVIEW_STATUS,
  TEST_DRIVE_STATUS,
  TICKET_PRIORITY,
  TICKET_STATUS,
  USED_STATUS,
  USER_ROLES,
  type LeadType,
} from "./enums";
import type {
  DayHours,
  FileRef,
  OfferDiscount,
  OfferLocations,
  OfferMedia,
  OfferScope,
  PartnerApplication,
  PartnerProfile,
  UsedVehicleDetails,
} from "@/partner/types";
import type {
  CompanyClaimInfo,
  CoverPricing,
  InsurerApplication,
  InsurerProfile,
  PremiumEstimate,
  ProductAddOn,
  ProductCoverage,
  ProductDeductibles,
  ProductDocuments,
  ProductEligibility,
  ProductPricing,
  QuoteBreakdown,
  QuoteCoverLine,
} from "@/insurance/types";

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
  /** Profile shown on /news author pages. */
  bio: text("bio"),
  beat: varchar("beat", { length: 160 }),
  base: varchar("base", { length: 80 }),
  joined: int("joined"),
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
    /** The dealer partner's public reply (from the dealer portal). */
    reply: text("reply"),
    repliedAt: datetime("replied_at"),
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
  state: varchar("state", { length: 64 }),
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

/* ── Site content, media & audit ────────────────────────────── */

/** Editable site copy and settings, one JSON document per block (see src/content/registry.ts). */
export const siteContent = mysqlTable("site_content", {
  key: varchar("key", { length: 64 }).primaryKey(),
  data: json<unknown>("data").notNull(),
  updatedBy: int("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updated(),
});

const longblob = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "longblob" });

/** Uploaded images, served from /media/<id>/<filename>. Stored in MySQL so uploads work without extra services. */
export const media = mysqlTable(
  "media",
  {
    id: int("id").autoincrement().primaryKey(),
    filename: varchar("filename", { length: 200 }).notNull(),
    mime: varchar("mime", { length: 60 }).notNull(),
    size: int("size").notNull(),
    width: int("width"),
    height: int("height"),
    alt: varchar("alt", { length: 300 }),
    data: longblob("data").notNull(),
    createdBy: int("created_by").references(() => users.id, { onDelete: "set null" }),
    /** Set for uploads from the dealer portal (each dealer sees only its own). */
    partnerId: int("partner_id").references((): AnyMySqlColumn => partners.id, { onDelete: "set null" }),
    /** Set for uploads from the insurance vendor portal (each vendor sees only its own). */
    insVendorId: int("ins_vendor_id").references((): AnyMySqlColumn => insVendors.id, { onDelete: "set null" }),
    createdAt: created(),
  },
  (t) => [index("media_created_idx").on(t.createdAt), index("media_partner_idx").on(t.partnerId), index("media_ins_vendor_idx").on(t.insVendorId)],
);

/** Who changed what in the admin panel. */
export const auditLog = mysqlTable(
  "audit_log",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 20 }).notNull(),
    entity: varchar("entity", { length: 40 }).notNull(),
    entityId: varchar("entity_id", { length: 120 }),
    summary: varchar("summary", { length: 300 }).notNull(),
    createdAt: created(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt), index("audit_entity_idx").on(t.entity, t.entityId)],
);

/* ══════════════════════════════════════════════════════════════
   Dealer partner portal (/dealer) and its admin approvals.
   Three independent approval workflows: the partner account,
   each vehicle listing, and each offer.
   ══════════════════════════════════════════════════════════════ */

export const partners = mysqlTable(
  "partners",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Shown to the dealer and staff, e.g. DLR-7KQ2X9. */
    reference: varchar("reference", { length: 16 }).notNull().unique(),
    ownerUserId: int("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", PARTNER_STATUS).notNull().default("draft"),
    /** The registration wizard's document (autosaved). Bank account number is encrypted inside. */
    application: json<PartnerApplication>("application").notNull(),
    /** Furthest wizard step reached (1–7). */
    step: int("step").notNull().default(1),
    // Denormalised for lists and search.
    legalName: varchar("legal_name", { length: 200 }),
    tradeName: varchar("trade_name", { length: 200 }),
    city: varchar("city", { length: 64 }),
    state: varchar("state", { length: 64 }),
    gst: varchar("gst", { length: 20 }),
    /** Public profile — editable any time without re-approval. */
    profile: json<PartnerProfile | null>("profile"),
    /** The public /dealers listing created on approval. */
    publicDealerId: varchar("public_dealer_id", { length: 64 }).references(() => dealers.id, { onDelete: "set null", onUpdate: "cascade" }),
    plan: varchar("plan", { length: 32 }).notNull().default("starter"),
    planStatus: mysqlEnum("plan_status", PLAN_STATUS).notNull().default("trial"),
    planRenewsAt: date("plan_renews_at", { mode: "string" }),
    /** Latest message from MarchGear staff, shown on the application status page. */
    adminRemarks: text("admin_remarks"),
    /** What the dealer must fix (changes requested / documents required). */
    requiredCorrections: json<string[] | null>("required_corrections"),
    submittedAt: datetime("submitted_at"),
    approvedAt: datetime("approved_at"),
    decidedBy: int("decided_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("partners_status_idx").on(t.status), index("partners_owner_idx").on(t.ownerUserId)],
);

export const partnerMembers = mysqlTable(
  "partner_members",
  {
    id: int("id").autoincrement().primaryKey(),
    partnerId: int("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", PARTNER_ROLES).notNull(),
    /** Overrides the role's default permissions when set (see src/partner/permissions.ts). */
    permissions: json<string[] | null>("permissions"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: created(),
  },
  (t) => [uniqueIndex("partner_members_uq").on(t.partnerId, t.userId), index("partner_members_user_idx").on(t.userId)],
);

export const partnerShowrooms = mysqlTable(
  "partner_showrooms",
  {
    id: int("id").autoincrement().primaryKey(),
    partnerId: int("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    address: varchar("address", { length: 300 }).notNull(),
    state: varchar("state", { length: 64 }).notNull(),
    district: varchar("district", { length: 64 }).notNull(),
    city: varchar("city", { length: 64 }).notNull(),
    pin: varchar("pin", { length: 6 }).notNull(),
    lat: double("lat"),
    lng: double("lng"),
    phone: varchar("phone", { length: 30 }),
    hours: json<DayHours[]>("hours").notNull(),
    photos: json<string[]>("photos").notNull(),
    serviceCentre: boolean("service_centre").notNull().default(false),
    isPrimary: boolean("is_primary").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("partner_showrooms_partner_idx").on(t.partnerId)],
);

/** Private uploads (KYC documents, certificates, cheques, inspection reports). Served only to the partner and staff. */
export const partnerFiles = mysqlTable(
  "partner_files",
  {
    id: int("id").autoincrement().primaryKey(),
    partnerId: int("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 40 }).notNull(),
    filename: varchar("filename", { length: 200 }).notNull(),
    mime: varchar("mime", { length: 60 }).notNull(),
    size: int("size").notNull(),
    data: longblob("data").notNull(),
    status: mysqlEnum("status", FILE_REVIEW_STATUS).notNull().default("pending"),
    remarks: text("remarks"),
    uploadedBy: int("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
  },
  (t) => [index("partner_files_partner_idx").on(t.partnerId, t.kind)],
);

export const partnerBrands = mysqlTable(
  "partner_brands",
  {
    id: int("id").autoincrement().primaryKey(),
    partnerId: int("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    /** Catalogue brand slug. */
    brand: varchar("brand", { length: 80 }).notNull(),
    models: json<string[]>("models").notNull(),
    variants: json<string[]>("variants").notNull(),
    certificate: json<FileRef | null>("certificate"),
    validUntil: date("valid_until", { mode: "string" }),
    status: mysqlEnum("status", BRAND_AUTH_STATUS).notNull().default("pending"),
    showroomIds: json<number[]>("showroom_ids").notNull(),
    remarks: text("remarks"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("partner_brands_uq").on(t.partnerId, t.brand)],
);

export const partnerVehicles = mysqlTable(
  "partner_vehicles",
  {
    id: int("id").autoincrement().primaryKey(),
    partnerId: int("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    reference: varchar("reference", { length: 16 }).notNull().unique(),
    kind: mysqlEnum("kind", ["new", "used"]).notNull(),
    brand: varchar("brand", { length: 80 }).notNull(),
    /** Catalogue model, when it is one. */
    modelSlug: varchar("model_slug", { length: 120 }),
    model: varchar("model", { length: 120 }).notNull(),
    variant: varchar("variant", { length: 120 }).notNull(),
    bodyType: varchar("body_type", { length: 20 }).$type<BodyType>().notNull().default("SUV"),
    year: int("year").notNull(),
    fuel: varchar("fuel", { length: 20 }).$type<FuelType>().notNull(),
    transmission: varchar("transmission", { length: 20 }).$type<Transmission>().notNull(),
    colour: varchar("colour", { length: 60 }).notNull(),
    exShowroom: int("ex_showroom"),
    sellingPrice: int("selling_price").notNull(),
    stock: int("stock").notNull().default(1),
    vin: varchar("vin", { length: 32 }),
    description: text("description").notNull(),
    specs: json<{ label: string; value: string }[]>("specs").notNull(),
    features: json<string[]>("features").notNull(),
    images: json<string[]>("images").notNull(),
    videos: json<string[]>("videos").notNull(),
    showroomId: int("showroom_id").references(() => partnerShowrooms.id, { onDelete: "set null" }),
    used: json<UsedVehicleDetails | null>("used"),
    status: mysqlEnum("status", PARTNER_VEHICLE_STATUS).notNull().default("draft"),
    adminRemarks: text("admin_remarks"),
    /** used_cars row mirrored on publish (used vehicles appear on /used-cars). */
    publicUsedCarId: varchar("public_used_car_id", { length: 64 }),
    views: int("views").notNull().default(0),
    enquiries: int("enquiries").notNull().default(0),
    submittedAt: datetime("submitted_at"),
    approvedAt: datetime("approved_at"),
    publishedAt: datetime("published_at"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("partner_vehicles_partner_idx").on(t.partnerId, t.status), index("partner_vehicles_status_idx").on(t.status)],
);

export const partnerOffers = mysqlTable(
  "partner_offers",
  {
    id: int("id").autoincrement().primaryKey(),
    partnerId: int("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    reference: varchar("reference", { length: 16 }).notNull().unique(),
    title: varchar("title", { length: 160 }).notNull(),
    campaignName: varchar("campaign_name", { length: 160 }).notNull(),
    category: varchar("category", { length: 40 }).notNull(),
    description: text("description").notNull(),
    tagline: varchar("tagline", { length: 200 }).notNull(),
    terms: text("terms").notNull(),
    scope: json<OfferScope>("scope").notNull(),
    discount: json<OfferDiscount>("discount").notNull(),
    startsAt: datetime("starts_at").notNull(),
    endsAt: datetime("ends_at").notNull(),
    limitedStock: int("limited_stock"),
    maxRedemptions: int("max_redemptions"),
    redemptions: int("redemptions").notNull().default(0),
    media: json<OfferMedia>("media").notNull(),
    locations: json<OfferLocations>("locations").notNull(),
    /** Stored status; scheduled/active/expired are derived from an approved offer's dates. */
    status: mysqlEnum("status", OFFER_STATUS).notNull().default("draft"),
    adminRemarks: text("admin_remarks"),
    views: int("views").notNull().default(0),
    enquiries: int("enquiries").notNull().default(0),
    conversions: int("conversions").notNull().default(0),
    submittedAt: datetime("submitted_at"),
    approvedAt: datetime("approved_at"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("partner_offers_partner_idx").on(t.partnerId, t.status), index("partner_offers_window_idx").on(t.status, t.startsAt, t.endsAt)],
);

export const partnerLeads = mysqlTable(
  "partner_leads",
  {
    id: int("id").autoincrement().primaryKey(),
    partnerId: int("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    reference: varchar("reference", { length: 16 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    mobile: varchar("mobile", { length: 15 }),
    email: varchar("email", { length: 190 }),
    carLabel: varchar("car_label", { length: 200 }),
    carSlug: varchar("car_slug", { length: 120 }),
    variant: varchar("variant", { length: 120 }),
    vehicleId: int("vehicle_id").references(() => partnerVehicles.id, { onDelete: "set null" }),
    offerId: int("offer_id").references(() => partnerOffers.id, { onDelete: "set null" }),
    budget: varchar("budget", { length: 60 }),
    location: varchar("location", { length: 120 }),
    source: varchar("source", { length: 30 }).notNull().default("website"),
    status: mysqlEnum("status", CRM_STATUS).notNull().default("new"),
    assignedMemberId: int("assigned_member_id").references(() => partnerMembers.id, { onDelete: "set null" }),
    followUpAt: datetime("follow_up_at"),
    lostReason: varchar("lost_reason", { length: 200 }),
    /** The site-wide lead this came from, when it came from the public website. */
    siteLeadId: int("site_lead_id").references(() => leads.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index("partner_leads_partner_idx").on(t.partnerId, t.status),
    index("partner_leads_follow_idx").on(t.partnerId, t.followUpAt),
    index("partner_leads_created_idx").on(t.partnerId, t.createdAt),
  ],
);

export const partnerLeadEvents = mysqlTable(
  "partner_lead_events",
  {
    id: int("id").autoincrement().primaryKey(),
    leadId: int("lead_id")
      .notNull()
      .references(() => partnerLeads.id, { onDelete: "cascade" }),
    memberId: int("member_id").references(() => partnerMembers.id, { onDelete: "set null" }),
    kind: mysqlEnum("kind", LEAD_EVENT_KINDS).notNull(),
    body: text("body").notNull(),
    meta: json<Record<string, string | number | boolean | null> | null>("meta"),
    createdAt: created(),
  },
  (t) => [index("partner_lead_events_lead_idx").on(t.leadId)],
);

export const partnerTestDrives = mysqlTable(
  "partner_test_drives",
  {
    id: int("id").autoincrement().primaryKey(),
    partnerId: int("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    reference: varchar("reference", { length: 16 }).notNull().unique(),
    leadId: int("lead_id").references(() => partnerLeads.id, { onDelete: "set null" }),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    mobile: varchar("mobile", { length: 15 }).notNull(),
    email: varchar("email", { length: 190 }),
    carLabel: varchar("car_label", { length: 200 }).notNull(),
    vehicleId: int("vehicle_id").references(() => partnerVehicles.id, { onDelete: "set null" }),
    showroomId: int("showroom_id").references(() => partnerShowrooms.id, { onDelete: "set null" }),
    /** What the customer asked for. */
    requestedFor: datetime("requested_for"),
    scheduledAt: datetime("scheduled_at"),
    status: mysqlEnum("status", TEST_DRIVE_STATUS).notNull().default("requested"),
    assignedMemberId: int("assigned_member_id").references(() => partnerMembers.id, { onDelete: "set null" }),
    feedback: text("feedback"),
    rating: int("rating"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("partner_test_drives_partner_idx").on(t.partnerId, t.scheduledAt)],
);

export const partnerNotifications = mysqlTable(
  "partner_notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    partnerId: int("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    /** null = everyone at the dealership. */
    userId: int("user_id").references(() => users.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 40 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: varchar("body", { length: 500 }),
    href: varchar("href", { length: 300 }),
    readAt: datetime("read_at"),
    createdAt: created(),
  },
  (t) => [index("partner_notifications_partner_idx").on(t.partnerId, t.createdAt)],
);

export const partnerTickets = mysqlTable(
  "partner_tickets",
  {
    id: int("id").autoincrement().primaryKey(),
    partnerId: int("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    reference: varchar("reference", { length: 16 }).notNull().unique(),
    subject: varchar("subject", { length: 200 }).notNull(),
    category: varchar("category", { length: 40 }).notNull(),
    priority: mysqlEnum("priority", TICKET_PRIORITY).notNull().default("normal"),
    status: mysqlEnum("status", TICKET_STATUS).notNull().default("open"),
    createdBy: int("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("partner_tickets_partner_idx").on(t.partnerId, t.status)],
);

export const partnerTicketMessages = mysqlTable(
  "partner_ticket_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    ticketId: int("ticket_id")
      .notNull()
      .references(() => partnerTickets.id, { onDelete: "cascade" }),
    userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
    fromStaff: boolean("from_staff").notNull().default(false),
    body: text("body").notNull(),
    attachments: json<FileRef[]>("attachments").notNull(),
    createdAt: created(),
  },
  (t) => [index("partner_ticket_messages_ticket_idx").on(t.ticketId)],
);

export const partnerInvoices = mysqlTable(
  "partner_invoices",
  {
    id: int("id").autoincrement().primaryKey(),
    partnerId: int("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    number: varchar("number", { length: 24 }).notNull().unique(),
    plan: varchar("plan", { length: 32 }).notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    /** Rupees, before GST. */
    amount: int("amount").notNull(),
    gst: int("gst").notNull(),
    total: int("total").notNull(),
    status: mysqlEnum("status", INVOICE_STATUS).notNull().default("due"),
    dueOn: date("due_on", { mode: "string" }).notNull(),
    paidAt: datetime("paid_at"),
    createdAt: created(),
  },
  (t) => [index("partner_invoices_partner_idx").on(t.partnerId, t.status)],
);

export const partnerPayments = mysqlTable(
  "partner_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    partnerId: int("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    invoiceId: int("invoice_id")
      .notNull()
      .references(() => partnerInvoices.id, { onDelete: "cascade" }),
    amount: int("amount").notNull(),
    method: mysqlEnum("method", ["bank_transfer", "upi", "cheque"]).notNull(),
    utr: varchar("utr", { length: 40 }).notNull(),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    proof: json<FileRef | null>("proof"),
    status: mysqlEnum("status", PAYMENT_STATUS).notNull().default("submitted"),
    remarks: text("remarks"),
    createdAt: created(),
  },
  (t) => [index("partner_payments_partner_idx").on(t.partnerId)],
);

/** Every submission and decision across the three approval workflows (and brands, documents, profile changes, payments). */
export const partnerApprovals = mysqlTable(
  "partner_approvals",
  {
    id: int("id").autoincrement().primaryKey(),
    partnerId: int("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    target: mysqlEnum("target", APPROVAL_TARGETS).notNull(),
    targetId: int("target_id"),
    action: varchar("action", { length: 30 }).notNull(),
    fromStatus: varchar("from_status", { length: 30 }),
    toStatus: varchar("to_status", { length: 30 }),
    remarks: text("remarks"),
    actorUserId: int("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorSide: mysqlEnum("actor_side", ["dealer", "admin", "system"]).notNull(),
    createdAt: created(),
  },
  (t) => [index("partner_approvals_partner_idx").on(t.partnerId, t.createdAt), index("partner_approvals_target_idx").on(t.target, t.targetId)],
);

/** Edits to verified business details wait here for staff approval. */
export const partnerChangeRequests = mysqlTable(
  "partner_change_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    partnerId: int("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    /** Dotted application path → { from, to }. */
    fields: json<Record<string, { from: string; to: string }>>("fields").notNull(),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
    remarks: text("remarks"),
    requestedBy: int("requested_by").references(() => users.id, { onDelete: "set null" }),
    decidedBy: int("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: datetime("decided_at"),
    createdAt: created(),
  },
  (t) => [index("partner_change_requests_partner_idx").on(t.partnerId, t.status)],
);

/** What people at the dealership did in the portal. */
export const partnerActivity = mysqlTable(
  "partner_activity",
  {
    id: int("id").autoincrement().primaryKey(),
    partnerId: int("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 30 }).notNull(),
    entity: varchar("entity", { length: 40 }).notNull(),
    entityId: varchar("entity_id", { length: 64 }),
    summary: varchar("summary", { length: 300 }).notNull(),
    createdAt: created(),
  },
  (t) => [index("partner_activity_partner_idx").on(t.partnerId, t.createdAt)],
);

/** Public-site interactions for dealer analytics (profile, vehicle and offer views, contact clicks). */
export const partnerEvents = mysqlTable(
  "partner_events",
  {
    id: int("id").autoincrement().primaryKey(),
    partnerId: int("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", PARTNER_EVENT_KINDS).notNull(),
    refId: int("ref_id"),
    createdAt: created(),
  },
  (t) => [index("partner_events_partner_idx").on(t.partnerId, t.kind, t.createdAt)],
);

/** One-time codes for verifying a mobile number or email during registration. */
export const partnerOtps = mysqlTable(
  "partner_otps",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: mysqlEnum("channel", ["mobile", "email"]).notNull(),
    target: varchar("target", { length: 190 }).notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    attempts: int("attempts").notNull().default(0),
    expiresAt: datetime("expires_at").notNull(),
    consumedAt: datetime("consumed_at"),
    createdAt: created(),
  },
  (t) => [index("partner_otps_user_idx").on(t.userId, t.channel)],
);

/* ══════════════════════════════════════════════════════════════
   Insurance marketplace: public /insurance, the vendor portal
   (/insurance-vendor) and /admin/insurance. Independent approval
   workflows for the vendor account, each product, each coverage /
   add-on item and each promotional campaign. See
   docs/insurance-marketplace.md.
   ══════════════════════════════════════════════════════════════ */

/** Insurance companies (underwriters) — the "providers" customers see. Managed by MarchGear staff. */
export const insCompanies = mysqlTable(
  "ins_companies",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    shortName: varchar("short_name", { length: 60 }),
    logo: varchar("logo", { length: 300 }),
    about: text("about"),
    website: varchar("website", { length: 300 }),
    /** As supplied by the insurer / verified by staff. */
    regulatorRegNo: varchar("regulator_reg_no", { length: 60 }),
    headquarters: varchar("headquarters", { length: 120 }),
    establishedYear: int("established_year"),
    /** Cashless garage network size and a note, e.g. "Across 1,200 cities". */
    garageCount: int("garage_count"),
    garageNote: varchar("garage_note", { length: 200 }),
    claimInfo: json<CompanyClaimInfo | null>("claim_info"),
    supportPhone: varchar("support_phone", { length: 30 }),
    claimsPhone: varchar("claims_phone", { length: 30 }),
    claimsEmail: varchar("claims_email", { length: 190 }),
    /** The insurer's own vendor account, when the insurer itself is a vendor. */
    vendorId: int("vendor_id").references((): AnyMySqlColumn => insVendors.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("ins_companies_active_idx").on(t.isActive)],
);

export const insVendors = mysqlTable(
  "ins_vendors",
  {
    id: int("id").autoincrement().primaryKey(),
    /** e.g. INS-7KQ2X9 */
    reference: varchar("reference", { length: 16 }).notNull().unique(),
    ownerUserId: int("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", INS_VENDOR_STATUS).notNull().default("draft"),
    /** The registration wizard's document (autosaved). Bank account number is encrypted inside. */
    application: json<InsurerApplication>("application").notNull(),
    /** Furthest wizard step reached (1–7). */
    step: int("step").notNull().default(1),
    // Denormalised for lists and search.
    category: mysqlEnum("category", INS_VENDOR_CATEGORIES),
    legalName: varchar("legal_name", { length: 200 }),
    brandName: varchar("brand_name", { length: 200 }),
    city: varchar("city", { length: 64 }),
    state: varchar("state", { length: 64 }),
    gst: varchar("gst", { length: 20 }),
    licenceNumber: varchar("licence_number", { length: 60 }),
    licenceValidUntil: date("licence_valid_until", { mode: "string" }),
    profile: json<InsurerProfile | null>("profile"),
    plan: varchar("plan", { length: 32 }).notNull().default("basic"),
    planStatus: mysqlEnum("plan_status", PLAN_STATUS).notNull().default("trial"),
    planRenewsAt: date("plan_renews_at", { mode: "string" }),
    /** Latest message from MarchGear staff, shown on the application status page. */
    adminRemarks: text("admin_remarks"),
    /** What the vendor must fix (changes requested / documents required). */
    requiredCorrections: json<string[] | null>("required_corrections"),
    submittedAt: datetime("submitted_at"),
    approvedAt: datetime("approved_at"),
    decidedBy: int("decided_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("ins_vendors_status_idx").on(t.status), index("ins_vendors_owner_idx").on(t.ownerUserId)],
);

export const insMembers = mysqlTable(
  "ins_members",
  {
    id: int("id").autoincrement().primaryKey(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", INS_ROLES).notNull(),
    /** Overrides the role's default permissions when set (see src/insurance/permissions.ts). */
    permissions: json<string[] | null>("permissions"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: created(),
  },
  (t) => [uniqueIndex("ins_members_uq").on(t.vendorId, t.userId), index("ins_members_user_idx").on(t.userId)],
);

export const insBranches = mysqlTable(
  "ins_branches",
  {
    id: int("id").autoincrement().primaryKey(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    address: varchar("address", { length: 300 }).notNull(),
    city: varchar("city", { length: 64 }).notNull(),
    state: varchar("state", { length: 64 }).notNull(),
    pin: varchar("pin", { length: 6 }).notNull(),
    phone: varchar("phone", { length: 30 }),
    email: varchar("email", { length: 190 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("ins_branches_vendor_idx").on(t.vendorId)],
);

/** Private uploads (KYC, licences, cheques, brochures, wordings). Served only to the vendor and staff — brochures/wordings publicly only while their product is published. */
export const insFiles = mysqlTable(
  "ins_files",
  {
    id: int("id").autoincrement().primaryKey(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 40 }).notNull(),
    filename: varchar("filename", { length: 200 }).notNull(),
    mime: varchar("mime", { length: 60 }).notNull(),
    size: int("size").notNull(),
    data: longblob("data").notNull(),
    status: mysqlEnum("status", FILE_REVIEW_STATUS).notNull().default("pending"),
    remarks: text("remarks"),
    uploadedBy: int("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
  },
  (t) => [index("ins_files_vendor_idx").on(t.vendorId, t.kind)],
);

/** A vendor's coverage items and add-on covers, reviewed by staff before they can appear publicly. */
export const insCovers = mysqlTable(
  "ins_covers",
  {
    id: int("id").autoincrement().primaryKey(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", INS_COVER_TYPES).notNull(),
    /** A standard key from src/insurance/covers.ts (zero_dep, engine_protection…) or "custom". */
    key: varchar("key", { length: 40 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").notNull(),
    /** Plain-language eligibility, e.g. "Cars up to 5 years old". */
    eligibility: varchar("eligibility", { length: 300 }),
    maxVehicleAgeYears: int("max_vehicle_age_years"),
    fuels: json<string[]>("fuels").notNull(),
    exclusions: json<string[]>("exclusions").notNull(),
    /** e.g. "Up to 2 claims per policy year". */
    limits: varchar("limits", { length: 300 }),
    pricing: json<CoverPricing>("pricing").notNull(),
    status: mysqlEnum("status", INS_COVER_STATUS).notNull().default("draft"),
    adminRemarks: text("admin_remarks"),
    submittedAt: datetime("submitted_at"),
    decidedBy: int("decided_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("ins_covers_vendor_idx").on(t.vendorId, t.type), index("ins_covers_status_idx").on(t.status)],
);

export const insProducts = mysqlTable(
  "ins_products",
  {
    id: int("id").autoincrement().primaryKey(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    /** The underwriting insurer. */
    companyId: int("company_id")
      .notNull()
      .references(() => insCompanies.id, { onDelete: "restrict" }),
    /** e.g. PRD-7KQ2X9 — also the public URL: /insurance/products/<reference>. */
    reference: varchar("reference", { length: 16 }).notNull().unique(),
    /** The vendor's own product code. */
    code: varchar("code", { length: 40 }).notNull(),
    /** The insurer's regulator-filed product identifier, if any. */
    uin: varchar("uin", { length: 60 }),
    name: varchar("name", { length: 160 }).notNull(),
    category: mysqlEnum("category", INS_PRODUCT_CATEGORIES).notNull(),
    tagline: varchar("tagline", { length: 200 }),
    description: text("description").notNull(),
    eligibility: json<ProductEligibility>("eligibility").notNull(),
    coverage: json<ProductCoverage>("coverage").notNull(),
    addOns: json<ProductAddOn[]>("add_ons").notNull(),
    pricing: json<ProductPricing>("pricing").notNull(),
    deductibles: json<ProductDeductibles>("deductibles").notNull(),
    /** Cashless garages for this product (falls back to the company's figure). */
    garageCount: int("garage_count"),
    exclusions: json<string[]>("exclusions").notNull(),
    documents: json<ProductDocuments>("documents").notNull(),
    terms: text("terms"),
    status: mysqlEnum("status", INS_PRODUCT_STATUS).notNull().default("draft"),
    adminRemarks: text("admin_remarks"),
    requiredCorrections: json<string[] | null>("required_corrections"),
    submittedAt: datetime("submitted_at"),
    approvedAt: datetime("approved_at"),
    publishedAt: datetime("published_at"),
    decidedBy: int("decided_by").references(() => users.id, { onDelete: "set null" }),
    createdBy: int("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index("ins_products_vendor_idx").on(t.vendorId, t.status),
    index("ins_products_status_idx").on(t.status),
    index("ins_products_company_idx").on(t.companyId),
    uniqueIndex("ins_products_code_uq").on(t.vendorId, t.code),
  ],
);

/** Promotional campaigns shown on the insurance pages once approved (paid ad placements live in ad_campaigns). */
export const insCampaigns = mysqlTable(
  "ins_campaigns",
  {
    id: int("id").autoincrement().primaryKey(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    reference: varchar("reference", { length: 16 }).notNull().unique(),
    title: varchar("title", { length: 160 }).notNull(),
    summary: varchar("summary", { length: 300 }).notNull(),
    description: text("description"),
    type: mysqlEnum("type", INS_CAMPAIGN_TYPES).notNull(),
    productIds: json<number[]>("product_ids").notNull(),
    banner: varchar("banner", { length: 300 }),
    ctaLabel: varchar("cta_label", { length: 40 }),
    startsAt: datetime("starts_at").notNull(),
    endsAt: datetime("ends_at").notNull(),
    status: mysqlEnum("status", INS_CAMPAIGN_STATUS).notNull().default("draft"),
    adminRemarks: text("admin_remarks"),
    submittedAt: datetime("submitted_at"),
    approvedAt: datetime("approved_at"),
    decidedBy: int("decided_by").references(() => users.id, { onDelete: "set null" }),
    createdBy: int("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("ins_campaigns_vendor_idx").on(t.vendorId, t.status), index("ins_campaigns_window_idx").on(t.status, t.startsAt, t.endsAt)],
);

/** Customer enquiries (quote requests) — each goes to one vendor for one product. */
export const insEnquiries = mysqlTable(
  "ins_enquiries",
  {
    id: int("id").autoincrement().primaryKey(),
    reference: varchar("reference", { length: 16 }).notNull().unique(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    productId: int("product_id").references(() => insProducts.id, { onDelete: "set null" }),
    companyId: int("company_id").references(() => insCompanies.id, { onDelete: "set null" }),
    /** Signed-in customer, if any. */
    userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
    intent: mysqlEnum("intent", INS_INTENTS).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    mobile: varchar("mobile", { length: 15 }).notNull(),
    email: varchar("email", { length: 190 }),
    regNumber: varchar("reg_number", { length: 16 }),
    vehicleIsNew: boolean("vehicle_is_new").notNull().default(false),
    brand: varchar("brand", { length: 80 }),
    brandName: varchar("brand_name", { length: 80 }),
    model: varchar("model", { length: 120 }),
    modelName: varchar("model_name", { length: 120 }),
    variant: varchar("variant", { length: 120 }),
    variantName: varchar("variant_name", { length: 120 }),
    year: int("year"),
    fuel: varchar("fuel", { length: 16 }),
    city: varchar("city", { length: 64 }),
    state: varchar("state", { length: 64 }),
    policyStatus: mysqlEnum("policy_status", INS_POLICY_STATUS),
    policyExpiry: date("policy_expiry", { mode: "string" }),
    previousInsurer: varchar("previous_insurer", { length: 160 }),
    ncbPct: int("ncb_pct").notNull().default(0),
    claimedLastYear: boolean("claimed_last_year").notNull().default(false),
    /** Add-on keys the customer ticked. */
    addOns: json<string[]>("add_ons").notNull(),
    idv: int("idv"),
    /** What the customer was shown (always indicative). */
    indicativePremium: int("indicative_premium"),
    estimate: json<PremiumEstimate | null>("estimate"),
    message: varchar("message", { length: 1000 }),
    status: mysqlEnum("status", INS_LEAD_STATUS).notNull().default("new"),
    assignedMemberId: int("assigned_member_id").references(() => insMembers.id, { onDelete: "set null" }),
    followUpAt: datetime("follow_up_at"),
    /** compare, quotes, product, provider, campaign, ad, renewal, new_car… */
    source: varchar("source", { length: 40 }).notNull(),
    campaignId: int("campaign_id").references(() => insCampaigns.id, { onDelete: "set null" }),
    adCampaignId: int("ad_campaign_id").references((): AnyMySqlColumn => adCampaigns.id, { onDelete: "set null" }),
    consentAt: datetime("consent_at").notNull(),
    /** Reported by the vendor. */
    policyIssuedAt: datetime("policy_issued_at"),
    policyNumber: varchar("policy_number", { length: 60 }),
    policyPremium: int("policy_premium"),
    /** Set by MarchGear staff after checking the vendor's evidence. */
    conversionVerifiedAt: datetime("conversion_verified_at"),
    conversionVerifiedBy: int("conversion_verified_by").references(() => users.id, { onDelete: "set null" }),
    lostReason: varchar("lost_reason", { length: 200 }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index("ins_enquiries_vendor_idx").on(t.vendorId, t.status, t.createdAt),
    index("ins_enquiries_user_idx").on(t.userId),
    index("ins_enquiries_mobile_idx").on(t.mobile),
    index("ins_enquiries_created_idx").on(t.createdAt),
  ],
);

/** The enquiry timeline. Every row is internal to the vendor (customers never see it). */
export const insEnquiryEvents = mysqlTable(
  "ins_enquiry_events",
  {
    id: int("id").autoincrement().primaryKey(),
    enquiryId: int("enquiry_id")
      .notNull()
      .references(() => insEnquiries.id, { onDelete: "cascade" }),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
    kind: mysqlEnum("kind", INS_LEAD_EVENT_KINDS).notNull(),
    body: text("body"),
    meta: json<Record<string, string | number | boolean | null> | null>("meta"),
    createdAt: created(),
  },
  (t) => [index("ins_enquiry_events_enquiry_idx").on(t.enquiryId, t.createdAt)],
);

export const insQuotes = mysqlTable(
  "ins_quotes",
  {
    id: int("id").autoincrement().primaryKey(),
    reference: varchar("reference", { length: 16 }).notNull().unique(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    enquiryId: int("enquiry_id")
      .notNull()
      .references(() => insEnquiries.id, { onDelete: "cascade" }),
    productId: int("product_id").references(() => insProducts.id, { onDelete: "set null" }),
    status: mysqlEnum("status", INS_QUOTE_STATUS).notNull().default("draft"),
    authorization: mysqlEnum("authorization", INS_QUOTE_AUTHORIZATION).notNull().default("indicative"),
    /** Required for insurer-authorised quotes: the insurer's own quotation reference. */
    insurerQuoteRef: varchar("insurer_quote_ref", { length: 80 }),
    idv: int("idv").notNull(),
    coverage: json<QuoteCoverLine[]>("coverage").notNull(),
    breakdown: json<QuoteBreakdown>("breakdown").notNull(),
    total: int("total").notNull(),
    validUntil: date("valid_until", { mode: "string" }).notNull(),
    notes: text("notes"),
    terms: text("terms"),
    /** Unguessable token for the customer's link: /insurance/quote/<token>. */
    shareToken: varchar("share_token", { length: 48 }).notNull().unique(),
    viewedAt: datetime("viewed_at"),
    submittedAt: datetime("submitted_at"),
    respondedAt: datetime("responded_at"),
    createdBy: int("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("ins_quotes_vendor_idx").on(t.vendorId, t.status), index("ins_quotes_enquiry_idx").on(t.enquiryId)],
);

export const insRenewals = mysqlTable(
  "ins_renewals",
  {
    id: int("id").autoincrement().primaryKey(),
    reference: varchar("reference", { length: 16 }).notNull().unique(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    enquiryId: int("enquiry_id").references(() => insEnquiries.id, { onDelete: "set null" }),
    name: varchar("name", { length: 120 }).notNull(),
    mobile: varchar("mobile", { length: 15 }).notNull(),
    email: varchar("email", { length: 190 }),
    regNumber: varchar("reg_number", { length: 16 }),
    brandName: varchar("brand_name", { length: 80 }),
    modelName: varchar("model_name", { length: 120 }),
    variantName: varchar("variant_name", { length: 120 }),
    year: int("year"),
    fuel: varchar("fuel", { length: 16 }),
    city: varchar("city", { length: 64 }),
    currentInsurer: varchar("current_insurer", { length: 160 }),
    policyNumber: varchar("policy_number", { length: 60 }),
    policyType: varchar("policy_type", { length: 40 }),
    expiryDate: date("expiry_date", { mode: "string" }).notNull(),
    ncbPct: int("ncb_pct").notNull().default(0),
    premium: int("premium"),
    status: mysqlEnum("status", INS_RENEWAL_STATUS).notNull().default("upcoming"),
    assignedMemberId: int("assigned_member_id").references(() => insMembers.id, { onDelete: "set null" }),
    followUpAt: datetime("follow_up_at"),
    notes: text("notes"),
    renewedAt: datetime("renewed_at"),
    /** enquiry (public renewal form), manual (added by the vendor) or policy (from an issued policy). */
    source: varchar("source", { length: 20 }).notNull(),
    createdBy: int("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("ins_renewals_vendor_idx").on(t.vendorId, t.status, t.expiryDate)],
);

export const insNotifications = mysqlTable(
  "ins_notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    /** null = everyone at the vendor. */
    userId: int("user_id").references(() => users.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 40 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: varchar("body", { length: 500 }),
    href: varchar("href", { length: 300 }),
    readAt: datetime("read_at"),
    createdAt: created(),
  },
  (t) => [index("ins_notifications_vendor_idx").on(t.vendorId, t.createdAt)],
);

export const insTickets = mysqlTable(
  "ins_tickets",
  {
    id: int("id").autoincrement().primaryKey(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    reference: varchar("reference", { length: 16 }).notNull().unique(),
    subject: varchar("subject", { length: 200 }).notNull(),
    category: varchar("category", { length: 40 }).notNull(),
    priority: mysqlEnum("priority", TICKET_PRIORITY).notNull().default("normal"),
    status: mysqlEnum("status", TICKET_STATUS).notNull().default("open"),
    createdBy: int("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("ins_tickets_vendor_idx").on(t.vendorId, t.status)],
);

export const insTicketMessages = mysqlTable(
  "ins_ticket_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    ticketId: int("ticket_id")
      .notNull()
      .references(() => insTickets.id, { onDelete: "cascade" }),
    userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
    fromStaff: boolean("from_staff").notNull().default(false),
    body: text("body").notNull(),
    attachments: json<FileRef[]>("attachments").notNull(),
    createdAt: created(),
  },
  (t) => [index("ins_ticket_messages_ticket_idx").on(t.ticketId)],
);

/** Invoices to insurance vendors (subscriptions and advertising). Numbered MGI/26-27/00001 — a separate series from dealer invoices. */
export const insInvoices = mysqlTable(
  "ins_invoices",
  {
    id: int("id").autoincrement().primaryKey(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    number: varchar("number", { length: 24 }).notNull().unique(),
    kind: mysqlEnum("kind", INS_INVOICE_KINDS).notNull(),
    description: varchar("description", { length: 300 }).notNull(),
    /** Subscription plan id, when kind = subscription. */
    plan: varchar("plan", { length: 32 }),
    adCampaignId: int("ad_campaign_id").references((): AnyMySqlColumn => adCampaigns.id, { onDelete: "set null" }),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    /** Rupees, before GST. */
    amount: int("amount").notNull(),
    gst: int("gst").notNull(),
    total: int("total").notNull(),
    status: mysqlEnum("status", INVOICE_STATUS).notNull().default("due"),
    dueOn: date("due_on", { mode: "string" }).notNull(),
    paidAt: datetime("paid_at"),
    createdAt: created(),
  },
  (t) => [index("ins_invoices_vendor_idx").on(t.vendorId, t.status), index("ins_invoices_kind_idx").on(t.kind)],
);

export const insPayments = mysqlTable(
  "ins_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    invoiceId: int("invoice_id")
      .notNull()
      .references(() => insInvoices.id, { onDelete: "cascade" }),
    amount: int("amount").notNull(),
    method: mysqlEnum("method", ["bank_transfer", "upi", "cheque"]).notNull(),
    utr: varchar("utr", { length: 40 }).notNull(),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    proof: json<FileRef | null>("proof"),
    status: mysqlEnum("status", PAYMENT_STATUS).notNull().default("submitted"),
    remarks: text("remarks"),
    verifiedBy: int("verified_by").references(() => users.id, { onDelete: "set null" }),
    verifiedAt: datetime("verified_at"),
    createdAt: created(),
  },
  (t) => [index("ins_payments_vendor_idx").on(t.vendorId), index("ins_payments_invoice_idx").on(t.invoiceId)],
);

/** Money MarchGear has paid back against a verified payment (recorded by staff; no gateway). */
export const insRefunds = mysqlTable(
  "ins_refunds",
  {
    id: int("id").autoincrement().primaryKey(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    invoiceId: int("invoice_id")
      .notNull()
      .references(() => insInvoices.id, { onDelete: "cascade" }),
    paymentId: int("payment_id").references(() => insPayments.id, { onDelete: "set null" }),
    amount: int("amount").notNull(),
    reason: varchar("reason", { length: 300 }).notNull(),
    /** Bank / UPI reference of the refund. */
    reference: varchar("reference", { length: 60 }).notNull(),
    refundedOn: date("refunded_on", { mode: "string" }).notNull(),
    createdBy: int("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
  },
  (t) => [index("ins_refunds_vendor_idx").on(t.vendorId)],
);

/** Every submission and decision across the insurance approval workflows. */
export const insApprovals = mysqlTable(
  "ins_approvals",
  {
    id: int("id").autoincrement().primaryKey(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    target: mysqlEnum("target", INS_APPROVAL_TARGETS).notNull(),
    targetId: int("target_id"),
    /** submitted, approved, rejected, changes_requested, documents_required, published, unpublished, suspended, reactivated, internal_note… */
    action: varchar("action", { length: 30 }).notNull(),
    fromStatus: varchar("from_status", { length: 30 }),
    toStatus: varchar("to_status", { length: 30 }),
    remarks: text("remarks"),
    actorUserId: int("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorSide: mysqlEnum("actor_side", ["vendor", "admin", "system"]).notNull(),
    createdAt: created(),
  },
  (t) => [index("ins_approvals_vendor_idx").on(t.vendorId, t.createdAt), index("ins_approvals_target_idx").on(t.target, t.targetId)],
);

/** Edits to verified business details (legal name, GSTIN, PAN, licence, bank) wait here for staff approval. */
export const insChangeRequests = mysqlTable(
  "ins_change_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    /** Dotted application path → { from, to }. */
    fields: json<Record<string, { from: string; to: string }>>("fields").notNull(),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
    remarks: text("remarks"),
    requestedBy: int("requested_by").references(() => users.id, { onDelete: "set null" }),
    decidedBy: int("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: datetime("decided_at"),
    createdAt: created(),
  },
  (t) => [index("ins_change_requests_vendor_idx").on(t.vendorId, t.status)],
);

/** What people at the vendor did in the portal. */
export const insActivity = mysqlTable(
  "ins_activity",
  {
    id: int("id").autoincrement().primaryKey(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 30 }).notNull(),
    entity: varchar("entity", { length: 40 }).notNull(),
    entityId: varchar("entity_id", { length: 64 }),
    summary: varchar("summary", { length: 300 }).notNull(),
    createdAt: created(),
  },
  (t) => [index("ins_activity_vendor_idx").on(t.vendorId, t.createdAt)],
);

/** Public-site interactions for vendor analytics. */
export const insEvents = mysqlTable(
  "ins_events",
  {
    id: int("id").autoincrement().primaryKey(),
    vendorId: int("vendor_id")
      .notNull()
      .references(() => insVendors.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", INS_TRACK_KINDS).notNull(),
    refId: int("ref_id"),
    createdAt: created(),
  },
  (t) => [index("ins_events_vendor_idx").on(t.vendorId, t.kind, t.createdAt)],
);

/* ══════════════════════════════════════════════════════════════
   Site-wide advertising. Placements are defined in code
   (src/ads/placements.ts) and priced by staff; campaigns and their
   creatives are approved separately. Insurance vendors book them
   today; partner_id is there for dealer bookings later; "house"
   campaigns are MarchGear's own.
   ══════════════════════════════════════════════════════════════ */

export const adPlacements = mysqlTable("ad_placements", {
  id: int("id").autoincrement().primaryKey(),
  /** Matches a key in src/ads/placements.ts (where the slot is rendered). */
  key: varchar("key", { length: 48 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 300 }).notNull(),
  /** Where it appears, e.g. "Homepage, below the hero". */
  location: varchar("location", { length: 160 }).notNull(),
  format: mysqlEnum("format", AD_FORMATS).notNull(),
  /** Recommended creative sizes, e.g. "1600×400". */
  desktopSize: varchar("desktop_size", { length: 20 }),
  mobileSize: varchar("mobile_size", { length: 20 }),
  /** Rupees per day, before GST. */
  pricePerDay: int("price_per_day").notNull(),
  minDays: int("min_days").notNull().default(7),
  maxDays: int("max_days").notNull().default(90),
  /** How many campaigns may run in this slot at once (they rotate). */
  slots: int("slots").notNull().default(1),
  audience: mysqlEnum("audience", AD_AUDIENCE).notNull().default("all"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});

export const adCampaigns = mysqlTable(
  "ad_campaigns",
  {
    id: int("id").autoincrement().primaryKey(),
    reference: varchar("reference", { length: 16 }).notNull().unique(),
    placementId: int("placement_id")
      .notNull()
      .references(() => adPlacements.id, { onDelete: "restrict" }),
    /** Exactly one advertiser: an insurance vendor, a dealer partner, or MarchGear itself (house). */
    insVendorId: int("ins_vendor_id").references((): AnyMySqlColumn => insVendors.id, { onDelete: "cascade" }),
    partnerId: int("partner_id").references(() => partners.id, { onDelete: "cascade" }),
    house: boolean("house").notNull().default(false),
    name: varchar("name", { length: 160 }).notNull(),
    /** Sponsored listings promote one published product. */
    productId: int("product_id").references((): AnyMySqlColumn => insProducts.id, { onDelete: "set null" }),
    /** Where a click goes: a /path on this site or an https:// URL. */
    targetUrl: varchar("target_url", { length: 300 }),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    days: int("days").notNull(),
    /** Price snapshot at booking (₹, before GST). */
    pricePerDay: int("price_per_day").notNull(),
    amount: int("amount").notNull(),
    gst: int("gst").notNull(),
    total: int("total").notNull(),
    status: mysqlEnum("status", AD_CAMPAIGN_STATUS).notNull().default("draft"),
    adminRemarks: text("admin_remarks"),
    submittedAt: datetime("submitted_at"),
    approvedAt: datetime("approved_at"),
    decidedBy: int("decided_by").references(() => users.id, { onDelete: "set null" }),
    createdBy: int("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index("ad_campaigns_placement_idx").on(t.placementId, t.status, t.startsOn, t.endsOn),
    index("ad_campaigns_vendor_idx").on(t.insVendorId, t.status),
    index("ad_campaigns_partner_idx").on(t.partnerId),
  ],
);

export const adCreatives = mysqlTable(
  "ad_creatives",
  {
    id: int("id").autoincrement().primaryKey(),
    campaignId: int("campaign_id")
      .notNull()
      .references(() => adCampaigns.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    /** Public /media URLs. Banners need both; sponsored listings may use neither. */
    desktopImage: varchar("desktop_image", { length: 300 }),
    mobileImage: varchar("mobile_image", { length: 300 }),
    headline: varchar("headline", { length: 120 }),
    body: varchar("body", { length: 240 }),
    ctaLabel: varchar("cta_label", { length: 40 }),
    alt: varchar("alt", { length: 200 }).notNull(),
    status: mysqlEnum("status", AD_CREATIVE_STATUS).notNull().default("pending"),
    remarks: text("remarks"),
    decidedBy: int("decided_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("ad_creatives_campaign_idx").on(t.campaignId, t.status)],
);

/** Daily counters per campaign (one row per campaign per IST day). */
export const adStats = mysqlTable(
  "ad_stats",
  {
    campaignId: int("campaign_id")
      .notNull()
      .references(() => adCampaigns.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    impressions: int("impressions").notNull().default(0),
    clicks: int("clicks").notNull().default(0),
    enquiries: int("enquiries").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.day] })],
);
