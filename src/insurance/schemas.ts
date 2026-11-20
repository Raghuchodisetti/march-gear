import { z } from "zod";
import { INS_BUSINESS_TYPES, INS_VENDOR_CATEGORIES, type InsBusinessType, type InsVendorCategory } from "@/db/enums";
import { INDIAN_STATES } from "@/data/states";
import { PATTERNS } from "@/partner/application";
import { GST_STATE_CODES, digitsOnly, normaliseCode, normaliseMobile, trimStop, zodErrors, type FieldErrors, type FileReview } from "@/partner/schemas";
import { INS_REQUIRED_DOCUMENTS, INS_STEPS, type InsStepKey } from "./application";
import type { FileRef, InsurerApplication } from "./types";

/* ──────────────────────────────────────────────────────────────
   Insurance vendor registration wizard — validation shared by the
   browser (instant feedback on "Next") and the server (autosave,
   step advance and submit are authoritative). Client-safe.

   Two layers per section:
   - draft schemas: shape and length limits only, used by autosave
     so half-finished work is always kept;
   - step checks: everything needed to move on and to submit.
   Field-error keys are dotted paths inside the section, e.g.
   "representative.mobile", "0.pin" (branches). Step 7 holds two
   sections; its declaration errors are prefixed "declaration.".
   ────────────────────────────────────────────────────────────── */

export { PATTERNS, INDIAN_STATES, digitsOnly, normaliseCode, normaliseMobile, zodErrors };
export type { FieldErrors, FileReview };

/* ── The wizard's view of the application ───────────────────── */

/** What the browser holds. The bank account number is never sent down (only its masked form, separately) — it is only typed in. */
export type InsWizardApplication = Omit<InsurerApplication, "bank" | "declaration"> & {
  bank: Omit<InsurerApplication["bank"], "accountNumber" | "accountMasked"> & { accountNumber: string; accountNumberConfirm: string };
  declaration: { accepted: boolean; name: string };
};

/** Whether an encrypted account number is on file, and its masked form. */
export interface InsBankMeta {
  hasAccount: boolean;
  masked: string;
}

export const INS_SECTIONS = ["contact", "company", "registration", "regulatory", "branches", "bank", "documents", "declaration"] as const;
export type InsSection = (typeof INS_SECTIONS)[number];

/** Which sections each step saves. Step 7 holds the uploads and the declaration. */
export const INS_STEP_SECTIONS: Record<InsStepKey, InsSection[]> = {
  contact: ["contact"],
  company: ["company"],
  registration: ["registration"],
  regulatory: ["regulatory"],
  branches: ["branches"],
  bank: ["bank"],
  documents: ["documents", "declaration"],
};

export const INS_STEP_KEYS = INS_STEPS.map((s) => s.key) as [InsStepKey, ...InsStepKey[]];
export const insStepNumber = (key: InsStepKey): number => INS_STEPS.find((s) => s.key === key)!.n;
export const insStepByKey = (key: string) => INS_STEPS.find((s) => s.key === key);
export const isInsStepKey = (v: string): v is InsStepKey => INS_STEPS.some((s) => s.key === v);

/** Short labels for buttons ("Next: Company"). */
export const INS_STEP_SHORT: Record<InsStepKey, string> = {
  contact: "Contact",
  company: "Company",
  registration: "Registration",
  regulatory: "Regulatory",
  branches: "Branches",
  bank: "Banking",
  documents: "Documents",
};

/* ── Reference lists ────────────────────────────────────────── */

/** The registration types each category usually holds. The vendor may type another. */
export const INS_REGISTRATION_TYPES: Record<InsVendorCategory, string[]> = {
  insurer: ["IRDAI registration as a general insurer", "IRDAI registration as a standalone health insurer"],
  broker: ["IRDAI direct broker (general)", "IRDAI direct broker (life & general)", "IRDAI composite broker"],
  corporate_agent: ["IRDAI corporate agent (general)", "IRDAI corporate agent (composite)"],
  web_aggregator: ["IRDAI web aggregator"],
  imf: ["IRDAI insurance marketing firm"],
  other_intermediary: [],
};

