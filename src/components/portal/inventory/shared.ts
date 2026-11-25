import type { PartnerVehicleStatus } from "@/db/enums";
import type { FileRef, NewVehicleDetails, UsedConditionGrade, UsedVehicleDetails, VehicleDetails } from "@/partner/types";
import type { CarModel, Variant } from "@/types";

/* ──────────────────────────────────────────────────────────────
   Vehicle inventory — shapes, options and rules shared by the
   dealer-portal UI, the Server Actions and the public views.
   Client-safe.

   The catalogue rule: cars come from MarchGear's catalogue, which
   only MarchGear staff maintain in /admin. A dealer picks brand →
   model → variant from it and adds what is theirs: colour, price,
   availability, showroom (and, for a pre-owned car, that car's own
   facts and photos). Names, body type, fuel, gearbox, ex-showroom
   price, specifications, features and new-car photos always come
   from the catalogue — never from the dealer.
   ────────────────────────────────────────────────────────────── */

export const INSURANCE_OPTIONS = [
  { value: "comprehensive", label: "Comprehensive" },
  { value: "third_party", label: "Third party" },
  { value: "expired", label: "Expired" },
  { value: "none", label: "Not insured" },
] as const;
export type InsuranceStatus = (typeof INSURANCE_OPTIONS)[number]["value"];

export const CONDITION_GRADES: { value: UsedConditionGrade; label: string; hint: string }[] = [
  { value: "excellent", label: "Excellent", hint: "Like new — no visible wear, no pending work" },
  { value: "very_good", label: "Very good", hint: "Light signs of use, nothing that needs fixing" },
  { value: "good", label: "Good", hint: "Normal wear for its age and kilometres" },
  { value: "fair", label: "Fair", hint: "Needs some work — say what in the notes" },
];
export const conditionLabel = (g: string | null | undefined) => CONDITION_GRADES.find((c) => c.value === g)?.label ?? "";

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export const MAX_IMAGES = 20;
export const MIN_YEAR = 1990;
export const MAX_CONDITION_NOTES = 500;
export const MIN_CONDITION_NOTES = 20;
export const MAX_WAITING_WEEKS = 52;
/** Calendar year in India right now. */
export const currentYear = () => new Date(Date.now() + 5.5 * 3_600_000).getUTCFullYear();

/**
 * A new car's selling price must sit between these shares of the catalogue ex-showroom price.
 * Generous on purpose: it catches typos (a missing or extra zero), not dealer discounts or premiums.
 */
export const PRICE_BAND = { min: 0.5, max: 2 } as const;
export const priceBand = (exShowroom: number) => ({ min: Math.ceil(exShowroom * PRICE_BAND.min), max: Math.floor(exShowroom * PRICE_BAND.max) });

/** The dealer's private stock number or VIN: letters, digits, "-" and "/" (stored upper-case, never shown publicly). */
export const STOCK_NO_PATTERN = /^[A-Z0-9][A-Z0-9/-]{1,31}$/;
export const normaliseStockNo = (v: string) => v.trim().toUpperCase().replace(/\s+/g, "");
/** "KA 01 AB 1234", "DL3CAB1234" or a Bharat-series "22 BH 1234 AA" — compared without spaces or dashes. */
export const REG_PATTERN = /^(?:[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}|\d{2}BH\d{4}[A-Z]{1,2})$/;
export const normaliseReg = (v: string) => v.toUpperCase().replace(/[\s.-]+/g, "");

/* ── Catalogue helpers (work with the server catalogue and useCatalog() alike) ── */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** The catalogue variant a listing refers to: by slug first, then by name (rows saved before slugs were kept). */
export function findVariant(car: Pick<CarModel, "variants"> | undefined, slug: string | null | undefined, name?: string | null): Variant | undefined {
  if (!car) return undefined;
  if (slug) {
    const bySlug = car.variants.find((v) => v.slug === slug);
    if (bySlug) return bySlug;
  }
  if (!name) return undefined;
  const key = norm(name.includes("/") ? name.split("/").pop()! : name);
  return car.variants.find((v) => norm(v.name) === key || norm(v.slug) === key);
}

