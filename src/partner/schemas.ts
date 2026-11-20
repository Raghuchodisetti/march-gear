import { z } from "zod";
import { BUSINESS_TYPES } from "@/db/enums";
import { PATTERNS, WIZARD_STEPS, type WizardSlug } from "./application";
import type { ApplicationBrand, FileRef, PartnerApplication } from "./types";
import { INDIAN_STATES } from "@/data/states";

/* ──────────────────────────────────────────────────────────────
   Registration wizard validation — shared by the browser (instant
   feedback on "Next") and the server (authoritative on save, step
   advance and submit). Client-safe: no server imports.

   Two layers per section:
   - *draft* schemas: shape + length limits only, used by autosave so
     half-finished work is always kept;
   - *step* checks: everything required to move on / submit.
   Field-error keys are dotted paths inside the section, e.g.
   "authorizedContact.mobile", "0.pin" (showrooms), "items.1.certificate".
   ────────────────────────────────────────────────────────────── */

/* ── The wizard's view of the application ───────────────────── */

/** A brand row as the wizard keeps it: the stored shape plus the branches that sell it. */
export type WizardBrand = ApplicationBrand & { showroomKeys?: string[] };

/** What the browser holds. The bank account number is never sent down — only typed in. */
export type WizardApplication = Omit<PartnerApplication, "brands" | "bank"> & {
  brands: { mode: PartnerApplication["brands"]["mode"]; items: WizardBrand[] };
  bank: Omit<PartnerApplication["bank"], "accountNumber"> & { accountNumber: string; accountNumberConfirm: string };
};

/** Whether an encrypted account number is on file, and its masked form. */
export interface BankMeta {
  hasAccount: boolean;
  masked: string;
}

export const SECTIONS = ["personal", "business", "showrooms", "brands", "documents", "bank", "declaration"] as const;
export type Section = (typeof SECTIONS)[number];

export const STEP_SECTION: Record<WizardSlug, Section> = {
  "personal-details": "personal",
  "business-details": "business",
  "showroom-details": "showrooms",
  "brand-authorization": "brands",
  documents: "documents",
  "bank-details": "bank",
  review: "declaration",
};

export const stepNumber = (slug: WizardSlug): number => WIZARD_STEPS.find((s) => s.slug === slug)!.n;
export const stepBySlug = (slug: string) => WIZARD_STEPS.find((s) => s.slug === slug);

/* ── Reference lists (offline) ──────────────────────────────── */

export { INDIAN_STATES };

/** GSTIN state codes (first two digits of a GSTIN). */
export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (old code)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other territory",
};

/**
 * Bank from the first four letters of an IFSC — an offline table of common Indian banks.
 * The branch can't be derived without a lookup service, so the dealer types it.
 */
export const IFSC_BANKS: Record<string, string> = {
  SBIN: "State Bank of India",
  HDFC: "HDFC Bank",
  ICIC: "ICICI Bank",
  UTIB: "Axis Bank",
  KKBK: "Kotak Mahindra Bank",
  PUNB: "Punjab National Bank",
  BARB: "Bank of Baroda",
  CNRB: "Canara Bank",
  UBIN: "Union Bank of India",
  IDIB: "Indian Bank",
  IOBA: "Indian Overseas Bank",
  BKID: "Bank of India",
  MAHB: "Bank of Maharashtra",
  UCBA: "UCO Bank",
  PSIB: "Punjab & Sind Bank",
  CBIN: "Central Bank of India",
  YESB: "Yes Bank",
  INDB: "IndusInd Bank",
  IDFB: "IDFC FIRST Bank",
  FDRL: "Federal Bank",
  SIBL: "South Indian Bank",
  KVBL: "Karur Vysya Bank",
  CIUB: "City Union Bank",
  TMBL: "Tamilnad Mercantile Bank",
  KARB: "Karnataka Bank",
  RATN: "RBL Bank",
  DCBL: "DCB Bank",
  BDBL: "Bandhan Bank",
  AUBL: "AU Small Finance Bank",
  DLXB: "Dhanlaxmi Bank",
  JAKA: "Jammu & Kashmir Bank",
  CSBK: "CSB Bank",
  ESFB: "Equitas Small Finance Bank",
  UJVN: "Ujjivan Small Finance Bank",
  HSBC: "HSBC",
  SCBL: "Standard Chartered Bank",
  CITI: "Citibank",
  DBSS: "DBS Bank India",
};

