/**
 * Clearly-labelled sample data for exploring the insurance marketplace
 * (/insurance, /insurance-vendor, /admin/insurance, /admin/advertising).
 *
 *   npm run db:seed-insurance               create the demo insurers — does nothing if they already exist
 *   npm run db:seed-insurance -- --reset    delete them and create them again
 *   npm run db:seed-insurance -- --remove   delete them and everything they created
 *
 * Every company and vendor is fictional and named "… (demo)". No claim figures are
 * seeded (they're only shown once staff verify real ones).
 *
 * Main demo vendor login: DEMO_INSURER_EMAIL (default demo-insurer@marchgear.in) /
 * DEMO_INSURER_PASSWORD from .env.local. When the password isn't set, a strong one is
 * generated and written to .env.local (never printed).
 *
 * ⚠ Demo data only — never run this against the live database.
 */
import Module from "node:module";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { and, desc, eq, inArray, like, or } from "drizzle-orm";
import { closeDb, getDb } from "./index";
import * as s from "./schema";
import type {
  InsCampaignStatus,
  InsCampaignType,
  InsCoverStatus,
  InsIntent,
  InsLeadEventKind,
  InsLeadStatus,
  InsPolicyStatus,
  InsProductCategory,
  InsProductStatus,
  InsQuoteAuthorization,
  InsQuoteStatus,
  InsRenewalStatus,
  InsRole,
  InsVendorCategory,
  InsVendorStatus,
} from "./enums";
import { IMG } from "@/data/images";
import { PLACEMENTS } from "@/ads/placements";
import { STANDARD_COVER_BY_KEY } from "@/insurance/covers";
import { emptyInsurerApplication } from "@/insurance/application";
import { CATEGORY_TERMS, DEFAULT_PRICING_CONFIG, estimatePremium, parseEngineCc, vehicleAgeMonths } from "@/insurance/estimator";
import type { CoverPricing, FuelName, InsurerApplication, ProductEligibility, ProductPricing, QuoteBreakdown } from "@/insurance/types";

/* ── Run server modules outside Next.js ───────────────────────── */
type Loader = (request: string, parent: unknown, isMain: boolean) => unknown;
const mod = Module as unknown as { _load: Loader };
const load = mod._load;
mod._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return load.call(this, request, parent, isMain);
};

const args = process.argv.slice(2);
const RESET = args.includes("--reset");
const REMOVE = args.includes("--remove");
const db = getDb();
const log = (msg: string) => console.log(`  ${msg}`);

/* ── Deterministic randomness & IST dates ───────────────────── */

let seed = 20261120;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];

const NOW = new Date();
const DAY = 86_400_000;
const IST = 5.5 * 3_600_000;
const istDay = (offset = 0) => new Date(NOW.getTime() + IST + offset * DAY).toISOString().slice(0, 10);
/** An instant `days` ago (negative = in the future) at roughly `hour` IST. */
const at = (days: number, hour = 11, minute = 0) => {
  const d = new Date(`${istDay(-days)}T00:00:00Z`);
  return new Date(d.getTime() + (hour * 60 + minute) * 60_000 - IST);
};
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const ref = (prefix: string, n: number) => `${prefix}-DM${String(n).padStart(4, "0")}`;

/* ── Credentials (.env.local) ───────────────────────────────── */

function credentials() {
  const email = (process.env.DEMO_INSURER_EMAIL?.trim() || "demo-insurer@marchgear.in").toLowerCase();
  let password = process.env.DEMO_INSURER_PASSWORD ?? "";
  let generated = false;
  if (!password) {
    password = `Mg-${randomBytes(18).toString("base64url")}`;
    generated = true;
    const file = path.resolve(process.cwd(), ".env.local");
    let text = existsSync(file) ? readFileSync(file, "utf8") : "";
    const setVar = (key: string, value: string) => {
      const re = new RegExp(`^${key}=.*$`, "m");
      if (re.test(text)) text = text.replace(re, `${key}=${value}`);
      else text += `${text.endsWith("\n") || !text ? "" : "\n"}${key}=${value}\n`;
    };
    if (!/^DEMO_INSURER_EMAIL=/m.test(text) && !/^DEMO_INSURER_PASSWORD=/m.test(text))
      text += `${text.endsWith("\n") || !text ? "" : "\n"}\n# Demo insurance vendor login (npm run db:seed-insurance). Local/dev databases only.\n`;
    setVar("DEMO_INSURER_EMAIL", email);
    setVar("DEMO_INSURER_PASSWORD", password);
    writeFileSync(file, text);
  }
  return { email, password, generated };
}

/** demo-insurer@marchgear.in → demo-insurer+konkan@marchgear.in */
const tagged = (owner: string, tag: string) => owner.replace("@", `+${tag}@`);

/* ── The fictional cast ─────────────────────────────────────── */

interface CompanySpec {
  slug: string;
  name: string;
  shortName: string;
  hq: string;
  founded: number;
  garages: number;
  garageNote: string;
  about: string;
  process: string[];
}

const COMPANIES: CompanySpec[] = [
  {
    slug: "aravalli-general-demo",
    name: "Aravalli General Insurance (demo)",
    shortName: "Aravalli (demo)",
    hq: "Jaipur",
    founded: 2009,
    garages: 4200,
    garageNote: "Network garages across 380 cities (demo figure)",
    about:
      "A fictional general insurer used to demonstrate MarchGear's insurance marketplace. Its products, prices and network figures are sample data and do not describe any real company.",
    process: [
      "Call the claims line or raise the claim online within 24 hours of the incident.",
      "Share the policy number, photos of the damage and the driving licence.",
      "Take the car to a network garage for cashless repair, or to any garage for reimbursement.",
      "A surveyor inspects the car; repairs start once the estimate is approved.",
    ],
  },
  {
    slug: "konkan-shield-demo",
    name: "Konkan Shield General Insurance (demo)",
    shortName: "Konkan Shield (demo)",
    hq: "Pune",
    founded: 2014,
    garages: 2600,
    garageNote: "Strongest in western and southern India (demo figure)",
    about: "A fictional general insurer for demonstration. Nothing here describes a real insurer.",
    process: [
      "Register the claim on the helpline with your policy number.",
      "Upload photos and documents through the claim link you receive.",
      "Choose cashless repair at a network garage or reimbursement.",
      "Track approval and settlement on the claim link.",
    ],
  },
  {
    slug: "deccan-mutual-demo",
    name: "Deccan Mutual General Insurance (demo)",
    shortName: "Deccan Mutual (demo)",
    hq: "Hyderabad",
    founded: 2011,
    garages: 3100,
    garageNote: "Network garages in 290 cities (demo figure)",
    about: "A fictional insurer whose products are distributed on MarchGear by a demo broker. Sample data only.",
    process: ["Inform the insurer or your broker as soon as possible.", "Submit the claim form, photos and documents.", "Survey, approval and repair or reimbursement."],
  },
  {
    slug: "nilgiri-assurance-demo",
    name: "Nilgiri Assurance (demo)",
    shortName: "Nilgiri (demo)",
    hq: "Coimbatore",
    founded: 2018,
    garages: 900,
    garageNote: "Growing network in Tamil Nadu and Kerala (demo figure)",
    about: "A fictional insurer whose vendor application is still under review. Sample data only.",
    process: [],
  },
];

interface VendorSpec {
  tag: string;
  ref: string;
  status: InsVendorStatus;
  category: InsVendorCategory;
  legalName: string;
  brandName: string;
  city: string;
  state: string;
  pin: string;
  plan: "basic" | "professional" | "enterprise";
  approvedDaysAgo: number | null;
  submittedDaysAgo: number | null;
  company: string | null;
  owner: string;
  remarks?: string;
  corrections?: string[];
}

