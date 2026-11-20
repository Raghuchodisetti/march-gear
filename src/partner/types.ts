import type { BusinessType, FuelTypeName, OfferCategory, PartnerDocKind, TransmissionName } from "./enum-types";

/* ──────────────────────────────────────────────────────────────
   Shapes of the JSON documents the dealer partner portal stores.
   Client-safe (types only).
   ────────────────────────────────────────────────────────────── */

/** A private file reference (partner_files row) as kept inside JSON documents. */
export interface FileRef {
  id: number;
  filename: string;
  mime: string;
  size: number;
}

export interface DayHours {
  day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  open: string; // "09:30"
  close: string; // "20:00"
  closed: boolean;
}

export interface ApplicationShowroom {
  /** Client-side key so rows survive reordering; becomes partner_showrooms.id after submit. */
  key: string;
  name: string;
  address: string;
  state: string;
  district: string;
  city: string;
  pin: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  hours: DayHours[];
  photos: string[]; // public /media URLs
  serviceCentre: boolean;
  isPrimary: boolean;
}

export interface ApplicationBrand {
  brand: string; // brand slug (catalogue)
  models: string[]; // car slugs
  variants: string[]; // "carSlug/variantSlug"
  certificate: FileRef | null;
  validUntil: string; // YYYY-MM-DD or ""
}

/** The 7-step registration wizard's draft — autosaved as the dealer types. */
export interface PartnerApplication {
  personal: {
    fullName: string;
    designation: string;
    mobile: string;
    mobileVerified: boolean;
    email: string;
    emailVerified: boolean;
    photo: string; // public /media URL or ""
    authorizedContact: { name: string; designation: string; mobile: string; email: string };
  };
  business: {
    legalName: string;
    tradeName: string;
    businessType: BusinessType | "";
    gst: string;
    pan: string;
    registrationNumber: string;
    establishedOn: string;
    email: string;
    phone: string;
    website: string;
  };
  showrooms: ApplicationShowroom[];
  brands: {
    mode: "authorized" | "multi_brand" | "";
    items: ApplicationBrand[];
  };
  documents: Partial<Record<Exclude<PartnerDocKind, "inspection_report" | "brochure" | "ticket_attachment" | "payment_proof" | "supporting">, FileRef | null>> & {
    supporting: FileRef[];
  };
  bank: {
    holder: string;
    bankName: string;
    /** Stored encrypted at rest; the browser only ever sees the masked form after submit. */
    accountNumber: string;
    ifsc: string;
    branch: string;
    cheque: FileRef | null;
  };
  declaration: {
    acceptedTerms: boolean;
    declared: boolean;
    signedName: string;
    signedAt: string | null;
  };
}

/** Public-facing profile, editable any time (no re-approval). */
export interface PartnerProfile {
  description: string;
  logo: string;
  banner: string;
  gallery: string[];
  hours: DayHours[];
  facilities: string[];
  socials: { website: string; instagram: string; facebook: string; youtube: string; whatsapp: string };
}

export interface UsedVehicleDetails {
  registrationYear: number | null;
  km: number | null;
  owners: number | null;
  registrationNumber: string;
  registrationState: string;
  accident: { hadAccident: boolean; details: string };
  insurance: { status: "comprehensive" | "third_party" | "expired" | "none" | ""; validUntil: string };
  inspection: FileRef | null;
}

export interface OfferScope {
  vehicleType: "new" | "used" | "both";
  allModels: boolean;
  brands: string[];
  models: string[];
  variants: string[];
}

export interface OfferDiscount {
  flat: number | null;
  percentage: number | null;
  cash: number | null;
  exchangeBonus: number | null;
  corporateBonus: number | null;
  loyaltyBonus: number | null;
  freeAccessories: string;
  freeInsurance: boolean;
  financeBenefit: string;
  maxDiscount: number | null;
  minPurchase: string;
}

export interface OfferMedia {
  desktopBanner: string;
  mobileBanner: string;
  thumbnail: string;
  gallery: string[];
  videoUrl: string;
  brochure: FileRef | null;
}

export interface OfferLocations {
  mode: "all" | "branches" | "cities" | "states";
  showroomIds: number[];
  cities: string[];
  states: string[];
}

export type { BusinessType, OfferCategory, FuelTypeName, TransmissionName };