export const bankFromIfsc = (ifsc: string) => (PATTERNS.ifsc.test(ifsc) ? (IFSC_BANKS[ifsc.slice(0, 4)] ?? null) : null);
export const gstState = (gst: string) => GST_STATE_CODES[gst.slice(0, 2)] ?? null;

/* ── Normalisers (client and server agree on stored formats) ── */

export const digitsOnly = (v: string) => v.replace(/\D/g, "");
/** "+91 98480 12345" → "9848012345". */
export const normaliseMobile = (v: string) => digitsOnly(v).replace(/^(?:91|0)(?=\d{10}$)/, "");
export const normaliseCode = (v: string) => v.replace(/\s/g, "").toUpperCase();
const normaliseName = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();

const todayIST = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (v: string) => ISO_DATE.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WEBSITE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i;
const PHONE = /^(?:[6-9]\d{9}|0\d{9,11}|1800\d{6,7})$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Public dealer images saved through /dealer/upload. */
export const MEDIA_URL = /^\/media\/(\d+)\/[\w.-]+$/;

/* ── Draft schemas (autosave) ───────────────────────────────── */

const text = (max: number) => z.string().max(max, `Keep this under ${max} characters`).default("");
const bool = z.boolean().default(false);
const fileRef = z.object({
  id: z.number().int().positive(),
  filename: z.string().max(200),
  mime: z.string().max(60),
  size: z.number().int().nonnegative(),
});
const maybeFile = fileRef.nullable().default(null);
const coord = (min: number, max: number) => z.number().min(min).max(max).nullable().default(null);
const hoursDraft = z
  .array(
    z.object({
      day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
      open: z.string().max(5),
      close: z.string().max(5),
      closed: z.boolean(),
    }),
  )
  .max(7);

export const draftSchemas = {
  personal: z.object({
    fullName: text(120),
    designation: text(80),
    mobile: text(20),
    mobileVerified: bool,
    email: text(190),
    emailVerified: bool,
    photo: text(300),
    authorizedContact: z
      .object({ name: text(120), designation: text(80), mobile: text(20), email: text(190) })
      .default({ name: "", designation: "", mobile: "", email: "" }),
  }),
  business: z.object({
    legalName: text(200),
    tradeName: text(200),
    businessType: z.enum([...BUSINESS_TYPES, ""]).default(""),
    gst: text(15),
    pan: text(10),
    registrationNumber: text(40),
    establishedOn: text(10),
    email: text(190),
    phone: text(20),
    website: text(200),
  }),
  showrooms: z
    .array(
      z.object({
        key: z.string().min(1).max(40),
        name: text(160),
        address: text(300),
        state: text(64),
        district: text(64),
        city: text(64),
        pin: text(6),
        lat: coord(-90, 90),
        lng: coord(-180, 180),
        phone: text(30),
        hours: hoursDraft,
        photos: z.array(z.string().max(300)).max(8, "Up to 8 photos per showroom").default([]),
        serviceCentre: bool,
        isPrimary: bool,
      }),
    )
    .max(20, "You can add up to 20 showrooms here — add more from the portal after approval"),
  brands: z.object({
    mode: z.enum(["authorized", "multi_brand", ""]).default(""),
    items: z
      .array(
        z.object({
          brand: z.string().min(1).max(80),
          models: z.array(z.string().max(120)).max(200).default([]),
          variants: z.array(z.string().max(250)).max(1000).default([]),
          certificate: maybeFile,
          validUntil: text(10),
          showroomKeys: z.array(z.string().max(40)).max(20).default([]),
        }),
      )
      .max(30, "Up to 30 brands"),
  }),
  documents: z.object({
    pan: maybeFile,
    gst: maybeFile,
    registration: maybeFile,
    identity: maybeFile,
    address: maybeFile,
    brand_authorization: maybeFile,
    cancelled_cheque: maybeFile,
    supporting: z.array(fileRef).max(10, "Up to 10 supporting documents").default([]),
  }),
  bank: z.object({
    holder: text(120),
    bankName: text(120),
    accountNumber: text(24),
    accountNumberConfirm: text(24),
    ifsc: text(11),
    branch: text(120),
    cheque: maybeFile,
  }),
  declaration: z.object({ acceptedTerms: bool, declared: bool, signedName: text(120) }),
} satisfies Record<Section, z.ZodType>;