/** What the licence/registration number is called for each category. */
export const INS_LICENCE_LABEL: Record<InsVendorCategory | "", string> = {
  "": "Registration / licence number",
  insurer: "Certificate of registration number",
  broker: "Broker licence number",
  corporate_agent: "Corporate agent registration number",
  web_aggregator: "Web aggregator registration number",
  imf: "IMF registration number",
  other_intermediary: "Registration / licence number",
};

export const INS_CATEGORY_BLURB: Record<InsVendorCategory, string> = {
  insurer: "General insurers that underwrite motor policies under their own name.",
  broker: "Registered brokers placing motor cover with the insurers they work with.",
  corporate_agent: "Corporate agents distributing motor policies for their partner insurers.",
  web_aggregator: "Registered web aggregators that compare and distribute insurer products.",
  imf: "Insurance marketing firms registered to distribute insurance products.",
  other_intermediary: "Other intermediaries holding a current registration with the regulator.",
};

/** How the CIN / registration number field is labelled for each business type. */
export const INS_CIN_LABEL: Record<InsBusinessType | "", { label: string; hint: string; required: boolean }> = {
  "": { label: "CIN / registration number", hint: "CIN, LLPIN or firm registration number.", required: true },
  public_limited: { label: "CIN", hint: "Corporate identity number — 21 characters, starting with L or U.", required: true },
  private_limited: { label: "CIN", hint: "Corporate identity number — 21 characters, starting with U.", required: true },
  llp: { label: "LLPIN", hint: "Your LLP identification number, e.g. AAB-1234.", required: true },
  partnership: { label: "Firm registration number", hint: "As on your partnership registration certificate.", required: true },
  proprietorship: { label: "Registration number (optional)", hint: "Shop & establishment or Udyam number, if you have one.", required: false },
  government: { label: "CIN / statutory registration number", hint: "Your CIN, or the act / notification that constituted the body.", required: true },
  other: { label: "Registration number", hint: "The number on your certificate of registration.", required: true },
};

/* ── Formats ────────────────────────────────────────────────── */

export const todayIST = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const validDate = (v: string) => ISO_DATE.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WEBSITE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i;
const PHONE = /^(?:[6-9]\d{9}|0\d{9,11}|1800\d{6,7})$/;
const CIN = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;
const LLPIN = /^[A-Z]{3}-\d{4}$/;
const LICENCE = /^[A-Za-z0-9][A-Za-z0-9 ./\-]{2,59}$/;

export const emailOk = (v: string) => EMAIL.test(v.trim());
export const mobileOk = (v: string) => PATTERNS.mobile.test(normaliseMobile(v));
/** A mobile, a landline with its STD code or a toll-free number. */
export const phoneOk = (v: string) => {
  const d = digitsOnly(v);
  return PHONE.test(d) || PHONE.test(normaliseMobile(v)) || (/^91\d{10,11}$/.test(d) && PHONE.test(`0${d.slice(2)}`));
};
export const gstStateName = (gst: string) => GST_STATE_CODES[gst.slice(0, 2)] ?? null;
const normaliseName = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();

/* ── Draft schemas (autosave) ───────────────────────────────── */

const text = (max: number) => z.string().max(max, `Keep this under ${max} characters`).default("");
const bool = z.boolean().default(false);
export const fileRefSchema = z.object({
  id: z.number().int().positive(),
  filename: z.string().max(200),
  mime: z.string().max(60),
  size: z.number().int().nonnegative(),
});
const maybeFile = fileRefSchema.nullable().default(null);

export const INS_MAX_BRANCHES = 20;
export const INS_MAX_SUPPORTING = 10;