/** Specification rows for a catalogue model and variant — what every listing of it shows. */
export function catalogueSpecs(car: CarModel, variant?: Variant): { label: string; value: string }[] {
  const d = car.dimensions;
  const rows: [string, string | number | undefined | null][] = [
    ["Engine", car.engine],
    ["Power", car.power],
    ["Torque", car.torque],
    [car.ev ? "Range" : "Mileage", variant?.efficiency || car.efficiency],
    ["Seating", car.seats.length ? `${car.seats.join(" / ")} seats` : ""],
    ["Airbags", car.airbags ? String(car.airbags) : ""],
    ["Safety rating", car.safetyAgency !== "Not tested" ? `${car.safetyRating}-star ${car.safetyAgency}` : ""],
    ["Boot space", car.bootSpace ? `${car.bootSpace} litres` : ""],
    ["Ground clearance", car.groundClearance ? `${car.groundClearance} mm` : ""],
    ["Fuel tank", car.fuelTank ? `${car.fuelTank} litres` : ""],
    ["Length × width × height", d?.length ? `${d.length} × ${d.width} × ${d.height} mm` : ""],
    ["Wheelbase", d?.wheelbase ? `${d.wheelbase} mm` : ""],
    ["0–100 km/h", car.acceleration],
    ["Top speed", car.topSpeed ? `${car.topSpeed} km/h` : ""],
    ...(car.ev
      ? ([
          ["Battery", `${car.ev.batteryKwh} kWh`],
          ["DC fast charging", car.ev.dcCharge],
          ["AC charging", car.ev.acCharge],
        ] as [string, string][])
      : []),
  ];
  return rows.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "").map(([label, value]) => ({ label, value: String(value) }));
}

/** The variant's equipment list, or the model's highlights when the variant has none. */
export const catalogueFeatures = (car: CarModel, variant?: Variant) => (variant?.features.length ? [...variant.features] : car.highlights.slice(0, 10));

/* ── Stored details ─────────────────────────────────────────── */

export const isNewDetails = (d: VehicleDetails | null | undefined): d is NewVehicleDetails => Boolean(d && "availability" in d);
export const isUsedDetails = (d: VehicleDetails | null | undefined): d is UsedVehicleDetails => Boolean(d && "registrationYear" in d);
/** A new car's availability; rows saved before availability existed are in stock. */
export const newDetailsOf = (d: VehicleDetails | null | undefined): NewVehicleDetails => (isNewDetails(d) ? d : { variantSlug: "", availability: "in_stock", waitingWeeks: null });

export const waitingLabel = (weeks: number | null | undefined) => (weeks ? `about ${weeks} week${weeks === 1 ? "" : "s"}` : "waiting period on request");

/* ── Workflow ───────────────────────────────────────────────── */

/** Used cars: the dealer may send these for approval (again). */
export const SUBMITTABLE: PartnerVehicleStatus[] = ["draft", "changes_requested", "rejected", "unpublished"];
/** Used cars: the dealer may pull these back to draft. */
export const WITHDRAWABLE: PartnerVehicleStatus[] = ["pending_approval", "approved", "published"];
/** Used cars, approved or live: any edit sends the listing back for approval and takes it off the website. */
export const LIVE: PartnerVehicleStatus[] = ["approved", "published"];
/** New cars: the dealer may publish these straight away (the old review statuses included). */
export const PUBLISHABLE: PartnerVehicleStatus[] = ["draft", "unpublished", "changes_requested", "rejected", "pending_approval", "approved"];
/** MarchGear left a message the dealer must read. */
export const NEEDS_ATTENTION: PartnerVehicleStatus[] = ["changes_requested", "rejected"];

export const SORTS = [
  { value: "updated", label: "Last updated" },
  { value: "price", label: "Price" },
  { value: "stock", label: "Stock" },
  { value: "views", label: "Views" },
  { value: "enquiries", label: "Enquiries" },
] as const;
export type InventorySort = (typeof SORTS)[number]["value"];
export type InventoryTab = "all" | "new" | "used";

/** Where "Can't find a model?" sends the dealer: a support ticket in the catalogue category, prefilled. */
export const REQUEST_MODEL_HREF = "/dealer/support?new=catalogue";