export type DraftOf<S extends Section> = z.infer<(typeof draftSchemas)[S]>;

/* ── Step checks ────────────────────────────────────────────── */

export type FieldErrors = Record<string, string>;

/** Context the step checks need beyond the section itself. */
export interface CheckContext {
  /** True when a verification code can actually be delivered (development); then the mobile must be verified. */
  requireVerifiedMobile: boolean;
  /** An encrypted account number is already on file. */
  hasAccount: boolean;
  /** Showroom keys in the application (for the brand ↔ branch mapping). */
  showroomKeys: string[];
  /** Applicant's full name (for the typed signature). */
  fullName: string;
  /** Brand step: authorised dealers must give a certificate per brand unless a combined letter is in Documents. */
  businessType?: string;
}

/** Minimal catalogue view used to check brands → models → variants (server: getCatalog(); browser: useCatalog()). */
export interface CatalogLite {
  brands: { slug: string; name: string }[];
  cars: { slug: string; brand: string; name: string; variants: { slug: string; name: string }[] }[];
}

const issue = (c: z.RefinementCtx, path: (string | number)[], message: string) => c.addIssue({ code: "custom", path, message });
const filled = (message: string, min = 2) => z.string().refine((v) => v.trim().length >= min, message);
const mobileOk = (v: string) => PATTERNS.mobile.test(normaliseMobile(v));
const emailOk = (v: string) => EMAIL.test(v.trim());
/**
 * A mobile, a landline with its STD code ("0891 234 5678", "011 2345 6789") or a toll-free number. Landlines are
 * checked as typed — normaliseMobile() strips a leading 0, which would turn "011…" into an invalid number —
 * and "+91 40 1234 5678" is read as "040 1234 5678".
 */
const phoneOk = (v: string) => {
  const d = digitsOnly(v);
  return PHONE.test(d) || PHONE.test(normaliseMobile(v)) || (/^91\d{10,11}$/.test(d) && PHONE.test(`0${d.slice(2)}`));
};
const present = (message: string) => fileRef.nullable().refine((v) => v !== null, message);

const personalStep = (ctx: CheckContext) =>
  z
    .object({
      fullName: filled("Enter your full name"),
      designation: filled("Enter your designation, e.g. Managing Director"),
      mobile: z.string().refine(mobileOk, "Enter a valid 10-digit Indian mobile number"),
      mobileVerified: z.boolean(),
      email: z.string().refine(emailOk, "Enter a valid email address"),
      emailVerified: z.boolean(),
      photo: z.string().min(1, "Add a profile photograph").regex(MEDIA_URL, "Upload the photograph again"),
      authorizedContact: z.object({
        name: filled("Enter the contact person's name"),
        designation: z.string(),
        mobile: z.string().refine(mobileOk, "Enter a valid 10-digit mobile number"),
        email: z.string().refine(emailOk, "Enter a valid email address"),
      }),
    })
    .superRefine((p, c) => {
      if (ctx.requireVerifiedMobile && mobileOk(p.mobile) && !p.mobileVerified) issue(c, ["mobile"], "Verify your mobile number with the code we send you");
    });