const VENDORS: VendorSpec[] = [
  { tag: "", ref: "INS-DEMO01", status: "approved", category: "insurer", legalName: "Aravalli General Insurance Limited (demo data)", brandName: "Aravalli General (demo)", city: "Jaipur", state: "Rajasthan", pin: "302001", plan: "professional", approvedDaysAgo: 160, submittedDaysAgo: 165, company: "aravalli-general-demo", owner: "Meera Rathore" },
  { tag: "konkan", ref: "INS-DEMO02", status: "approved", category: "insurer", legalName: "Konkan Shield General Insurance Limited (demo data)", brandName: "Konkan Shield (demo)", city: "Pune", state: "Maharashtra", pin: "411001", plan: "basic", approvedDaysAgo: 90, submittedDaysAgo: 94, company: "konkan-shield-demo", owner: "Aniket Deshmukh" },
  { tag: "roadcover", ref: "INS-DEMO03", status: "approved", category: "broker", legalName: "RoadCover Insurance Brokers Private Limited (demo data)", brandName: "RoadCover Brokers (demo)", city: "Hyderabad", state: "Telangana", pin: "500081", plan: "enterprise", approvedDaysAgo: 60, submittedDaysAgo: 63, company: null, owner: "Sravani Reddy" },
  { tag: "nilgiri", ref: "INS-DEMO04", status: "pending_approval", category: "insurer", legalName: "Nilgiri Assurance Limited (demo data)", brandName: "Nilgiri Assurance (demo)", city: "Coimbatore", state: "Tamil Nadu", pin: "641001", plan: "basic", approvedDaysAgo: null, submittedDaysAgo: 2, company: null, owner: "Karthik Subramanian" },
  {
    tag: "coastline",
    ref: "INS-DEMO05",
    status: "changes_requested",
    category: "corporate_agent",
    legalName: "Coastline Corporate Agency Private Limited (demo data)",
    brandName: "Coastline Agency (demo)",
    city: "Kochi",
    state: "Kerala",
    pin: "682011",
    plan: "basic",
    approvedDaysAgo: null,
    submittedDaysAgo: 6,
    company: null,
    owner: "Anna Mathew",
    remarks: "Thanks for applying. Please upload a clearer copy of your registration certificate and confirm the licence validity date.",
    corrections: ["Registration certificate: the uploaded copy is unreadable", "Licence validity: the date doesn't match the certificate"],
  },
];

function application(v: VendorSpec, email: string): InsurerApplication {
  const app = emptyInsurerApplication({ name: v.owner, email, mobile: "9000000000" });
  app.contact = { name: v.owner, designation: "Head of Digital Partnerships", mobile: "9000000000", mobileVerified: true, email, emailVerified: true };
  app.company = { legalName: v.legalName, brandName: v.brandName, businessType: v.category === "insurer" ? "public_limited" : "private_limited", website: "https://example.com", address: "Demo Tower, 1 Sample Road", city: v.city, state: v.state, pin: v.pin };
  app.registration = { gstin: "", pan: "", cin: "", establishedOn: "2015-04-01" };
  app.regulatory = {
    category: v.category,
    registrationType: v.category === "insurer" ? "Registered general insurer (demo)" : v.category === "broker" ? "Direct broker — general (demo)" : "Corporate agent — general (demo)",
    licenceNumber: `DEMO-${v.ref.slice(-2)}`,
    licenceValidUntil: "2029-03-31",
    representative: { name: v.owner, designation: "Principal Officer", mobile: "9000000001", email },
    documents: [],
  };
  app.branches = [{ key: "hq", name: "Head office", address: "Demo Tower, 1 Sample Road", city: v.city, state: v.state, pin: v.pin, phone: "1800000000", email, isPrimary: true }];
  app.bank = { holder: v.legalName, bankName: "Demo Bank", accountNumber: "", accountMasked: "XXXXXXXX0000", ifsc: "DEMO0000001", proof: null };
  app.declaration = { accepted: true, name: v.owner, acceptedAt: at(v.submittedDaysAgo ?? 0).toISOString() };
  return app;
}

/* ── Covers ─────────────────────────────────────────────────── */

const COVERAGE_KEYS = ["own_damage", "third_party", "pa_owner_driver", "natural_calamity", "theft", "fire"];
const ADDON_KEYS = ["zero_dep", "engine_protection", "rsa", "rti", "consumables", "key_replacement", "tyre_protection", "ncb_protect", "ev_battery"];

/** Each insurer prices add-ons a little differently. */
const priceFor = (key: string, factor: number): CoverPricing => {
  const p = STANDARD_COVER_BY_KEY[key].defaultPricing;
  if (p.basis === "included") return p;
  return { basis: p.basis, value: p.basis === "flat" ? Math.round((p.value * factor) / 10) * 10 : Math.round(p.value * factor * 100) / 100 };
};

/* ── Products ───────────────────────────────────────────────── */

interface ProductSpec {
  vendor: number; // index into VENDORS
  company: string;
  code: string;
  name: string;
  category: InsProductCategory;
  tagline: string;
  description: string;
  odRate: number;
  status: InsProductStatus;
  addOns: { key: string; included: boolean }[];
  eligibility?: Partial<ProductEligibility>;
  highlights: string[];
  exclusions: string[];
  garages?: number;
}

const BASE_EXCLUSIONS = [
  "Normal wear and tear, and mechanical or electrical breakdown",
  "Driving under the influence of alcohol or drugs",
  "Driving without a valid licence",
  "Consequential loss",
  "Use outside the purposes allowed by the policy",
];

