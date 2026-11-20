import type { DayHours, PartnerApplication, PartnerProfile } from "./types";

/* Defaults and step metadata for the registration wizard. Client-safe. */

export const WIZARD_STEPS = [
  { n: 1, slug: "personal-details", title: "Personal details", short: "Personal" },
  { n: 2, slug: "business-details", title: "Business details", short: "Business" },
  { n: 3, slug: "showroom-details", title: "Showroom details", short: "Showrooms" },
  { n: 4, slug: "brand-authorization", title: "Brand authorisation", short: "Brands" },
  { n: 5, slug: "documents", title: "Documents", short: "Documents" },
  { n: 6, slug: "bank-details", title: "Bank details", short: "Bank" },
  { n: 7, slug: "review", title: "Review & submit", short: "Review" },
] as const;
export type WizardSlug = (typeof WIZARD_STEPS)[number]["slug"];

export const DAYS: DayHours["day"][] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABEL: Record<DayHours["day"], string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

export const defaultHours = (): DayHours[] => DAYS.map((day) => ({ day, open: "09:30", close: "20:00", closed: false }));

export function emptyApplication(personal: { fullName: string; email: string; mobile: string }): PartnerApplication {
  return {
    personal: {
      fullName: personal.fullName,
      designation: "",
      mobile: personal.mobile,
      mobileVerified: false,
      email: personal.email,
      emailVerified: false,
      photo: "",
      authorizedContact: { name: "", designation: "", mobile: "", email: "" },
    },
    business: { legalName: "", tradeName: "", businessType: "", gst: "", pan: "", registrationNumber: "", establishedOn: "", email: "", phone: "", website: "" },
    showrooms: [],
    brands: { mode: "", items: [] },
    documents: { pan: null, gst: null, registration: null, identity: null, address: null, brand_authorization: null, cancelled_cheque: null, supporting: [] },
    bank: { holder: "", bankName: "", accountNumber: "", ifsc: "", branch: "", cheque: null },
    declaration: { acceptedTerms: false, declared: false, signedName: "", signedAt: null },
  };
}

export const emptyProfile = (): PartnerProfile => ({
  description: "",
  logo: "",
  banner: "",
  gallery: [],
  hours: defaultHours(),
  facilities: [],
  socials: { website: "", instagram: "", facebook: "", youtube: "", whatsapp: "" },
});

/** Indian formats, shared by client hints and server validation. */
export const PATTERNS = {
  mobile: /^[6-9]\d{9}$/,
  gst: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  pan: /^[A-Z]{5}\d{4}[A-Z]$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  pin: /^[1-9]\d{5}$/,
  account: /^\d{9,18}$/,
};