const businessStep = z
  .object({
    legalName: filled("Enter the legal name exactly as on your GST certificate"),
    tradeName: z.string(),
    businessType: z.string().refine((v) => (BUSINESS_TYPES as readonly string[]).includes(v), "Choose your business type"),
    gst: z.string().refine((v) => PATTERNS.gst.test(normaliseCode(v)), "Enter a valid 15-character GSTIN, e.g. 37ABCDE1234F1Z5"),
    pan: z.string().refine((v) => PATTERNS.pan.test(normaliseCode(v)), "Enter a valid PAN, e.g. ABCDE1234F"),
    registrationNumber: z.string(),
    establishedOn: z.string().refine(validDate, "Choose the date your business was established"),
    email: z.string().refine(emailOk, "Enter a valid business email"),
    phone: z.string().refine(phoneOk, "Enter a valid phone number with STD code, or a mobile number"),
    website: z.string().refine((v) => !v.trim() || WEBSITE.test(v.trim()), "Enter a valid website, e.g. https://yourdealership.in"),
  })
  .superRefine((b, c) => {
    const gst = normaliseCode(b.gst);
    const pan = normaliseCode(b.pan);
    if (PATTERNS.gst.test(gst) && !GST_STATE_CODES[gst.slice(0, 2)]) issue(c, ["gst"], "The first two digits of a GSTIN are a state code — this one isn't recognised");
    if (PATTERNS.gst.test(gst) && PATTERNS.pan.test(pan) && gst.slice(2, 12) !== pan) issue(c, ["pan"], "This PAN doesn't match the one inside your GSTIN (characters 3–12)");
    if (b.businessType && b.businessType !== "proprietorship" && b.registrationNumber.trim().length < 4)
      issue(c, ["registrationNumber"], "Enter your registration number (CIN / LLPIN / firm registration)");
    if (validDate(b.establishedOn) && b.establishedOn > todayIST()) issue(c, ["establishedOn"], "This date is in the future");
    else if (validDate(b.establishedOn) && b.establishedOn < "1900-01-01") issue(c, ["establishedOn"], "Check the year");
  });

const dayStep = z
  .object({ day: z.string(), open: z.string(), close: z.string(), closed: z.boolean() })
  .superRefine((h, c) => {
    if (h.closed) return;
    if (!TIME.test(h.open) || !TIME.test(h.close)) issue(c, [], "Enter opening and closing times");
    else if (h.close <= h.open) issue(c, [], "Closing time must be after opening time");
  });

const showroomStep = z
  .object({
    key: z.string(),
    name: filled("Enter the showroom name"),
    address: filled("Enter the full street address", 8),
    state: z.string().refine((v) => (INDIAN_STATES as readonly string[]).includes(v), "Choose the state"),
    district: filled("Enter the district"),
    city: filled("Enter the city or town"),
    pin: z.string().refine((v) => PATTERNS.pin.test(v.trim()), "Enter a valid 6-digit PIN code"),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    phone: z.string().refine((v) => !v.trim() || phoneOk(v), "Enter a valid phone number"),
    hours: z
      .array(dayStep)
      .length(7, "Set the working hours for each day")
      .refine((h) => h.some((d) => !d.closed), "Open on at least one day"),
    photos: z.array(z.string().regex(MEDIA_URL, "Upload these photos again")).max(8, "Up to 8 photos per showroom"),
    serviceCentre: z.boolean(),
    isPrimary: z.boolean(),
  })
  .superRefine((s, c) => {
    if ((s.lat === null) !== (s.lng === null)) issue(c, ["location"], "Enter both latitude and longitude, or clear both");
    else if (s.lat !== null && s.lng !== null && (s.lat < 6 || s.lat > 37.5 || s.lng < 68 || s.lng > 97.5)) issue(c, ["location"], "These coordinates are outside India");
  });