const PRODUCTS: ProductSpec[] = [
  {
    vendor: 0,
    company: "aravalli-general-demo",
    code: "AGI-DRIVE",
    name: "Aravalli Drive Comprehensive (demo)",
    category: "comprehensive",
    tagline: "Everyday comprehensive cover with a large cashless network",
    description: "Sample comprehensive policy: own damage and third-party liability together, with optional add-ons. Demo data for exploring the marketplace.",
    odRate: 2.6,
    status: "published",
    addOns: [
      { key: "zero_dep", included: false },
      { key: "engine_protection", included: false },
      { key: "rsa", included: true },
      { key: "rti", included: false },
      { key: "consumables", included: false },
      { key: "key_replacement", included: false },
    ],
    highlights: ["Roadside assistance included", "Cashless repairs at network garages", "Instant claim registration"],
    exclusions: BASE_EXCLUSIONS,
  },
  {
    vendor: 0,
    company: "aravalli-general-demo",
    code: "AGI-NEWCAR",
    name: "Aravalli Fresh Wheels — New Car (demo)",
    category: "new_car",
    tagline: "1-year own damage with 3-year third-party for new cars",
    description: "Sample bundled policy for cars being registered for the first time. Demo data.",
    odRate: 2.4,
    status: "published",
    addOns: [
      { key: "zero_dep", included: true },
      { key: "rti", included: false },
      { key: "engine_protection", included: false },
      { key: "consumables", included: false },
      { key: "rsa", included: true },
    ],
    eligibility: { maxAgeYears: 0 },
    highlights: ["Zero depreciation included", "Return-to-invoice available", "3 years of third-party cover"],
    exclusions: BASE_EXCLUSIONS,
  },
  {
    vendor: 0,
    company: "aravalli-general-demo",
    code: "AGI-EV",
    name: "Aravalli Charge — EV Cover (demo)",
    category: "ev",
    tagline: "Built for electric cars, battery and charger included",
    description: "Sample EV policy with battery protection and charger cover options. Demo data.",
    odRate: 2.2,
    status: "published",
    addOns: [
      { key: "ev_battery", included: false },
      { key: "zero_dep", included: false },
      { key: "rsa", included: true },
      { key: "key_replacement", included: false },
    ],
    eligibility: { fuels: ["Electric"], maxAgeYears: 8 },
    highlights: ["EV battery protection add-on", "Towing to the nearest charger", "EV-trained network garages"],
    exclusions: [...BASE_EXCLUSIONS, "Battery degradation from normal use"],
  },
  {
    vendor: 0,
    company: "aravalli-general-demo",
    code: "AGI-TP",
    name: "Aravalli Third-Party Basic (demo)",
    category: "third_party",
    tagline: "The cover the law requires, nothing more",
    description: "Sample third-party liability policy. Demo data.",
    odRate: 2.6,
    status: "published",
    addOns: [],
    highlights: ["Legal liability cover", "Owner-driver PA cover"],
    exclusions: ["Damage to your own car", ...BASE_EXCLUSIONS.slice(1)],
  },
  {
    vendor: 0,
    company: "aravalli-general-demo",
    code: "AGI-OD",
    name: "Aravalli Own Damage Plus (demo)",
    category: "own_damage",
    tagline: "Standalone own-damage cover for cars with third-party already in place",
    description: "Sample standalone own-damage policy. Demo data — waiting for MarchGear approval.",
    odRate: 2.7,
    status: "pending_approval",
    addOns: [
      { key: "zero_dep", included: false },
      { key: "consumables", included: false },
    ],
    highlights: ["Pairs with your existing third-party policy"],
    exclusions: BASE_EXCLUSIONS,
  },
  {
    vendor: 1,
    company: "konkan-shield-demo",
    code: "KSG-COMP",
    name: "Konkan Shield Comprehensive (demo)",
    category: "comprehensive",
    tagline: "Value comprehensive cover with quick surveys",
    description: "Sample comprehensive policy. Demo data.",
    odRate: 2.9,
    status: "published",
    addOns: [
      { key: "zero_dep", included: false },
      { key: "engine_protection", included: false },
      { key: "rsa", included: false },
      { key: "consumables", included: false },
      { key: "tyre_protection", included: false },
    ],
    highlights: ["Survey within 24 hours (demo)", "Add-ons priced individually"],
    exclusions: BASE_EXCLUSIONS,
  },
  {
    vendor: 1,
    company: "konkan-shield-demo",
    code: "KSG-USED",
    name: "Konkan Pre-Owned Protect (demo)",
    category: "used_car",
    tagline: "For cars bought second-hand",
    description: "Sample used-car policy including transfer of cover. Demo data.",
    odRate: 3.1,
    status: "published",
    addOns: [
      { key: "rsa", included: true },
      { key: "engine_protection", included: false },
      { key: "key_replacement", included: false },
    ],
    eligibility: { minAgeYears: 2, maxAgeYears: 12 },
    highlights: ["Roadside assistance included", "Help with ownership transfer of the policy"],
    exclusions: BASE_EXCLUSIONS,
  },
  {
    vendor: 1,
    company: "konkan-shield-demo",
    code: "KSG-LT3",
    name: "Konkan Long Haul 3-Year (demo)",
    category: "long_term",
    tagline: "Three years of cover in one go",
    description: "Sample multi-year policy. Demo data — still a draft.",
    odRate: 2.8,
    status: "draft",
    addOns: [{ key: "zero_dep", included: false }],
    highlights: ["No yearly renewals"],
    exclusions: BASE_EXCLUSIONS,
  },
  {
    vendor: 2,
    company: "deccan-mutual-demo",
    code: "RCB-DMC",
    name: "Deccan Smart Comprehensive (demo)",
    category: "comprehensive",
    tagline: "Distributed by RoadCover Brokers",
    description: "Sample comprehensive policy underwritten by a demo insurer and distributed by a demo broker. Demo data.",
    odRate: 2.75,
    status: "published",
    addOns: [
      { key: "zero_dep", included: false },
      { key: "engine_protection", included: false },
      { key: "rsa", included: false },
      { key: "rti", included: false },
      { key: "consumables", included: false },
      { key: "ncb_protect", included: false },
    ],
    highlights: ["Broker-assisted claims", "NCB protection available"],
    exclusions: BASE_EXCLUSIONS,
  },
  {
    vendor: 2,
    company: "deccan-mutual-demo",
    code: "RCB-DMB",
    name: "Deccan Bundled New Car (demo)",
    category: "bundled",
    tagline: "1 + 3 for new cars, through RoadCover Brokers",
    description: "Sample bundled policy for new cars. Demo data.",
    odRate: 2.5,
    status: "published",
    addOns: [
      { key: "zero_dep", included: false },
      { key: "rti", included: false },
      { key: "rsa", included: true },
    ],
    eligibility: { maxAgeYears: 0 },
    highlights: ["Roadside assistance included", "Return-to-invoice available"],
    exclusions: BASE_EXCLUSIONS,
  },
];

/* ── Customers & cars for enquiries ─────────────────────────── */

const FIRST = ["Aarav", "Priya", "Rohan", "Sneha", "Vikram", "Ananya", "Karan", "Divya", "Arjun", "Kavya", "Siddharth", "Ishita", "Rahul", "Neha", "Aditya", "Pooja", "Manish", "Ritu", "Varun", "Shreya"];
const LAST = ["Sharma", "Iyer", "Reddy", "Patel", "Nair", "Gupta", "Kulkarni", "Menon", "Singh", "Joshi", "Rao", "Banerjee", "Chopra", "Das", "Pillai"];
const PLACES: [string, string][] = [
  ["Jaipur", "Rajasthan"],
  ["Pune", "Maharashtra"],
  ["Mumbai", "Maharashtra"],
  ["Bengaluru", "Karnataka"],
  ["Hyderabad", "Telangana"],
  ["Chennai", "Tamil Nadu"],
  ["New Delhi", "Delhi"],
  ["Ahmedabad", "Gujarat"],
  ["Kochi", "Kerala"],
  ["Visakhapatnam", "Andhra Pradesh"],
];

interface CatalogCar {
  slug: string;
  brand: string;
  brandName: string;
  name: string;
  engine: string;
  motorKw: number | null;
  variants: { slug: string; name: string; fuel: FuelName; price: number }[];
}

async function catalogCars(): Promise<CatalogCar[]> {
  const rows = await db
    .select({ slug: s.cars.slug, brand: s.cars.brand, brandName: s.brands.name, name: s.cars.name, engine: s.cars.engine, ev: s.cars.ev, carId: s.cars.id })
    .from(s.cars)
    .innerJoin(s.brands, eq(s.brands.slug, s.cars.brand))
    .where(eq(s.cars.status, "published"));
  const vs = await db.select({ carId: s.variants.carId, slug: s.variants.slug, name: s.variants.name, fuel: s.variants.fuel, price: s.variants.price }).from(s.variants);
  return rows
    .map((r) => ({
      slug: r.slug,
      brand: r.brand,
      brandName: r.brandName,
      name: r.name,
      engine: r.engine,
      motorKw: r.ev?.motorKw ?? null,
      variants: vs.filter((v) => v.carId === r.carId).map((v) => ({ slug: v.slug, name: v.name, fuel: v.fuel as FuelName, price: v.price })),
    }))
    .filter((c) => c.variants.length && c.variants.some((v) => v.price < 6_000_000));
}

/* ── Remove ─────────────────────────────────────────────────── */

async function findDemo(email: string) {
  const owners = await db
    .select({ id: s.users.id })
    .from(s.users)
    .where(or(eq(s.users.email, email), like(s.users.email, email.replace("@", "+%@"))));
  const vendors = owners.length ? await db.select({ id: s.insVendors.id, reference: s.insVendors.reference }).from(s.insVendors).where(inArray(s.insVendors.ownerUserId, owners.map((o) => o.id))) : [];
  return { owners, vendors };
}