export const insDraftSchemas = {
  contact: z.object({
    name: text(120),
    designation: text(80),
    mobile: text(20),
    mobileVerified: bool,
    email: text(190),
    emailVerified: bool,
  }),
  company: z.object({
    legalName: text(200),
    brandName: text(200),
    businessType: z.enum([...INS_BUSINESS_TYPES, ""]).default(""),
    website: text(200),
    address: text(300),
    city: text(64),
    state: text(64),
    pin: text(6),
  }),
  registration: z.object({ gstin: text(15), pan: text(10), cin: text(40), establishedOn: text(10) }),
  regulatory: z.object({
    category: z.enum([...INS_VENDOR_CATEGORIES, ""]).default(""),
    registrationType: text(120),
    licenceNumber: text(60),
    licenceValidUntil: text(10),
    representative: z.object({ name: text(120), designation: text(80), mobile: text(20), email: text(190) }).default({ name: "", designation: "", mobile: "", email: "" }),
    documents: z.array(fileRefSchema).max(INS_MAX_SUPPORTING, `Up to ${INS_MAX_SUPPORTING} regulatory documents`).default([]),
  }),
  branches: z
    .array(
      z.object({
        key: z.string().min(1).max(40),
        name: text(160),
        address: text(300),
        city: text(64),
        state: text(64),
        pin: text(6),
        phone: text(30),
        email: text(190),
        isPrimary: bool,
      }),
    )
    .max(INS_MAX_BRANCHES, `You can add up to ${INS_MAX_BRANCHES} branches here — add more from your profile after approval`),
  bank: z.object({
    holder: text(120),
    bankName: text(120),
    accountNumber: text(24),
    accountNumberConfirm: text(24),
    ifsc: text(11),
    proof: maybeFile,
  }),
  documents: z.object({
    businessRegistration: maybeFile,
    gst: maybeFile,
    pan: maybeFile,
    regulatory: maybeFile,
    addressProof: maybeFile,
    representativeId: maybeFile,
    representativeAuthorisation: maybeFile,
    supporting: z.array(fileRefSchema).max(INS_MAX_SUPPORTING, `Up to ${INS_MAX_SUPPORTING} supporting documents`).default([]),
  }),
  declaration: z.object({ accepted: bool, name: text(120) }),
} satisfies Record<InsSection, z.ZodType>;

export type InsDraftOf<S extends InsSection> = z.infer<(typeof insDraftSchemas)[S]>;

/* ── Step checks ────────────────────────────────────────────── */

/** What the checks need beyond the section itself. */
export interface InsCheckContext {
  /** True when a code can actually be shown (development); then the contact mobile must be verified. */
  requireVerifiedMobile: boolean;
  /** An encrypted account number is already on file. */
  hasAccount: boolean;
  /** The contact person's name (for the typed declaration). */
  contactName: string;
  businessType: InsBusinessType | "";
}

export const insContextFor = (app: InsWizardApplication, extra: { requireVerifiedMobile: boolean; hasAccount: boolean }): InsCheckContext => ({
  ...extra,
  contactName: app.contact.name,
  businessType: app.company.businessType,
});

const issue = (c: z.RefinementCtx, path: (string | number)[], message: string) => c.addIssue({ code: "custom", path, message });
const filled = (message: string, min = 2) => z.string().refine((v) => v.trim().length >= min, message);
const present = (message: string) => fileRefSchema.nullable().refine((v) => v !== null, message);

const contactStep = (ctx: InsCheckContext) =>
  z
    .object({
      name: filled("Enter the contact person's full name"),
      designation: filled("Enter their designation, e.g. Head of Distribution"),
      mobile: z.string().refine(mobileOk, "Enter a valid 10-digit Indian mobile number"),
      mobileVerified: z.boolean(),
      email: z.string().refine(emailOk, "Enter a valid work email address"),
      emailVerified: z.boolean(),
    })
    .superRefine((p, c) => {
      if (ctx.requireVerifiedMobile && mobileOk(p.mobile) && !p.mobileVerified) issue(c, ["mobile"], "Verify this mobile number with the code we send");
    });

const companyStep = z.object({
  legalName: filled("Enter the legal name exactly as on your certificate of incorporation"),
  brandName: filled("Enter the name customers will see, e.g. your trading name"),
  businessType: z.string().refine((v) => (INS_BUSINESS_TYPES as readonly string[]).includes(v), "Choose your business type"),
  website: z.string().refine((v) => !v.trim() || WEBSITE.test(v.trim()), "Enter a valid website, e.g. https://yourcompany.in"),
  address: filled("Enter the full registered office address", 8),
  city: filled("Choose the city"),
  state: z.string().refine((v) => (INDIAN_STATES as readonly string[]).includes(v), "Choose the state"),
  pin: z.string().refine((v) => PATTERNS.pin.test(v.trim()), "Enter a valid 6-digit PIN code"),
});