const showroomsStep = z
  .array(showroomStep)
  .min(1, "Add at least one showroom")
  .superRefine((list, c) => {
    if (list.length && list.filter((s) => s.isPrimary).length !== 1) issue(c, [], "Choose one primary branch");
  });

const brandsStep = (ctx: CheckContext, catalog?: CatalogLite, docs?: WizardApplication["documents"]) =>
  z
    .object({
      mode: z.string().refine((v) => v === "authorized" || v === "multi_brand", "Tell us whether you're an authorised or a multi-brand dealer"),
      items: z
        .array(
          z.object({
            brand: z.string(),
            models: z.array(z.string()),
            variants: z.array(z.string()),
            certificate: fileRef.nullable(),
            validUntil: z.string(),
            showroomKeys: z.array(z.string()).optional(),
          }),
        )
        .min(1, "Select at least one brand you sell"),
    })
    .superRefine((b, c) => {
      const seen = new Set<string>();
      const today = todayIST();
      const combinedLetter = Boolean(docs?.brand_authorization);
      b.items.forEach((item, i) => {
        const at = (f: string) => ["items", i, f];
        if (seen.has(item.brand)) issue(c, at("brand"), "This brand is listed twice");
        seen.add(item.brand);
        const line = catalog?.cars.filter((car) => car.brand === item.brand) ?? [];
        if (catalog && !catalog.brands.some((x) => x.slug === item.brand)) issue(c, at("brand"), "This brand isn't in our catalogue any more — remove it");
        if ((!catalog || line.length > 0) && item.models.length === 0) issue(c, at("models"), "Pick at least one model");
        if (catalog) {
          if (item.models.some((m) => !line.some((car) => car.slug === m))) issue(c, at("models"), "Some models are no longer in our catalogue — review your selection");
          for (const m of item.models) {
            const car = line.find((x) => x.slug === m);
            if (car && car.variants.length && !item.variants.some((v) => v.startsWith(`${m}/`))) issue(c, ["items", i, "variants", m], `Pick at least one ${car.name} variant`);
          }
          const valid = new Set(line.flatMap((car) => car.variants.map((v) => `${car.slug}/${v.slug}`)));
          if (item.variants.some((v) => !valid.has(v) || !item.models.includes(v.split("/")[0]))) issue(c, at("variants"), "Some variants are no longer available — review your selection");
        }
        if (b.mode === "authorized") {
          if (!item.certificate && !combinedLetter) issue(c, at("certificate"), "Upload the dealership authorisation certificate for this brand");
          if (!validDate(item.validUntil)) issue(c, at("validUntil"), "Enter the date the authorisation is valid until");
          else if (item.validUntil < today) issue(c, at("validUntil"), "This authorisation has expired");
        } else if (item.validUntil && !validDate(item.validUntil)) issue(c, at("validUntil"), "Enter a valid date");
        if (ctx.showroomKeys.length > 1 && !(item.showroomKeys ?? []).some((key) => ctx.showroomKeys.includes(key)))
          issue(c, at("showroomKeys"), "Choose at least one showroom that sells this brand");
      });
    });

const documentsStep = z.object({
  pan: present("Upload your PAN card"),
  gst: present("Upload your GST registration certificate"),
  registration: present("Upload your business registration certificate"),
  identity: present("Upload an identity proof of the authorised signatory"),
  address: present("Upload a proof of your business address"),
  brand_authorization: fileRef.nullable().optional(),
  cancelled_cheque: fileRef.nullable().optional(),
  supporting: z.array(fileRef).max(10, "Up to 10 supporting documents"),
});