async function removeDemo(email: string) {
  const { owners, vendors } = await findDemo(email);
  if (vendors.length) {
    // Vendor-scoped rows cascade (products, covers, enquiries, quotes, renewals, campaigns, invoices, ad campaigns…).
    await db.update(s.media).set({ insVendorId: null }).where(inArray(s.media.insVendorId, vendors.map((v) => v.id)));
    await db.delete(s.insVendors).where(inArray(s.insVendors.id, vendors.map((v) => v.id)));
  }
  await db.delete(s.insCompanies).where(inArray(s.insCompanies.slug, COMPANIES.map((c) => c.slug)));
  // Demo customers who "made" enquiries.
  await db.delete(s.users).where(like(s.users.email, "demo-customer+%@example.com"));
  if (owners.length) await db.delete(s.users).where(inArray(s.users.id, owners.map((o) => o.id)));
  return vendors.length;
}

/* ── Create ─────────────────────────────────────────────────── */

async function createDemo(email: string, password: string) {
  const hash = await bcrypt.hash(password, 12);
  const throwaway = await bcrypt.hash(`Mg-${randomBytes(24).toString("base64url")}`, 12);

  // Placements (same rows the ad system creates on first use; never overwrites staff edits).
  for (const p of PLACEMENTS) {
    const [exists] = await db.select({ id: s.adPlacements.id }).from(s.adPlacements).where(eq(s.adPlacements.key, p.key));
    if (!exists)
      await db.insert(s.adPlacements).values({
        key: p.key,
        name: p.name,
        description: p.description,
        location: p.location,
        format: p.format,
        desktopSize: p.desktopSize,
        mobileSize: p.mobileSize,
        pricePerDay: p.pricePerDay,
        minDays: p.minDays,
        maxDays: p.maxDays,
        slots: p.slots,
        audience: p.audience,
        sortOrder: p.sortOrder,
      });
  }
  const placements = Object.fromEntries((await db.select().from(s.adPlacements)).map((p) => [p.key, p]));

  // Companies
  const companyId: Record<string, number> = {};
  for (const c of COMPANIES) {
    const [res] = await db.insert(s.insCompanies).values({
      slug: c.slug,
      name: c.name,
      shortName: c.shortName,
      about: c.about,
      website: "https://example.com",
      headquarters: c.hq,
      establishedYear: c.founded,
      garageCount: c.garages,
      garageNote: c.garageNote,
      claimInfo: { settlementRatio: null, year: "", source: "", verified: false, verifiedAt: null, verifiedBy: null, process: c.process },
      supportPhone: "1800 000 0000 (demo)",
      claimsPhone: "1800 000 0001 (demo)",
      claimsEmail: "claims@example.com",
      isActive: c.slug !== "nilgiri-assurance-demo",
    });
    companyId[c.slug] = res.insertId;
  }
  log(`${COMPANIES.length} insurance companies`);

  // Vendors, owners and teams
  const vendorIds: number[] = [];
  const ownerIds: number[] = [];
  const memberIds: number[][] = [];
  for (const v of VENDORS) {
    const vEmail = v.tag ? tagged(email, v.tag) : email;
    const [u] = await db.insert(s.users).values({ name: v.owner, email: vEmail, phone: "9000000000", passwordHash: v.tag ? throwaway : hash, role: "insurer", state: v.state, city: v.city });
    const approvedAt = v.approvedDaysAgo === null ? null : at(v.approvedDaysAgo, 15);
    const [res] = await db.insert(s.insVendors).values({
      reference: v.ref,
      ownerUserId: u.insertId,
      status: v.status,
      application: application(v, vEmail),
      step: 7,
      category: v.category,
      legalName: v.legalName,
      brandName: v.brandName,
      city: v.city,
      state: v.state,
      licenceNumber: `DEMO-${v.ref.slice(-2)}`,
      licenceValidUntil: "2029-03-31",
      profile: {
        logo: "",
        about: `${v.brandName} is sample data for exploring the MarchGear insurance marketplace.`,
        website: "https://example.com",
        supportPhone: "1800 000 0000 (demo)",
        supportEmail: "support@example.com",
        claimsPhone: "1800 000 0001 (demo)",
        claimsEmail: "claims@example.com",
        supportHours: "Mon–Sat, 9:30–18:30",
      },
      plan: v.plan,
      planStatus: approvedAt ? (v.approvedDaysAgo! > 30 ? "active" : "trial") : "trial",
      planRenewsAt: approvedAt ? addDays(istDay(), 12) : null,
      adminRemarks: v.remarks ?? null,
      requiredCorrections: v.corrections ?? null,
      submittedAt: v.submittedDaysAgo === null ? null : at(v.submittedDaysAgo, 10),
      approvedAt,
      createdAt: at((v.submittedDaysAgo ?? 3) + 2, 9),
    });
    const vid = res.insertId;
    vendorIds.push(vid);
    ownerIds.push(u.insertId);
    const [m] = await db.insert(s.insMembers).values({ vendorId: vid, userId: u.insertId, role: "owner" });
    const team = [m.insertId];
    if (v.status === "approved") {
      await db.insert(s.insBranches).values({ vendorId: vid, name: "Head office", address: "Demo Tower, 1 Sample Road", city: v.city, state: v.state, pin: v.pin, phone: "1800000000", isPrimary: true });
      if (!v.tag) {
        await db.insert(s.insBranches).values({ vendorId: vid, name: "Mumbai regional office", address: "Demo Chambers, Sample Lane", city: "Mumbai", state: "Maharashtra", pin: "400001", phone: "1800000002" });
        const staff: [string, string, InsRole][] = [
          ["Rohit Saini", "rohit", "manager"],
          ["Farah Khan", "farah", "executive"],
          ["Jaspreet Kaur", "jaspreet", "marketing"],
        ];
        for (const [name, t, role] of staff) {
          const [su] = await db.insert(s.users).values({ name, email: tagged(email, t), passwordHash: throwaway, role: "insurer", state: v.state, city: v.city });
          const [sm] = await db.insert(s.insMembers).values({ vendorId: vid, userId: su.insertId, role });
          team.push(sm.insertId);
        }
      }
    }
    memberIds.push(team);
    // Approval history
    const history: { action: string; from: string | null; to: string; days: number; side: "vendor" | "admin"; remarks?: string }[] = [];
    if (v.submittedDaysAgo !== null) history.push({ action: "submitted", from: "draft", to: "pending_approval", days: v.submittedDaysAgo, side: "vendor" });
    if (v.status === "approved" && v.approvedDaysAgo !== null) {
      history.push({ action: "under_review", from: "pending_approval", to: "under_review", days: v.approvedDaysAgo + 2, side: "admin" });
      history.push({ action: "approved", from: "under_review", to: "approved", days: v.approvedDaysAgo, side: "admin", remarks: "Welcome to MarchGear. Your company is approved." });
    }
    if (v.status === "changes_requested") history.push({ action: "changes_requested", from: "pending_approval", to: "changes_requested", days: 1, side: "admin", remarks: v.remarks });
    for (const h of history)
      await db.insert(s.insApprovals).values({ vendorId: vid, target: "vendor", targetId: vid, action: h.action, fromStatus: h.from, toStatus: h.to, remarks: h.remarks ?? null, actorUserId: h.side === "vendor" ? u.insertId : null, actorSide: h.side, createdAt: at(h.days, 12) });
    if (v.company) await db.update(s.insCompanies).set({ vendorId: vid }).where(eq(s.insCompanies.id, companyId[v.company]));
  }
  await db.update(s.insCompanies).set({ vendorId: vendorIds[3] }).where(eq(s.insCompanies.id, companyId["nilgiri-assurance-demo"]));
  log(`${VENDORS.length} vendors (3 approved, 1 pending approval, 1 changes requested)`);

  // Covers per approved vendor
  const coverIds: Record<number, Record<string, number>> = {};
  for (let i = 0; i < 3; i++) {
    const vid = vendorIds[i];
    coverIds[vid] = {};
    const factor = [1, 0.9, 1.1][i];
    for (const key of [...COVERAGE_KEYS, ...ADDON_KEYS]) {
      const std = STANDARD_COVER_BY_KEY[key];
      const status: InsCoverStatus = i === 0 && key === "ncb_protect" ? "pending_approval" : "approved";
      const [res] = await db.insert(s.insCovers).values({
        vendorId: vid,
        type: std.type,
        key,
        name: std.name,
        description: std.summary,
        eligibility: std.typicalMaxAge ? `Cars up to ${std.typicalMaxAge} years old` : null,
        maxVehicleAgeYears: std.typicalMaxAge ?? null,
        fuels: std.fuels ?? [],
        exclusions: std.type === "addon" ? ["Claims outside the policy period", "Losses excluded by the main policy"] : [],
        limits: key === "zero_dep" ? "Up to 2 claims per policy year" : null,
        pricing: priceFor(key, factor),
        status,
        submittedAt: at(50, 10),
        createdAt: at(55, 10),
      });
      coverIds[vid][key] = res.insertId;
    }
  }
  log("Coverage items and add-ons (one add-on waiting for approval)");

  // Products
  const productIds: number[] = [];
  const productRows: { id: number; spec: ProductSpec; pricing: ProductPricing }[] = [];
  for (const [n, p] of PRODUCTS.entries()) {
    const vid = vendorIds[p.vendor];
    const terms = CATEGORY_TERMS[p.category];
    const pricing: ProductPricing = { odRatePct: p.odRate, minOdPremium: 1500, idvMinPct: -10, idvMaxPct: 10, odAdjustmentPct: 0, ...terms };
    const eligibility: ProductEligibility = { bodyTypes: [], luxury: "any", brands: [], models: [], fuels: [], minAgeYears: 0, maxAgeYears: 15, states: [], cities: [], ...p.eligibility };
    const coverage = {
      ownDamage: terms.odYears > 0,
      thirdParty: terms.tpYears > 0,
      paOwnerDriver: terms.tpYears > 0 ? ("included" as const) : ("none" as const),
      tpPropertyLimit: terms.tpYears > 0 ? "₹7.5 lakh" : "",
      coverIds: COVERAGE_KEYS.filter((k) => (k === "own_damage" || k === "natural_calamity" || k === "theft" || k === "fire" ? terms.odYears > 0 : terms.tpYears > 0)).map((k) => coverIds[vid][k]),
      highlights: p.highlights,
    };
    const status = p.status;
    const [res] = await db.insert(s.insProducts).values({
      vendorId: vid,
      companyId: companyId[p.company],
      reference: ref("PRD", n + 1),
      code: p.code,
      name: p.name,
      category: p.category,
      tagline: p.tagline,
      description: p.description,
      eligibility,
      coverage,
      addOns: p.addOns.map((a) => ({ coverId: coverIds[vid][a.key], included: a.included })),
      pricing,
      deductibles: { compulsory: p.category === "third_party" ? 0 : 1000, voluntary: p.category === "third_party" ? [] : [2500, 5000, 7500] },
      garageCount: p.garages ?? null,
      exclusions: p.exclusions,
      documents: { brochure: null, wording: null, tieUp: null },
      terms: "Sample terms for demonstration. The insurer's policy wording governs the cover.",
      status,
      submittedAt: status === "draft" ? null : at(45 - n, 11),
      approvedAt: status === "published" ? at(40 - n, 16) : null,
      publishedAt: status === "published" ? at(40 - n, 16) : null,
      createdAt: at(48 - n, 10),
    });
    productIds.push(res.insertId);
    productRows.push({ id: res.insertId, spec: p, pricing });
    if (status !== "draft") {
      await db.insert(s.insApprovals).values({ vendorId: vid, target: "product", targetId: res.insertId, action: "submitted", fromStatus: "draft", toStatus: "pending_approval", actorUserId: ownerIds[p.vendor], actorSide: "vendor", createdAt: at(45 - n, 11) });
      if (status === "published")
        await db.insert(s.insApprovals).values({ vendorId: vid, target: "product", targetId: res.insertId, action: "published", fromStatus: "pending_approval", toStatus: "published", remarks: "Approved and published.", actorUserId: null, actorSide: "admin", createdAt: at(40 - n, 16) });
    }
  }
  log(`${PRODUCTS.length} products (${PRODUCTS.filter((p) => p.status === "published").length} published)`);

  // Promotional campaigns
  const campaigns: { vendor: number; title: string; summary: string; type: InsCampaignType; products: number[]; start: number; end: number; status: InsCampaignStatus }[] = [
    { vendor: 0, title: "Switch to electric with confidence (demo)", summary: "Battery protection and towing to the nearest charger on Aravalli Charge — sample promotion.", type: "ev_promotion", products: [2], start: 10, end: -20, status: "approved" },
    { vendor: 1, title: "Renew before it lapses (demo)", summary: "Keep your no-claim bonus — renew your Konkan Shield policy before expiry. Sample promotion.", type: "renewal_drive", products: [5], start: -5, end: -35, status: "approved" },
    { vendor: 2, title: "New car? Get the 1 + 3 right (demo)", summary: "Compare bundled new-car cover through RoadCover Brokers. Sample promotion.", type: "product_launch", products: [9], start: -2, end: -30, status: "pending_approval" },
  ];
  const campaignIds: number[] = [];
  for (const [n, c] of campaigns.entries()) {
    const vid = vendorIds[c.vendor];
    const [res] = await db.insert(s.insCampaigns).values({
      vendorId: vid,
      reference: ref("CMP", n + 1),
      title: c.title,
      summary: c.summary,
      description: "Sample campaign for exploring the marketplace.",
      type: c.type,
      productIds: c.products.map((i) => productIds[i]),
      banner: c.type === "ev_promotion" ? IMG.chargeStation : null,
      ctaLabel: "Get a quote",
      startsAt: at(c.start, 0),
      endsAt: at(c.end, 23, 59),
      status: c.status,
      submittedAt: at(Math.max(c.start, 0) + 3, 10),
      approvedAt: c.status === "approved" ? at(Math.max(c.start, 0) + 1, 15) : null,
      createdAt: at(Math.max(c.start, 0) + 4, 10),
    });
    campaignIds.push(res.insertId);
    await db.insert(s.insApprovals).values({ vendorId: vid, target: "campaign", targetId: res.insertId, action: "submitted", fromStatus: "draft", toStatus: "pending_approval", actorUserId: ownerIds[c.vendor], actorSide: "vendor", createdAt: at(Math.max(c.start, 0) + 3, 10) });
    if (c.status === "approved")
      await db.insert(s.insApprovals).values({ vendorId: vid, target: "campaign", targetId: res.insertId, action: "approved", fromStatus: "pending_approval", toStatus: "approved", actorUserId: null, actorSide: "admin", createdAt: at(Math.max(c.start, 0) + 1, 15) });
  }
  log(`${campaigns.length} promotional campaigns`);

  // Enquiries, events, quotes, renewals
  const cars = await catalogCars();
  if (!cars.length) throw new Error("The catalogue has no published cars — run npm run db:seed first.");
  const evCars = cars.filter((c) => c.variants.some((v) => v.fuel === "Electric"));
  const iceCars = cars.filter((c) => c.variants.some((v) => v.fuel !== "Electric"));
  const today = istDay();
  let enquiryN = 0;
  let quoteN = 0;
  let renewalN = 0;
  const counts = { enquiries: 0, quotes: 0, renewals: 0 };

  const plan: { vendor: number; count: number }[] = [
    { vendor: 0, count: 34 },
    { vendor: 1, count: 9 },
    { vendor: 2, count: 7 },
  ];
  const STATUS_MIX: InsLeadStatus[] = ["new", "new", "new", "assigned", "contacted", "contacted", "quote_requested", "quote_submitted", "quote_submitted", "follow_up", "interested", "policy_issued", "policy_issued", "lost", "closed"];

  for (const { vendor, count } of plan) {
    const vid = vendorIds[vendor];
    const team = memberIds[vendor];
    const published = productRows.filter((p) => p.spec.vendor === vendor && p.spec.status === "published");
    for (let i = 0; i < count; i++) {
      const product = pick(published);
      const isEv = product.spec.category === "ev";
      const car = pick(isEv && evCars.length ? evCars : iceCars);
      const fitting = car.variants.filter((v) => (isEv ? v.fuel === "Electric" : v.fuel !== "Electric"));
      const variant = fitting.length ? pick(fitting) : car.variants[0];
      const isNewCar = product.spec.category === "new_car" || product.spec.category === "bundled";
      const intent: InsIntent = isNewCar ? "new" : rand() < 0.45 ? "renewal" : "new";
      const year = isNewCar ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - int(1, product.spec.category === "used_car" ? 9 : 6);
      const daysAgo = Math.floor(Math.pow(rand(), 1.6) * 175);
      const status: InsLeadStatus = daysAgo < 2 ? "new" : pick(STATUS_MIX);
      const [city, state] = pick(PLACES);
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      const policy: InsPolicyStatus = isNewCar ? "new_vehicle" : intent === "renewal" ? (rand() < 0.8 ? "active" : "expired_recent") : rand() < 0.5 ? "active" : "expired_recent";
      const expiry = policy === "new_vehicle" ? null : addDays(today, intent === "renewal" ? int(-10, 50) : int(-20, 120));
      const ncb = policy === "active" ? pick([0, 20, 25, 35, 45, 50]) : 0;
      const ageMonths = vehicleAgeMonths(year, isNewCar, today);
      const addOnCovers = product.spec.addOns.map((a) => ({ key: a.key, included: a.included, selected: !a.included && rand() < 0.4 }));
      const estimate = estimatePremium({
        exShowroom: variant.price,
        ageMonths,
        isNew: isNewCar,
        fuel: variant.fuel,
        engineCc: parseEngineCc(car.engine),
        motorKw: car.motorKw,
        ncbPct: ncb,
        pricing: product.pricing,
        paOwnerDriver: product.pricing.tpYears > 0 ? "included" : "none",
        includePa: true,
        addOns: addOnCovers.map((a) => ({ coverId: coverIds[vid][a.key], key: a.key, name: STANDARD_COVER_BY_KEY[a.key].name, pricing: priceFor(a.key, [1, 0.9, 1.1][vendor]), included: a.included, selected: a.selected })),
        config: DEFAULT_PRICING_CONFIG,
      });
      const created = at(daysAgo, int(9, 21), int(0, 59));
      const assigned = status === "new" ? null : pick(team);
      const reg = isNewCar ? null : `${pick(["RJ14", "MH12", "MH01", "KA03", "TS09", "TN10", "DL3C", "GJ01", "KL07", "AP31"])}${String.fromCharCode(65 + int(0, 25))}${String.fromCharCode(65 + int(0, 25))}${String(int(1000, 9999))}`;
      const issued = status === "policy_issued";
      const [res] = await db.insert(s.insEnquiries).values({
        reference: ref("ENQ", ++enquiryN),
        vendorId: vid,
        productId: product.id,
        companyId: companyId[product.spec.company],
        intent,
        name,
        mobile: `90000${String(10000 + enquiryN).slice(-5)}`,
        email: `demo-lead${enquiryN}@example.com`,
        regNumber: reg,
        vehicleIsNew: isNewCar,
        brand: car.brand,
        brandName: car.brandName,
        model: car.slug,
        modelName: car.name,
        variant: variant.slug,
        variantName: variant.name,
        year,
        fuel: variant.fuel,
        city,
        state,
        policyStatus: policy,
        policyExpiry: expiry,
        previousInsurer: policy === "new_vehicle" ? null : "Another insurer",
        ncbPct: ncb,
        claimedLastYear: false,
        addOns: addOnCovers.filter((a) => a.selected || a.included).map((a) => a.key),
        idv: estimate.idv || null,
        indicativePremium: estimate.total,
        estimate,
        status,
        assignedMemberId: assigned,
        followUpAt: ["follow_up", "contacted", "interested"].includes(status) ? at(-int(0, 4), 11) : null,
        source: pick(["quotes", "quotes", "compare", "product", "provider", "renewal", "new_car"]),
        campaignId: vendor === 0 && isEv && rand() < 0.5 ? campaignIds[0] : null,
        consentAt: created,
        policyIssuedAt: issued ? at(Math.max(0, daysAgo - 6), 14) : null,
        policyNumber: issued ? `DEMO/${vendor + 1}/${100000 + enquiryN}` : null,
        policyPremium: issued ? Math.round(estimate.total * (0.95 + rand() * 0.1)) : null,
        conversionVerifiedAt: issued && rand() < 0.5 ? at(Math.max(0, daysAgo - 8), 12) : null,
        lostReason: status === "lost" ? pick(["Chose another insurer", "Price too high", "Not reachable"]) : null,
        createdAt: created,
      });
      const eid = res.insertId;
      counts.enquiries++;
      const events: { kind: InsLeadEventKind; body: string; days: number }[] = [{ kind: "created", body: "Quote request from the MarchGear website", days: daysAgo }];
      if (assigned) events.push({ kind: "assign", body: "Assigned to a team member", days: Math.max(0, daysAgo - 0.1) });
      if (!["new", "assigned"].includes(status)) events.push({ kind: "call", body: "Called the customer to confirm vehicle details", days: Math.max(0, daysAgo - 1) });
      if (status === "follow_up") events.push({ kind: "reminder", body: "Customer asked to call back with a final price", days: Math.max(0, daysAgo - 2) });
      if (status === "lost") events.push({ kind: "status", body: "Marked lost", days: Math.max(0, daysAgo - 4) });
      for (const e of events) await db.insert(s.insEnquiryEvents).values({ enquiryId: eid, vendorId: vid, kind: e.kind, body: e.body, createdAt: at(e.days, 12, int(0, 59)) });

      // Quotes
      if (["quote_submitted", "interested", "policy_issued", "follow_up"].includes(status) || (status === "quote_requested" && rand() < 0.5)) {
        const qStatus: InsQuoteStatus = status === "quote_requested" ? "draft" : status === "interested" || status === "policy_issued" ? "accepted" : status === "follow_up" && rand() < 0.3 ? "declined" : "submitted";
        const auth: InsQuoteAuthorization = vendor !== 2 && rand() < 0.35 ? "insurer_authorised" : "indicative";
        const breakdown: QuoteBreakdown = { ...estimate, adjustment: 0, deductible: 1000 };
        const submitted = qStatus === "draft" ? null : at(Math.max(0, daysAgo - 2), 15);
        await db.insert(s.insQuotes).values({
          reference: ref("QTE", ++quoteN),
          vendorId: vid,
          enquiryId: eid,
          productId: product.id,
          status: qStatus,
          authorization: auth,
          insurerQuoteRef: auth === "insurer_authorised" ? `DEMO-Q-${200000 + quoteN}` : null,
          idv: estimate.idv,
          coverage: [
            ...(estimate.odYears ? [{ name: "Own damage", detail: `${estimate.odYears} year${estimate.odYears > 1 ? "s" : ""}` }] : []),
            ...(estimate.tpYears ? [{ name: "Third-party liability", detail: `${estimate.tpYears} year${estimate.tpYears > 1 ? "s" : ""}` }] : []),
          ],
          breakdown,
          total: breakdown.total,
          validUntil: addDays(istDay(-Math.max(0, daysAgo - 2)), 15),
          notes: "Sample quotation for demonstration.",
          terms: "Subject to the insurer's policy wording and inspection where required.",
          shareToken: randomBytes(24).toString("base64url"),
          viewedAt: qStatus !== "draft" && rand() < 0.7 ? at(Math.max(0, daysAgo - 3), 19) : null,
          submittedAt: submitted,
          respondedAt: qStatus === "accepted" || qStatus === "declined" ? at(Math.max(0, daysAgo - 3), 20) : null,
          createdAt: at(Math.max(0, daysAgo - 2), 14),
        });
        counts.quotes++;
        if (submitted) await db.insert(s.insEnquiryEvents).values({ enquiryId: eid, vendorId: vid, kind: "quote", body: "Quotation sent to the customer", createdAt: submitted });
      }

      // Renewals
      if (intent === "renewal" && expiry) {
        const rStatus: InsRenewalStatus = status === "policy_issued" ? "renewed" : status === "lost" ? "lost" : expiry < today ? "lapsed" : pick(["upcoming", "upcoming", "contacted", "quote_sent", "follow_up"] as const);
        await db.insert(s.insRenewals).values({
          reference: ref("REN", ++renewalN),
          vendorId: vid,
          enquiryId: eid,
          name,
          mobile: `90000${String(10000 + enquiryN).slice(-5)}`,
          email: `demo-lead${enquiryN}@example.com`,
          regNumber: reg,
          brandName: car.brandName,
          modelName: car.name,
          variantName: variant.name,
          year,
          fuel: variant.fuel,
          city,
          currentInsurer: "Another insurer",
          policyType: "comprehensive",
          expiryDate: expiry,
          ncbPct: ncb,
          status: rStatus,
          assignedMemberId: assigned,
          followUpAt: rStatus === "follow_up" ? at(-int(0, 3), 11) : null,
          renewedAt: rStatus === "renewed" ? at(Math.max(0, daysAgo - 6), 14) : null,
          source: "enquiry",
          createdAt: created,
        });
        counts.renewals++;
      }
    }
  }
  // A few renewals the main vendor added from its own book.
  for (let i = 0; i < 6; i++) {
    const car = pick(iceCars);
    const variant = car.variants[0];
    const [city] = pick(PLACES);
    await db.insert(s.insRenewals).values({
      reference: ref("REN", ++renewalN),
      vendorId: vendorIds[0],
      name: `${pick(FIRST)} ${pick(LAST)}`,
      mobile: `90001${String(10000 + i).slice(-5)}`,
      regNumber: `RJ14${String.fromCharCode(65 + i)}C${String(int(1000, 9999))}`,
      brandName: car.brandName,
      modelName: car.name,
      variantName: variant.name,
      year: Number(today.slice(0, 4)) - int(1, 5),
      fuel: variant.fuel,
      city,
      currentInsurer: "Aravalli General (demo)",
      policyNumber: `DEMO/1/${300000 + i}`,
      policyType: "comprehensive",
      expiryDate: addDays(today, [3, 9, 14, 21, 33, -4][i]),
      ncbPct: [20, 25, 35, 0, 45, 20][i],
      premium: int(9000, 26000),
      status: i === 5 ? "follow_up" : "upcoming",
      assignedMemberId: memberIds[0][1 + (i % 2)],
      followUpAt: i === 5 ? at(1, 11) : null,
      source: "manual",
      createdAt: at(int(10, 40), 11),
    });
    counts.renewals++;
  }
  log(`${counts.enquiries} enquiries, ${counts.quotes} quotes, ${counts.renewals} renewals`);

  // Analytics events (last 90 days)
  const eventRows: (typeof s.insEvents.$inferInsert)[] = [];
  for (const p of productRows.filter((r) => r.spec.status === "published")) {
    const vid = vendorIds[p.spec.vendor];
    for (let d = 0; d < 90; d++) {
      const views = Math.max(0, Math.round((p.spec.vendor === 0 ? 9 : 4) * (0.5 + rand()) * (1 - d / 160)));
      for (let k = 0; k < views; k++) eventRows.push({ vendorId: vid, kind: "product_view", refId: p.id, createdAt: at(d, int(8, 22), int(0, 59)) });
      if (rand() < 0.6) eventRows.push({ vendorId: vid, kind: "quote_listing", refId: p.id, createdAt: at(d, int(8, 22)) });
    }
  }
  for (const [i, cid] of campaignIds.slice(0, 1).entries()) {
    for (let d = 0; d < 10; d++) {
      for (let k = 0; k < int(8, 20); k++) eventRows.push({ vendorId: vendorIds[i], kind: "campaign_view", refId: cid, createdAt: at(d, int(8, 22)) });
      for (let k = 0; k < int(0, 4); k++) eventRows.push({ vendorId: vendorIds[i], kind: "campaign_click", refId: cid, createdAt: at(d, int(8, 22)) });
    }
  }
  for (let i = 0; i < eventRows.length; i += 500) await db.insert(s.insEvents).values(eventRows.slice(i, i + 500));
  log(`${eventRows.length} analytics events`);

  // Billing: subscription invoices + an ad booking, numbered in their own demo series
  const mainVid = vendorIds[0];
  const invoices: { kind: "subscription" | "advertising"; desc: string; start: string; end: string; amount: number; status: "paid" | "verifying" | "due"; dueOffset: number; ad?: boolean }[] = [
    { kind: "subscription", desc: "Professional plan — monthly subscription", start: addDays(today, -130), end: addDays(today, -101), amount: 14999, status: "paid", dueOffset: -116 },
    { kind: "subscription", desc: "Professional plan — monthly subscription", start: addDays(today, -100), end: addDays(today, -71), amount: 14999, status: "paid", dueOffset: -86 },
    { kind: "subscription", desc: "Professional plan — monthly subscription", start: addDays(today, -70), end: addDays(today, -41), amount: 14999, status: "paid", dueOffset: -56 },
    { kind: "subscription", desc: "Professional plan — monthly subscription", start: addDays(today, -40), end: addDays(today, -11), amount: 14999, status: "verifying", dueOffset: -26 },
    { kind: "subscription", desc: "Professional plan — monthly subscription", start: addDays(today, -10), end: addDays(today, 19), amount: 14999, status: "due", dueOffset: 5 },
    { kind: "advertising", desc: "Sponsored insurance listing — 28 days", start: addDays(today, -3), end: addDays(today, 24), amount: 28 * (placements.insurance_sponsored_listing?.pricePerDay ?? 1500), status: "paid", dueOffset: -3, ad: true },
  ];
  let invN = 0;
  const adInvoice: { id?: number } = {};
  for (const inv of invoices) {
    const gst = Math.round(inv.amount * 0.18);
    const [res] = await db.insert(s.insInvoices).values({
      vendorId: mainVid,
      number: `MGI/DEMO/${String(++invN).padStart(5, "0")}`,
      kind: inv.kind,
      description: `${inv.desc} (demo)`,
      plan: inv.kind === "subscription" ? "professional" : null,
      periodStart: inv.start,
      periodEnd: inv.end,
      amount: inv.amount,
      gst,
      total: inv.amount + gst,
      status: inv.status,
      dueOn: addDays(today, inv.dueOffset),
      paidAt: inv.status === "paid" ? at(-inv.dueOffset - 2, 12) : null,
      createdAt: at(-inv.dueOffset + 15, 10),
    });
    if (inv.ad) adInvoice.id = res.insertId;
    if (inv.status !== "due")
      await db.insert(s.insPayments).values({
        vendorId: mainVid,
        invoiceId: res.insertId,
        amount: inv.amount + gst,
        method: inv.status === "paid" && invN % 2 ? "upi" : "bank_transfer",
        utr: `DEMOUTR${100000 + invN}`,
        paidOn: addDays(today, inv.dueOffset - 2),
        status: inv.status === "paid" ? "verified" : "submitted",
        verifiedAt: inv.status === "paid" ? at(-inv.dueOffset - 2, 12) : null,
        createdAt: at(-inv.dueOffset - 1, 18),
      });
  }
  log(`${invoices.length} invoices (MGI/DEMO series) with payments`);

  // Advertising: a live sponsored listing and a live banner for the main vendor
  const evProductId = productIds[2];
  const sponsored = placements.insurance_sponsored_listing;
  const banner = placements.insurance_home_banner;
  if (sponsored && banner) {
    const startsOn = addDays(today, -3);
    const sAmount = 28 * sponsored.pricePerDay;
    const [sc] = await db.insert(s.adCampaigns).values({
      reference: ref("ADS", 1),
      placementId: sponsored.id,
      insVendorId: mainVid,
      name: "Aravalli Charge — sponsored listing (demo)",
      productId: evProductId,
      startsOn,
      endsOn: addDays(startsOn, 27),
      days: 28,
      pricePerDay: sponsored.pricePerDay,
      amount: sAmount,
      gst: Math.round(sAmount * 0.18),
      total: sAmount + Math.round(sAmount * 0.18),
      status: "approved",
      submittedAt: at(8, 11),
      approvedAt: at(6, 15),
      createdAt: at(9, 11),
    });
    if (adInvoice.id) await db.update(s.insInvoices).set({ adCampaignId: sc.insertId }).where(eq(s.insInvoices.id, adInvoice.id));
    const bAmount = 21 * banner.pricePerDay;
    const [bc] = await db.insert(s.adCampaigns).values({
      reference: ref("ADS", 2),
      placementId: banner.id,
      insVendorId: mainVid,
      name: "Aravalli Charge — insurance homepage banner (demo)",
      targetUrl: "/insurance/products/" + ref("PRD", 3),
      startsOn: addDays(today, -1),
      endsOn: addDays(today, 19),
      days: 21,
      pricePerDay: banner.pricePerDay,
      amount: bAmount,
      gst: Math.round(bAmount * 0.18),
      total: bAmount + Math.round(bAmount * 0.18),
      status: "pending_approval",
      submittedAt: at(1, 11),
      createdAt: at(1, 10),
    });
    await db.insert(s.adCreatives).values({
      campaignId: bc.insertId,
      name: "EV banner (demo)",
      desktopImage: IMG.heroEvDusk,
      mobileImage: IMG.chargePlug,
      headline: "Insure your EV the smart way (demo)",
      body: "Battery protection and towing to the nearest charger — sample advertisement.",
      ctaLabel: "See the plan",
      alt: "An electric car charging at dusk",
      status: "pending",
    });
    for (let d = 0; d <= 3; d++)
      await db.insert(s.adStats).values({ campaignId: sc.insertId, day: addDays(today, -d), impressions: int(180, 420), clicks: int(4, 18), enquiries: int(0, 3) });
    for (const [cid, side, action] of [
      [sc.insertId, "vendor", "submitted"],
      [sc.insertId, "admin", "approved"],
      [bc.insertId, "vendor", "submitted"],
    ] as const)
      await db.insert(s.insApprovals).values({ vendorId: mainVid, target: "ad_campaign", targetId: cid, action, fromStatus: action === "approved" ? "pending_approval" : "draft", toStatus: action === "approved" ? "approved" : "pending_approval", actorSide: side, actorUserId: side === "vendor" ? ownerIds[0] : null, createdAt: at(action === "approved" ? 6 : 8, 12) });
    log("2 ad campaigns (a live sponsored listing; a banner waiting for approval)");
  }

  // Notifications and a support ticket for the main vendor
  const [latestEnquiry] = await db.select({ id: s.insEnquiries.id }).from(s.insEnquiries).where(eq(s.insEnquiries.vendorId, mainVid)).orderBy(desc(s.insEnquiries.createdAt)).limit(1);
  const [sponsoredAd] = await db.select({ id: s.adCampaigns.id }).from(s.adCampaigns).where(eq(s.adCampaigns.reference, ref("ADS", 1)));
  const [dueInvoice] = await db.select({ id: s.insInvoices.id }).from(s.insInvoices).where(and(eq(s.insInvoices.vendorId, mainVid), eq(s.insInvoices.status, "due")));
  const v = "/insurance-vendor";
  const notes: [string, string, string, number, boolean, string][] = [
    ["enquiry", "New quote request", "A customer asked for a quote on Aravalli Drive Comprehensive (demo).", 0, false, latestEnquiry ? `${v}/enquiries/${latestEnquiry.id}` : `${v}/enquiries`],
    ["campaign", "Campaign approved", "“Switch to electric with confidence (demo)” is approved.", 9, true, `${v}/campaigns/${campaignIds[0]}`],
    ["advertising", "Ad campaign approved", "Your sponsored listing is live.", 6, true, sponsoredAd ? `${v}/advertising/${sponsoredAd.id}` : `${v}/advertising`],
    ["billing", "Invoice due", "Your Professional plan invoice is due in 5 days.", 1, false, dueInvoice ? `${v}/invoices/${dueInvoice.id}` : `${v}/invoices`],
  ];
  for (const [kind, title, body, days, read, href] of notes)
    await db.insert(s.insNotifications).values({ vendorId: mainVid, kind, title, body, href, readAt: read ? at(days, 18) : null, createdAt: at(days, 10) });
  const [t] = await db.insert(s.insTickets).values({ vendorId: mainVid, reference: ref("ITK", 1), subject: "How do I add a second underwriting document? (demo)", category: "products", status: "awaiting_dealer", createdBy: ownerIds[0], createdAt: at(4, 11) });
  await db.insert(s.insTicketMessages).values([
    { ticketId: t.insertId, userId: ownerIds[0], body: "We'd like to upload a revised policy wording for our EV product. Where do we do that?", attachments: [], createdAt: at(4, 11) },
    { ticketId: t.insertId, fromStaff: true, body: "Open the product, go to Documents and upload the new wording. The product will go back for a quick review.", attachments: [], createdAt: at(3, 15) },
  ]);
  log("Notifications and a support ticket");

  return { reference: VENDORS[0].ref, vendorId: mainVid };
}