/* ── Form ───────────────────────────────────────────────────── */

export interface UsedFormValue {
  registrationYear: string;
  km: string;
  owners: string;
  registrationNumber: string;
  registrationState: string;
  accident: "" | "yes" | "no";
  accidentDetails: string;
  insuranceStatus: "" | InsuranceStatus;
  insuranceValidUntil: string;
  inspection: FileRef | null;
  condition: "" | UsedConditionGrade;
  /** Short condition notes, shown to buyers (max MAX_CONDITION_NOTES). */
  conditionNotes: string;
}

/**
 * What the add/edit form holds and sends. Numbers stay strings until the server parses them.
 * There is deliberately no model name, specification, feature, description or (new-car) photo here.
 */
export interface VehicleFormValue {
  kind: "new" | "used";
  brand: string;
  /** Catalogue model slug. */
  modelSlug: string;
  /** Catalogue variant slug. */
  variantSlug: string;
  /** Used: manufacturing year. New cars take the model year automatically. */
  year: string;
  colour: string;
  sellingPrice: string;
  /** New cars. */
  availability: "in_stock" | "on_order";
  /** New: units in stock. Used: "1" available, "0" sold. */
  stock: string;
  /** New cars on order. */
  waitingWeeks: string;
  /** Private stock number or VIN. */
  vin: string;
  showroomId: string;
  /** Photos of this actual car — used cars only. */
  images: string[];
  used: UsedFormValue;
}

export const emptyUsed = (): UsedFormValue => ({
  registrationYear: "",
  km: "",
  owners: "",
  registrationNumber: "",
  registrationState: "",
  accident: "",
  accidentDetails: "",
  insuranceStatus: "",
  insuranceValidUntil: "",
  inspection: null,
  condition: "",
  conditionNotes: "",
});

export const emptyVehicle = (kind: "new" | "used" = "new"): VehicleFormValue => ({
  kind,
  brand: "",
  modelSlug: "",
  variantSlug: "",
  year: "",
  colour: "",
  sellingPrice: "",
  availability: "in_stock",
  stock: "1",
  waitingWeeks: "",
  vin: "",
  showroomId: "",
  images: [],
  used: emptyUsed(),
});

/* ── Read models ────────────────────────────────────────────── */

export interface VehicleListRow {
  id: number;
  reference: string;
  kind: "new" | "used";
  brand: string;
  brandName: string;
  model: string;
  variant: string;
  year: number;
  colour: string;
  fuel: string;
  transmission: string;
  sellingPrice: number;
  exShowroom: number | null;
  stock: number;
  /** New cars. */
  availability: "in_stock" | "on_order";
  waitingWeeks: number | null;
  status: PartnerVehicleStatus;
  adminRemarks: string | null;
  /** The model (or variant) is no longer in the catalogue — the dealer must pick it again; hidden from the website meanwhile. */
  needsCatalogue: boolean;
  views: number;
  enquiries: number;
  image: string | null;
  showroom: string | null;
  /** Where the public can see it right now, when it's live. */
  publicHref: string | null;
  /** ISO timestamps. */
  updatedAt: string;
  submittedAt: string | null;
}

export interface VehicleHistoryEntry {
  id: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  remarks: string | null;
  actorSide: "dealer" | "admin" | "system";
  actorName: string | null;
  createdAt: string;
}

/**
 * A dealer vehicle as the public sees it (dealer page, model page, the portal's preview). No private fields.
 * New cars carry catalogue names, photos, specs and features; used cars their own photos with catalogue specs.
 */
export interface PublicVehicle {
  id: number;
  partnerId: number;
  reference: string;
  kind: "new" | "used";
  brand: string;
  modelSlug: string | null;
  model: string;
  variant: string;
  year: number;
  bodyType: string;
  fuel: string;
  transmission: string;
  colour: string;
  colourHex: string | null;
  exShowroom: number | null;
  sellingPrice: number;
  stock: number;
  availability: "in_stock" | "on_order";
  waitingWeeks: number | null;
  /** New: the catalogue's model overview. Used: the dealer's condition notes. */
  description: string;
  specs: { label: string; value: string }[];
  features: string[];
  images: string[];
  showroom: { name: string; city: string; address: string } | null;
  dealer: { id: string | null; name: string; city: string; area: string };
  used: {
    registrationYear: number | null;
    km: number | null;
    owners: number | null;
    registrationState: string;
    accident: { hadAccident: boolean; details: string };
    insurance: { status: string; validUntil: string };
    hasInspection: boolean;
    condition: string;
  } | null;
}

