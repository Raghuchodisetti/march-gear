import type { PartnerVehicleStatus } from "@/db/enums";
import type { FileRef } from "@/partner/types";
import type { BodyType, FuelType, Transmission } from "@/types";

/* ──────────────────────────────────────────────────────────────
   Vehicle inventory — shapes, options and rules shared by the
   dealer-portal UI and the Server Actions. Client-safe.
   ────────────────────────────────────────────────────────────── */

export const BODY_TYPES: BodyType[] = ["SUV", "Sedan", "Hatchback", "MUV", "Coupe"];
export const FUELS: FuelType[] = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric"];
export const TRANSMISSIONS: Transmission[] = ["Manual", "Automatic", "AMT", "DCT", "CVT"];

export const INSURANCE_OPTIONS = [
  { value: "comprehensive", label: "Comprehensive" },
  { value: "third_party", label: "Third party" },
  { value: "expired", label: "Expired" },
  { value: "none", label: "Not insured" },
] as const;
export type InsuranceStatus = (typeof INSURANCE_OPTIONS)[number]["value"];

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
export const MAX_VIDEOS = 5;
export const MAX_SPECS = 40;
export const MAX_FEATURES = 60;
export const MIN_DESCRIPTION = 40;
export const MIN_YEAR = 1990;
/** Calendar year in India right now. */
export const currentYear = () => new Date(Date.now() + 5.5 * 3_600_000).getUTCFullYear();

/** 17 characters, no I, O or Q (ISO 3779). */
export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
/** "KA 01 AB 1234", "DL3CAB1234" or a Bharat-series "22 BH 1234 AA" — compared without spaces or dashes. */
export const REG_PATTERN = /^(?:[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}|\d{2}BH\d{4}[A-Z]{1,2})$/;
export const normaliseReg = (v: string) => v.toUpperCase().replace(/[\s.-]+/g, "");

/** A YouTube or Vimeo link → its provider, id and a canonical URL; null for anything else. */
export function parseVideo(raw: string): { provider: "youtube" | "vimeo"; id: string; url: string; embed: string } | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^(www|m)\./, "");
  const yt = (id: string | null | undefined) =>
    id && /^[\w-]{11}$/.test(id) ? { provider: "youtube" as const, id, url: `https://www.youtube.com/watch?v=${id}`, embed: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  if (host === "youtu.be") return yt(u.pathname.slice(1).split("/")[0]);
  if (host === "youtube.com" || host === "music.youtube.com") {
    if (u.pathname === "/watch") return yt(u.searchParams.get("v"));
    const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
    return yt(m?.[1]);
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/^\/(?:video\/)?(\d{6,12})(?:\/|$)/);
    return m ? { provider: "vimeo", id: m[1], url: `https://vimeo.com/${m[1]}`, embed: `https://player.vimeo.com/video/${m[1]}` } : null;
  }
  return null;
}

/* ── Workflow ───────────────────────────────────────────────── */

/** The dealer may send these for approval (again). */
export const SUBMITTABLE: PartnerVehicleStatus[] = ["draft", "changes_requested", "rejected", "unpublished"];
/** The dealer may pull these back to draft. */
export const WITHDRAWABLE: PartnerVehicleStatus[] = ["pending_approval", "approved", "published"];
/** Approved or live: any edit sends the listing back for approval and takes it off the website. */
export const LIVE: PartnerVehicleStatus[] = ["approved", "published"];
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
}

/** What the add/edit form holds. Numbers stay strings until the server parses them. */
export interface VehicleFormValue {
  kind: "new" | "used";
  brand: string;
  /** Catalogue model slug; "" for a model typed by name. */
  modelSlug: string;
  model: string;
  /** Catalogue variant slug (form only — the variant name is what's stored). */
  variantSlug: string;
  variant: string;
  year: string;
  bodyType: string;
  fuel: string;
  transmission: string;
  colour: string;
  exShowroom: string;
  sellingPrice: string;
  stock: string;
  vin: string;
  description: string;
  specs: { label: string; value: string }[];
  features: string[];
  images: string[];
  videos: string[];
  showroomId: string;
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
});