/* ── Main ───────────────────────────────────────────────────── */

async function main() {
  if (RESET && REMOVE) throw new Error("Use either --reset or --remove, not both.");
  const creds = credentials();
  const existing = await findDemo(creds.email);

  if (REMOVE) {
    const n = await removeDemo(creds.email);
    console.log(n ? `Removed ${n} demo insurance vendors, their data and the demo companies.` : "No demo insurance vendors found. Nothing to remove.");
    return;
  }
  if (existing.vendors.length && !RESET) {
    console.log(`The demo insurers already exist (${existing.vendors.map((v) => v.reference).join(", ")}).`);
    console.log("Nothing changed. Run with -- --reset to recreate them, or -- --remove to delete them.");
    return;
  }
  if (existing.vendors.length || existing.owners.length) {
    console.log("Removing the existing demo insurers…");
    await removeDemo(creds.email);
  }
  const taken = await db.select({ id: s.users.id, role: s.users.role }).from(s.users).where(eq(s.users.email, creds.email));
  if (taken.length) throw new Error(`${creds.email} is already used by another account — set DEMO_INSURER_EMAIL to a different address.`);
  console.log("Creating the demo insurance marketplace…");
  const r = await createDemo(creds.email, creds.password);
  console.log(`\n✓ Done. Main demo vendor: Aravalli General (demo), ${r.reference}.`);
  console.log(`  Sign in at /insurance-vendor/login as ${creds.email}`);
  console.log(`  Password: ${creds.generated ? "generated and saved to .env.local as DEMO_INSURER_PASSWORD" : "DEMO_INSURER_PASSWORD from .env.local"}`);
  console.log("  Public pages: /insurance, /insurance/providers, /insurance/quotes");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