export const vehicleTitle = (v: { year?: number | string | null; brandName: string; model: string }) =>
  [v.year && Number(v.year) > 0 ? v.year : null, v.brandName, v.model].filter(Boolean).join(" ") || "Untitled vehicle";

/** "Submitted", "Changes requested"… for a history action. */
export function historyLabel(action: string) {
  const map: Record<string, string> = {
    submitted: "Submitted for approval",
    resubmitted: "Resubmitted for approval",
    withdrawn: "Withdrawn to draft",
    edited: "Edited after approval",
    archived: "Archived",
    restored: "Restored from archive",
    approved: "Approved",
    approved_published: "Approved and published",
    published: "Published",
    paused: "Paused",
    unpublished: "Unpublished by MarchGear",
    rejected: "Rejected",
    changes_requested: "Changes requested",
  };
  return map[action] ?? action.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/* ── Converters ─────────────────────────────────────────────── */

/** The stored columns the form needs (a partner_vehicles row satisfies it). */
export interface StoredVehicle {
  kind: "new" | "used";
  brand: string;
  modelSlug: string | null;
  variant: string;
  year: number;
  colour: string;
  sellingPrice: number;
  stock: number;
  vin: string | null;
  description: string;
  images: string[];
  showroomId: number | null;
  used: VehicleDetails | null;
  /** Never submitted → an unanswered accident question stays unanswered (it's stored as a boolean). */
  submittedAt: Date | string | null;
}

const n = (v: number | null | undefined) => (v === null || v === undefined || v <= 0 ? "" : String(v));

/**
 * The stored listing as the form edits it. `car` is the catalogue model (when it still exists), used to resolve
 * the variant of rows that only stored its name.
 */
export function vehicleToForm(v: StoredVehicle, car?: CarModel): VehicleFormValue {
  const u = isUsedDetails(v.used) ? v.used : null;
  const nd = newDetailsOf(v.used);
  const variant = findVariant(car, v.kind === "new" ? nd.variantSlug : u?.variantSlug, v.variant);
  const insurance = INSURANCE_OPTIONS.some((o) => o.value === u?.insurance.status) ? (u!.insurance.status as InsuranceStatus) : "";
  return {
    kind: v.kind,
    brand: v.brand,
    modelSlug: car ? car.slug : "",
    variantSlug: variant?.slug ?? "",
    year: v.kind === "used" ? n(v.year) : "",
    colour: v.colour,
    sellingPrice: n(v.sellingPrice),
    availability: v.kind === "new" ? nd.availability : "in_stock",
    stock: v.kind === "new" && nd.availability === "on_order" ? "1" : String(Math.max(0, v.stock)),
    waitingWeeks: nd.waitingWeeks ? String(nd.waitingWeeks) : "",
    vin: v.vin ?? "",
    showroomId: v.showroomId ? String(v.showroomId) : "",
    images: v.kind === "used" ? [...v.images] : [],
    used: u
      ? {
          registrationYear: n(u.registrationYear),
          km: u.km === null || u.km === undefined ? "" : String(u.km),
          owners: n(u.owners),
          registrationNumber: u.registrationNumber,
          registrationState: u.registrationState,
          accident: u.accident.hadAccident ? "yes" : u.accident.details || v.submittedAt ? "no" : "",
          accidentDetails: u.accident.details,
          insuranceStatus: insurance,
          insuranceValidUntil: u.insurance.validUntil,
          inspection: u.inspection,
          condition: CONDITION_GRADES.some((c) => c.value === u.condition) ? (u.condition as UsedConditionGrade) : "",
          conditionNotes: v.description,
        }
      : emptyUsed(),
  };
}

const int = (s: string) => {
  const v = Number(s.replace(/[,\s₹]/g, ""));
  return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
};

/**
 * What the public pages show for a listing: the catalogue's car plus the dealer's own facts.
 * Shared by the server (stored rows) and the form's live preview (unsaved values), so the preview is exact.
 */
export function publicFromCatalogue(
  car: CarModel | undefined,
  variant: Variant | undefined,
  own: {
    id: number;
    partnerId: number;
    reference: string;
    kind: "new" | "used";
    brand: string;
    /** Stored names — only used while the catalogue model is missing. */
    model: string;
    variant: string;
    year: number;
    colour: string;
    sellingPrice: number;
    stock: number;
    availability: "in_stock" | "on_order";
    waitingWeeks: number | null;
    /** Used cars: the dealer's photos and condition notes. */
    images: string[];
    notes: string;
    fallback: { bodyType: string; fuel: string; transmission: string; exShowroom: number | null };
    showroom: PublicVehicle["showroom"];
    dealer: PublicVehicle["dealer"];
    used: PublicVehicle["used"];
  },
): PublicVehicle {
  const isNew = own.kind === "new";
  return {
    id: own.id,
    partnerId: own.partnerId,
    reference: own.reference,
    kind: own.kind,
    brand: car?.brand ?? own.brand,
    modelSlug: car?.slug ?? null,
    model: car?.name ?? own.model,
    variant: variant?.name ?? own.variant,
    year: own.year,
    bodyType: car?.bodyType ?? own.fallback.bodyType,
    fuel: variant?.fuel ?? own.fallback.fuel,
    transmission: variant?.transmission ?? own.fallback.transmission,
    colour: own.colour,
    colourHex: car?.colors.find((c) => c.name === own.colour)?.hex ?? null,
    exShowroom: variant?.price ?? own.fallback.exShowroom,
    sellingPrice: own.sellingPrice,
    stock: isNew && own.availability === "on_order" ? 0 : own.stock,
    availability: isNew ? own.availability : "in_stock",
    waitingWeeks: isNew && own.availability === "on_order" ? own.waitingWeeks : null,
    description: isNew ? (car?.overview ?? "") : own.notes,
    specs: car ? catalogueSpecs(car, variant) : [],
    features: car ? catalogueFeatures(car, variant) : [],
    images: isNew ? (car?.images ?? []) : own.images,
    showroom: own.showroom,
    dealer: own.dealer,
    used: isNew ? null : own.used,
  };
}

/** The unsaved form as the public would see it — for the form's live preview. */
export function formToPublic(
  f: VehicleFormValue,
  car: CarModel | undefined,
  ctx: { id?: number; partnerId: number; reference?: string; dealer: PublicVehicle["dealer"]; showroom: PublicVehicle["showroom"]; year: number },
): PublicVehicle {
  const variant = findVariant(car, f.variantSlug);
  return publicFromCatalogue(car, variant, {
    id: ctx.id ?? 0,
    partnerId: ctx.partnerId,
    reference: ctx.reference ?? "New listing",
    kind: f.kind,
    brand: f.brand,
    model: "",
    variant: "",
    year: f.kind === "used" ? (int(f.year) ?? 0) : ctx.year,
    colour: f.colour,
    sellingPrice: int(f.sellingPrice) ?? 0,
    stock: int(f.stock) ?? 0,
    availability: f.availability,
    waitingWeeks: int(f.waitingWeeks),
    images: f.images,
    notes: f.used.conditionNotes.trim(),
    fallback: { bodyType: "", fuel: "", transmission: "", exShowroom: null },
    showroom: ctx.showroom,
    dealer: ctx.dealer,
    used:
      f.kind === "used"
        ? {
            registrationYear: int(f.used.registrationYear),
            km: f.used.km.trim() === "" ? null : Number(f.used.km.replace(/[,\s]/g, "")) || 0,
            owners: int(f.used.owners),
            registrationState: f.used.registrationState,
            accident: { hadAccident: f.used.accident === "yes", details: f.used.accidentDetails },
            insurance: { status: f.used.insuranceStatus, validUntil: f.used.insuranceValidUntil },
            hasInspection: Boolean(f.used.inspection),
            condition: f.used.condition,
          }
        : null,
  });
}