export const emptyVehicle = (kind: "new" | "used" = "new"): VehicleFormValue => ({
  kind,
  brand: "",
  modelSlug: "",
  model: "",
  variantSlug: "",
  variant: "",
  year: kind === "new" ? String(currentYear()) : "",
  bodyType: "",
  fuel: "",
  transmission: "",
  colour: "",
  exShowroom: "",
  sellingPrice: "",
  stock: "1",
  vin: "",
  description: "",
  specs: [],
  features: [],
  images: [],
  videos: [],
  showroomId: "",
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
  status: PartnerVehicleStatus;
  adminRemarks: string | null;
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

/** A dealer vehicle as the public sees it (dealer page, model page, the portal's preview). No private fields. */
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
  exShowroom: number | null;
  sellingPrice: number;
  stock: number;
  description: string;
  specs: { label: string; value: string }[];
  features: string[];
  images: string[];
  videos: string[];
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
  } | null;
}

export const vehicleTitle = (v:{ year?: number | string | null; brandName: string; model: string }) =>
  [v.year && Number(v.year) > 0 ? v.year : null, v.brandName, v.model].filter(Boolean).join(" ") || "Untitled vehicle";

/** "Submitted", "Changes requested"… for an approval-history action. */
export function historyLabel(action: string) {
  const map: Record<string, string> = {
    submitted: "Submitted for approval",
    resubmitted: "Resubmitted for approval",
    withdrawn: "Withdrawn to draft",
    edited: "Edited after approval",
    archived: "Archived",
    restored: "Restored from archive",
    approved: "Approved",
    published: "Published",
    unpublished: "Unpublished",
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
  model: string;
  variant: string;
  year: number;
  bodyType: string;
  fuel: string;
  transmission: string;
  colour: string;
  exShowroom: number | null;
  sellingPrice: number;
  stock: number;
  vin: string | null;
  description: string;
  specs: { label: string; value: string }[];
  features: string[];
  images: string[];
  videos: string[];
  showroomId: number | null;
  used: {
    registrationYear: number | null;
    km: number | null;
    owners: number | null;
    registrationNumber: string;
    registrationState: string;
    accident: { hadAccident: boolean; details: string };
    insurance: { status: string; validUntil: string };
    inspection: FileRef | null;
  } | null;
  /** Never submitted → an unanswered accident question stays unanswered (it's stored as a boolean). */
  submittedAt: Date | string | null;
}

const n = (v: number | null | undefined) => (v === null || v === undefined || v <= 0 ? "" : String(v));

export function vehicleToForm(v: StoredVehicle): VehicleFormValue {
  const u = v.used;
  const insurance = INSURANCE_OPTIONS.some((o) => o.value === u?.insurance.status) ? (u!.insurance.status as InsuranceStatus) : "";
  return {
    kind: v.kind,
    brand: v.brand,
    modelSlug: v.modelSlug ?? "",
    model: v.model,
    variantSlug: "",
    variant: v.variant,
    year: n(v.year),
    bodyType: v.bodyType,
    fuel: v.fuel,
    transmission: v.transmission,
    colour: v.colour,
    exShowroom: n(v.exShowroom),
    sellingPrice: n(v.sellingPrice),
    stock: String(Math.max(0, v.stock)),
    vin: v.vin ?? "",
    description: v.description,
    specs: v.specs.map((s) => ({ label: s.label, value: s.value })),
    features: [...v.features],
    images: [...v.images],
    videos: [...v.videos],
    showroomId: v.showroomId ? String(v.showroomId) : "",
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
        }
      : emptyUsed(),
  };
}

const int = (s: string) => {
  const v = Number(s.replace(/[,\s₹]/g, ""));
  return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
};

/** The unsaved form as the public would see it — for the form's live preview. */
export function formToPublic(
  f: VehicleFormValue,
  ctx: { id?: number; partnerId: number; reference?: string; dealer: PublicVehicle["dealer"]; showroom: PublicVehicle["showroom"] },
): PublicVehicle {
  return {
    id: ctx.id ?? 0,
    partnerId: ctx.partnerId,
    reference: ctx.reference ?? "New listing",
    kind: f.kind,
    brand: f.brand,
    modelSlug: f.modelSlug || null,
    model: f.model,
    variant: f.variant,
    year: int(f.year) ?? 0,
    bodyType: f.bodyType,
    fuel: f.fuel,
    transmission: f.transmission,
    colour: f.colour,
    exShowroom: int(f.exShowroom),
    sellingPrice: int(f.sellingPrice) ?? 0,
    stock: int(f.stock) ?? 0,
    description: f.description,
    specs: f.specs.filter((s) => s.label.trim() && s.value.trim()),
    features: f.features.filter((x) => x.trim()),
    images: f.images,
    videos: f.videos.filter((x) => parseVideo(x)),
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
          }
        : null,
  };
}