const registrationStep = (ctx: InsCheckContext) =>
  z
    .object({
      gstin: z.string().refine((v) => PATTERNS.gst.test(normaliseCode(v)), "Enter a valid 15-character GSTIN, e.g. 27ABCDE1234F1Z5"),
      pan: z.string().refine((v) => PATTERNS.pan.test(normaliseCode(v)), "Enter a valid PAN, e.g. ABCDE1234F"),
      cin: z.string(),
      establishedOn: z.string().refine(validDate, "Choose the date your company was established"),
    })
    .superRefine((r, c) => {
      const gst = normaliseCode(r.gstin);
      const pan = normaliseCode(r.pan);
      const cin = normaliseCode(r.cin);
      if (PATTERNS.gst.test(gst) && !GST_STATE_CODES[gst.slice(0, 2)]) issue(c, ["gstin"], "The first two digits of a GSTIN are a state code — this one isn't recognised");
      if (PATTERNS.gst.test(gst) && PATTERNS.pan.test(pan) && gst.slice(2, 12) !== pan) issue(c, ["pan"], "This PAN doesn't match the one inside your GSTIN (characters 3–12)");
      const rule = INS_CIN_LABEL[ctx.businessType];
      if (ctx.businessType === "public_limited" || ctx.businessType === "private_limited") {
        if (!CIN.test(cin)) issue(c, ["cin"], "Enter a valid 21-character CIN, e.g. U66000MH2015PLC123456");
        else if (ctx.businessType === "private_limited" && cin[0] !== "U") issue(c, ["cin"], "A private limited company's CIN starts with U");
      } else if (ctx.businessType === "llp") {
        if (!LLPIN.test(cin)) issue(c, ["cin"], "Enter a valid LLPIN, e.g. AAB-1234");
      } else if (rule.required && r.cin.trim().length < 4) issue(c, ["cin"], `Enter your ${rule.label.replace(" (optional)", "")}`);
      if (validDate(r.establishedOn) && r.establishedOn > todayIST()) issue(c, ["establishedOn"], "This date is in the future");
      else if (validDate(r.establishedOn) && r.establishedOn < "1850-01-01") issue(c, ["establishedOn"], "Check the year");
    });

const regulatoryStep = z
  .object({
    category: z.string().refine((v) => (INS_VENDOR_CATEGORIES as readonly string[]).includes(v), "Choose what kind of regulated entity you are"),
    registrationType: filled("Choose or type your regulatory registration type", 3),
    licenceNumber: z.string().refine((v) => LICENCE.test(v.trim()), "Enter the registration / licence number exactly as on your certificate"),
    licenceValidUntil: z.string().refine(validDate, "Enter the date your registration is valid until"),
    representative: z.object({
      name: filled("Enter the authorised representative's name"),
      designation: filled("Enter their designation, e.g. Principal Officer"),
      mobile: z.string().refine(mobileOk, "Enter a valid 10-digit mobile number"),
      email: z.string().refine(emailOk, "Enter a valid email address"),
    }),
    documents: z.array(fileRefSchema).max(INS_MAX_SUPPORTING, `Up to ${INS_MAX_SUPPORTING} regulatory documents`),
  })
  .superRefine((r, c) => {
    if (validDate(r.licenceValidUntil) && r.licenceValidUntil <= todayIST()) issue(c, ["licenceValidUntil"], "Your registration must be valid beyond today — renew it before applying");
  });

const branchStep = z.object({
  key: z.string(),
  name: filled("Enter the branch name, e.g. Head office"),
  address: filled("Enter the full street address", 8),
  city: filled("Choose the city"),
  state: z.string().refine((v) => (INDIAN_STATES as readonly string[]).includes(v), "Choose the state"),
  pin: z.string().refine((v) => PATTERNS.pin.test(v.trim()), "Enter a valid 6-digit PIN code"),
  phone: z.string().refine((v) => !v.trim() || phoneOk(v), "Enter a valid phone number with STD code, or a mobile number"),
  email: z.string().refine((v) => !v.trim() || emailOk(v), "Enter a valid email address"),
  isPrimary: z.boolean(),
});