const bankStep = (ctx: CheckContext) =>
  z
    .object({
      holder: filled("Enter the account holder's name as printed on the cheque"),
      bankName: filled("Enter the bank's name"),
      accountNumber: z.string(),
      accountNumberConfirm: z.string(),
      ifsc: z.string().refine((v) => PATTERNS.ifsc.test(normaliseCode(v)), "Enter a valid 11-character IFSC, e.g. HDFC0001234"),
      branch: filled("Enter the branch name"),
      cheque: present("Upload a cancelled cheque"),
    })
    .superRefine((b, c) => {
      const acct = digitsOnly(b.accountNumber);
      const changing = Boolean(b.accountNumber.trim() || b.accountNumberConfirm.trim());
      if (ctx.hasAccount && !changing) return;
      if (!PATTERNS.account.test(acct)) issue(c, ["accountNumber"], "Enter a valid account number (9–18 digits)");
      else if (acct !== digitsOnly(b.accountNumberConfirm)) issue(c, ["accountNumberConfirm"], "The account numbers don't match");
    });

const declarationStep = (ctx: CheckContext) =>
  z
    .object({
      acceptedTerms: z.boolean().refine((v) => v, "Accept the partner terms & conditions to submit"),
      declared: z.boolean().refine((v) => v, "Confirm the declaration to submit"),
      signedName: filled("Type your full name as your signature"),
    })
    .superRefine((d, c) => {
      if (d.signedName.trim().length >= 2 && normaliseName(d.signedName) !== normaliseName(ctx.fullName))
        issue(c, ["signedName"], `Type your name exactly as given in step 1 (${ctx.fullName.trim() || "your full name"})`);
    });

const errorsOf = (r: { success: boolean; error?: z.ZodError }): FieldErrors => (r.success || !r.error ? {} : zodErrors(r.error));

/** Everything required to leave a step (Zod). Returns {} when the step is complete. */
export function checkStep(slug: WizardSlug, app: WizardApplication, ctx: CheckContext, catalog?: CatalogLite): FieldErrors {
  switch (slug) {
    case "personal-details":
      return errorsOf(personalStep(ctx).safeParse(app.personal));
    case "business-details":
      return errorsOf(businessStep.safeParse(app.business));
    case "showroom-details":
      return errorsOf(showroomsStep.safeParse(app.showrooms));
    case "brand-authorization":
      return errorsOf(brandsStep(ctx, catalog, app.documents).safeParse(app.brands));
    case "documents":
      return errorsOf(documentsStep.safeParse(app.documents));
    case "bank-details":
      return errorsOf(bankStep(ctx).safeParse(app.bank));
    case "review":
      return errorsOf(declarationStep(ctx).safeParse(app.declaration));
  }
}

/** Steps 1–6 with their problems — for the review page and the final submit. */
export function checkApplication(app: WizardApplication, ctx: CheckContext, catalog?: CatalogLite) {
  return WIZARD_STEPS.filter((s) => s.slug !== "review").map((s) => ({ slug: s.slug as WizardSlug, title: s.title, errors: checkStep(s.slug, app, ctx, catalog) }));
}

/** The first message for a field, including nested ones ("0.photos" also matches "0.photos.2"). */
export function errorAt(errors: FieldErrors, key: string): string | undefined {
  if (errors[key]) return errors[key];
  const prefix = `${key}.`;
  for (const k in errors) if (k.startsWith(prefix)) return errors[k];
  return undefined;
}

export const contextFor = (app: WizardApplication, extra: { requireVerifiedMobile: boolean; hasAccount: boolean }): CheckContext => ({
  ...extra,
  showroomKeys: app.showrooms.map((s) => s.key),
  fullName: app.personal.fullName,
  businessType: app.business.businessType,
});

/** Turns a Zod error into `{ "dotted.path": "first message" }`. */
export function zodErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) out[issue.path.join(".") || "form"] ??= issue.message;
  return out;
}

/* ── Staff feedback: document reviews and required corrections ── */