const branchesStep = z
  .array(branchStep)
  .min(1, "Add at least one office — your head office or registered office counts")
  .max(INS_MAX_BRANCHES)
  .superRefine((list, c) => {
    if (list.length && list.filter((b) => b.isPrimary).length !== 1) issue(c, [], "Choose exactly one primary branch");
  });

const bankStep = (ctx: InsCheckContext) =>
  z
    .object({
      holder: filled("Enter the account holder's name as printed on the cheque or statement"),
      bankName: filled("Enter the bank's name"),
      accountNumber: z.string(),
      accountNumberConfirm: z.string(),
      ifsc: z.string().refine((v) => PATTERNS.ifsc.test(normaliseCode(v)), "Enter a valid 11-character IFSC, e.g. HDFC0001234"),
      proof: present("Upload a cancelled cheque or a recent bank statement"),
    })
    .superRefine((b, c) => {
      const acct = digitsOnly(b.accountNumber);
      const changing = Boolean(b.accountNumber.trim() || b.accountNumberConfirm.trim());
      if (ctx.hasAccount && !changing) return;
      if (!PATTERNS.account.test(acct)) issue(c, ["accountNumber"], "Enter a valid account number (9–18 digits)");
      else if (acct !== digitsOnly(b.accountNumberConfirm)) issue(c, ["accountNumberConfirm"], "The account numbers don't match");
    });

const documentsStep = z.object({
  // "GST certificate" keeps its acronym; "Company PAN" → "the company PAN".
  ...Object.fromEntries(INS_REQUIRED_DOCUMENTS.map((d) => [d.key, present(`Upload the ${/^[A-Z]{2}/.test(d.label) ? d.label : d.label.charAt(0).toLowerCase() + d.label.slice(1)}`)])),
  supporting: z.array(fileRefSchema).max(INS_MAX_SUPPORTING, `Up to ${INS_MAX_SUPPORTING} supporting documents`),
});

const declarationStep = (ctx: InsCheckContext) =>
  z
    .object({
      accepted: z.boolean().refine((v) => v, "Confirm the declaration to submit"),
      name: filled("Type the contact person's full name"),
    })
    .superRefine((d, c) => {
      if (d.name.trim().length >= 2 && normaliseName(d.name) !== normaliseName(ctx.contactName))
        issue(c, ["name"], `Type the name exactly as given in step 1 (${ctx.contactName.trim() || "the contact person's full name"})`);
    });

const errorsOf = (r: { success: boolean; error?: z.ZodError }, prefix = ""): FieldErrors => {
  if (r.success || !r.error) return {};
  const e = zodErrors(r.error);
  return prefix ? Object.fromEntries(Object.entries(e).map(([k, v]) => [k === "form" ? prefix.slice(0, -1) : `${prefix}${k}`, v])) : e;
};

/** Everything needed to leave a step (step 7: the uploads and the declaration). Returns {} when complete. */
export function insCheckStep(step: InsStepKey, app: InsWizardApplication, ctx: InsCheckContext): FieldErrors {
  switch (step) {
    case "contact":
      return errorsOf(contactStep(ctx).safeParse(app.contact));
    case "company":
      return errorsOf(companyStep.safeParse(app.company));
    case "registration":
      return errorsOf(registrationStep(ctx).safeParse(app.registration));
    case "regulatory":
      return errorsOf(regulatoryStep.safeParse(app.regulatory));
    case "branches":
      return errorsOf(branchesStep.safeParse(app.branches));
    case "bank":
      return errorsOf(bankStep(ctx).safeParse(app.bank));
    case "documents":
      return { ...errorsOf(documentsStep.safeParse(app.documents)), ...errorsOf(declarationStep(ctx).safeParse(app.declaration), "declaration.") };
  }
}

/** Only the uploads of step 7 (the review lists the declaration separately). */
export const insCheckDocuments = (app: InsWizardApplication): FieldErrors => errorsOf(documentsStep.safeParse(app.documents));

/** Steps 1–6 plus the step-7 uploads, with their problems — for the review summary and the final submit. */
export function insCheckApplication(app: InsWizardApplication, ctx: InsCheckContext) {
  return INS_STEPS.map((s) => ({ key: s.key as InsStepKey, title: s.title, errors: s.key === "documents" ? insCheckDocuments(app) : insCheckStep(s.key, app, ctx) }));
}