/** "Blurred scan." → "Blurred scan" (so it can be followed by our own full stop). */
export const trimStop = (v: string) => v.trim().replace(/[.\s]+$/, "");
const capitalise = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

export interface FileReview {
  status: "pending" | "verified" | "rejected";
  remarks: string | null;
}

/** A document MarchGear rejected must be replaced before resubmitting. */
export function rejectedFileErrors(slug: WizardSlug, app: WizardApplication, reviews: Record<number, FileReview>): FieldErrors {
  const e: FieldErrors = {};
  const check = (key: string, f: FileRef | null | undefined) => {
    const r = f ? reviews[f.id] : undefined;
    if (r?.status === "rejected") e[key] ??= `This file was rejected${r.remarks ? ` — ${trimStop(r.remarks)}` : ""}. Upload a new one.`;
  };
  if (slug === "documents") {
    (["pan", "gst", "registration", "identity", "address", "brand_authorization"] as const).forEach((k) => check(k, app.documents[k]));
    app.documents.supporting.forEach((f, i) => check(`supporting.${i}`, f));
  }
  if (slug === "brand-authorization") app.brands.items.forEach((item, i) => check(`items.${i}.certificate`, item.certificate));
  if (slug === "bank-details") check("cheque", app.bank.cheque);
  return e;
}

export interface Correction {
  text: string;
  slug: WizardSlug;
}

const SECTION_PREFIX: Record<string, WizardSlug> = {
  personal: "personal-details",
  business: "business-details",
  showroom: "showroom-details",
  showrooms: "showroom-details",
  brand: "brand-authorization",
  brands: "brand-authorization",
  document: "documents",
  documents: "documents",
  bank: "bank-details",
  review: "review",
  declaration: "review",
};

const CORRECTION_RULES: [RegExp, WizardSlug][] = [
  [/\b(bank|ifsc|account (number|holder)|cheque|branch name)\b/i, "bank-details"],
  [/\b(showroom|outlet|branch|location|map|pin ?code|working hours|opening hours|service cent(re|er))\b/i, "showroom-details"],
  [/\b(brand|authori[sz]ation|authori[sz]ed dealer|oem|franchise|model|variant)\b/i, "brand-authorization"],
  [/\b(document|proof|certificate|upload|scan|copy|pdf|photo of (the )?(pan|gst))\b/i, "documents"],
  [/\b(gst|gstin|pan|legal name|trade name|business type|registration number|cin|llpin|establish|website|business (email|phone))\b/i, "business-details"],
  [/\b(mobile|phone|email|photo(graph)?|designation|contact person|full name)\b/i, "personal-details"],
  [/\b(signature|declaration|terms)\b/i, "review"],
];

/**
 * Which wizard step a staff correction is about. Staff can be explicit with a prefix —
 * "documents: …", "bank: …", or a step slug like "showroom-details: …" — otherwise keywords decide.
 */
export function correctionStep(text: string, status?: string): { slug: WizardSlug; text: string } {
  const m = /^\s*([a-z-]+)\s*[:—–-]\s+([\s\S]+)$/i.exec(text);
  if (m) {
    const key = m[1].toLowerCase();
    const slug = SECTION_PREFIX[key] ?? WIZARD_STEPS.find((s) => s.slug === key)?.slug;
    if (slug) return { slug, text: capitalise(m[2].trim()) };
  }
  for (const [re, slug] of CORRECTION_RULES) if (re.test(text)) return { slug, text: text.trim() };
  return { slug: status === "documents_required" ? "documents" : "review", text: text.trim() };
}

export const correctionsFor = (list: string[] | null | undefined, status?: string): Correction[] =>
  (list ?? []).filter((t) => typeof t === "string" && t.trim()).map((t) => correctionStep(t, status));

/** Client and server agree on these refs; the server re-reads them from partner_files. */
export type { FileRef };