/* ── Files: which ones the application uses, and staff reviews ── */

/** Every private file the application references, in display order. */
export function insReferencedFiles(app: Pick<InsWizardApplication, "regulatory" | "bank" | "documents">): FileRef[] {
  const out: FileRef[] = [];
  INS_REQUIRED_DOCUMENTS.forEach((d) => app.documents[d.key] && out.push(app.documents[d.key]!));
  app.regulatory.documents.forEach((f) => out.push(f));
  if (app.bank.proof) out.push(app.bank.proof);
  app.documents.supporting.forEach((f) => out.push(f));
  return out;
}

/** A document MarchGear rejected must be replaced before resubmitting. */
export function insRejectedFileErrors(step: InsStepKey, app: InsWizardApplication, reviews: Record<number, FileReview>): FieldErrors {
  const e: FieldErrors = {};
  const check = (key: string, f: FileRef | null | undefined) => {
    const r = f ? reviews[f.id] : undefined;
    if (r?.status === "rejected") e[key] ??= `This file was rejected${r.remarks ? ` — ${trimStop(r.remarks)}` : ""}. Upload a new one.`;
  };
  if (step === "documents") {
    INS_REQUIRED_DOCUMENTS.forEach((d) => check(d.key, app.documents[d.key]));
    app.documents.supporting.forEach((f, i) => check(`supporting.${i}`, f));
  }
  if (step === "regulatory") app.regulatory.documents.forEach((f, i) => check(`documents.${i}`, f));
  if (step === "bank") check("proof", app.bank.proof);
  return e;
}

/* ── Staff corrections → the step they belong to ────────────── */

export interface InsCorrection {
  text: string;
  step: InsStepKey;
}

const capitalise = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

const PREFIX: Record<string, InsStepKey> = {
  contact: "contact",
  company: "company",
  registration: "registration",
  business: "registration",
  regulatory: "regulatory",
  licence: "regulatory",
  branch: "branches",
  branches: "branches",
  bank: "bank",
  banking: "bank",
  document: "documents",
  documents: "documents",
  declaration: "documents",
};

const RULES: [RegExp, InsStepKey][] = [
  [/\b(bank|ifsc|account (number|holder)|cheque|bank statement|bank proof)\b/i, "bank"],
  [/\b(document|proof|certificate|upload|scan|copy|pdf|board resolution|authori[sz]ation letter)\b/i, "documents"],
  [/\b(licen[cs]e|irdai|regulat\w*|registration type|category|intermediary|broker|corporate agent|aggregator|representative|principal officer)\b/i, "regulatory"],
  [/\b(gst|gstin|pan|cin|llpin|incorporation|establish\w*)\b/i, "registration"],
  [/\b(branch|branches|office(s)?)\b/i, "branches"],
  [/\b(legal name|brand name|trading name|business type|website|registered address|address|city|state|pin ?code)\b/i, "company"],
  [/\b(mobile|phone|email|designation|contact person|contact)\b/i, "contact"],
  [/\b(signature|declaration|terms)\b/i, "documents"],
];

/**
 * Which step a staff correction is about. Staff can be explicit — "bank: …", "documents: …", "step 4: …" —
 * otherwise keywords decide (falling back to the documents step, where everything is reviewed).
 */
export function insCorrectionStep(text: string): InsCorrection {
  const m = /^\s*(?:step\s*(\d)|([a-z-]+))\s*[:—–-]\s+([\s\S]+)$/i.exec(text);
  if (m) {
    const byNumber = m[1] ? INS_STEPS.find((s) => s.n === Number(m[1]))?.key : undefined;
    const byName = m[2] ? (PREFIX[m[2].toLowerCase()] ?? INS_STEPS.find((s) => s.key === m[2].toLowerCase())?.key) : undefined;
    const step = byNumber ?? byName;
    if (step) return { step, text: capitalise(m[3].trim()) };
  }
  for (const [re, step] of RULES) if (re.test(text)) return { step, text: text.trim() };
  return { step: "documents", text: text.trim() };
}

export const insCorrectionsFor = (list: string[] | null | undefined): InsCorrection[] =>
  (list ?? []).filter((t) => typeof t === "string" && t.trim()).map((t) => insCorrectionStep(t));
