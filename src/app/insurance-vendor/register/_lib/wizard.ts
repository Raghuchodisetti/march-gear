import "server-only";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { insFiles } from "@/db/schema";
import { INS_VENDOR_CATEGORIES, type InsVendorCategory } from "@/db/enums";
import { INS_REQUIRED_DOCUMENTS, INS_STEPS, emptyInsurerApplication, type InsStepKey } from "@/insurance/application";
import { INS_VENDOR_EDITABLE, INS_VENDOR_STATUS_LABEL } from "@/insurance/labels";
import {
  PATTERNS,
  digitsOnly,
  insCorrectionsFor,
  insDraftSchemas,
  insReferencedFiles,
  insStepNumber,
  normaliseCode,
  normaliseMobile,
  validDate,
  type FileReview,
  type InsBankMeta,
  type InsDraftOf,
  type InsSection,
  type InsWizardApplication,
} from "@/insurance/schemas";
import type { FileRef, InsurerApplication } from "@/insurance/types";
import { otpDelivery } from "@/server/partner/application";
import { encryptField, maskAccount } from "@/server/partner/crypto";
import { requireInsurer, type VendorRow } from "@/server/insurance/context";

/* ──────────────────────────────────────────────────────────────
   Server side of the insurance vendor registration wizard: the
   browser's view of ins_vendors.application (bank number stripped),
   merging autosaved sections back in (file ownership re-checked,
   verification and encryption server-controlled) and loading a step.
   ────────────────────────────────────────────────────────────── */

export const insEditable = (v: Pick<VendorRow, "status">) => INS_VENDOR_EDITABLE.includes(v.status);
export const clampStep = (n: number) => Math.min(INS_STEPS.length, Math.max(1, Math.trunc(n) || 1));
export const furthestKey = (v: Pick<VendorRow, "step">): InsStepKey => INS_STEPS[clampStep(v.step) - 1].key;

/* ── Stored JSON ⇄ the wizard's view ────────────────────────── */

function section<S extends InsSection>(s: S, value: unknown, fallback: InsDraftOf<S>): InsDraftOf<S> {
  const r = insDraftSchemas[s].safeParse(value ?? fallback);
  return (r.success ? r.data : fallback) as InsDraftOf<S>;
}

/** The application as the browser may see it: no account number, defaults filled in. */
export function toWizard(stored: InsurerApplication): { app: InsWizardApplication; bank: InsBankMeta } {
  const empty = emptyInsurerApplication({ name: stored.contact?.name, email: stored.contact?.email, mobile: stored.contact?.mobile });
  const account = stored.bank?.accountNumber ?? "";
  const app: InsWizardApplication = {
    contact: section("contact", stored.contact, empty.contact),
    company: section("company", stored.company, empty.company),
    registration: section("registration", stored.registration, empty.registration),
    regulatory: section("regulatory", stored.regulatory, empty.regulatory),
    branches: section("branches", stored.branches, []),
    bank: section(
      "bank",
      { holder: stored.bank?.holder ?? "", bankName: stored.bank?.bankName ?? "", ifsc: stored.bank?.ifsc ?? "", proof: stored.bank?.proof ?? null, accountNumber: "", accountNumberConfirm: "" },
      { holder: "", bankName: "", ifsc: "", proof: null, accountNumber: "", accountNumberConfirm: "" },
    ),
    documents: section("documents", stored.documents, empty.documents),
    declaration: section("declaration", { accepted: stored.declaration?.accepted ?? false, name: stored.declaration?.name ?? "" }, { accepted: false, name: "" }),
  };
  return { app, bank: { hasAccount: Boolean(account), masked: account ? maskAccount(account) : "" } };
}

/** Columns kept in step with the application for admin lists and search. */
export function denormalise(app: InsurerApplication) {
  const cut = (v: string | undefined, n: number) => (v?.trim() ? v.trim().slice(0, n) : null);
  const primary = app.branches.find((b) => b.isPrimary) ?? app.branches[0];
  const category = app.regulatory.category;
  const until = app.regulatory.licenceValidUntil;
  return {
    category: (INS_VENDOR_CATEGORIES as readonly string[]).includes(category) ? (category as InsVendorCategory) : null,
    legalName: cut(app.company.legalName, 200),
    brandName: cut(app.company.brandName, 200),
    city: cut(app.company.city || primary?.city, 64),
    state: cut(app.company.state || primary?.state, 64),
    gst: cut(app.registration.gstin, 20),
    licenceNumber: cut(app.regulatory.licenceNumber, 60),
    licenceValidUntil: validDate(until) ? until : null,
  };
}

/* ── Ownership checks for files ─────────────────────────────── */

const DOC_KIND = Object.fromEntries(INS_REQUIRED_DOCUMENTS.map((d) => [d.key, d.kind])) as Record<(typeof INS_REQUIRED_DOCUMENTS)[number]["key"], string>;

function collectFiles(s: InsSection, d: unknown): number[] {
  const ids: number[] = [];
  if (s === "regulatory") (d as InsDraftOf<"regulatory">).documents.forEach((f) => ids.push(f.id));
  if (s === "bank") {
    const b = d as InsDraftOf<"bank">;
    if (b.proof) ids.push(b.proof.id);
  }
  if (s === "documents") {
    const docs = d as InsDraftOf<"documents">;
    INS_REQUIRED_DOCUMENTS.forEach((r) => docs[r.key] && ids.push(docs[r.key]!.id));
    docs.supporting.forEach((f) => ids.push(f.id));
  }
  return ids;
}

/** Replaces client-sent file refs with the vendor's own ins_files rows (right kind only); dedupes branch keys. */
export async function sanitise<S extends InsSection>(vendorId: number, s: S, data: InsDraftOf<S>): Promise<InsDraftOf<S>> {
  const ids = collectFiles(s, data);
  const rows = ids.length
    ? await getDb()
        .select({ id: insFiles.id, kind: insFiles.kind, filename: insFiles.filename, mime: insFiles.mime, size: insFiles.size })
        .from(insFiles)
        .where(and(eq(insFiles.vendorId, vendorId), inArray(insFiles.id, ids)))
    : [];
  const files = new Map(rows.map((f) => [f.id, f]));
  const file = (ref: FileRef | null | undefined, kinds: string[]): FileRef | null => {
    const row = ref ? files.get(ref.id) : undefined;
    return row && kinds.includes(row.kind) ? { id: row.id, filename: row.filename, mime: row.mime, size: row.size } : null;
  };
  const list = (refs: FileRef[], kinds: string[]) => {
    const seen = new Set<number>();
    return refs.map((f) => file(f, kinds)).filter((f): f is FileRef => f !== null && !seen.has(f.id) && Boolean(seen.add(f.id)));
  };

  switch (s) {
    case "regulatory": {
      const r = data as InsDraftOf<"regulatory">;
      return { ...r, documents: list(r.documents, ["regulatory_licence", "supporting"]) } as InsDraftOf<S>;
    }
    case "bank": {
      const b = data as InsDraftOf<"bank">;
      return { ...b, proof: file(b.proof, ["bank_proof"]) } as InsDraftOf<S>;
    }
    case "documents": {
      const d = data as InsDraftOf<"documents">;
      const out = { ...d } as InsDraftOf<"documents">;
      INS_REQUIRED_DOCUMENTS.forEach((r) => (out[r.key] = file(d[r.key], [DOC_KIND[r.key]])));
      out.supporting = list(d.supporting, ["supporting"]);
      return out as InsDraftOf<S>;
    }
    case "branches": {
      const seen = new Set<string>();
      return (data as InsDraftOf<"branches">).map((b) => {
        let key = b.key;
        while (seen.has(key)) key = `${b.key}-${seen.size}`;
        seen.add(key);
        return { ...b, key };
      }) as InsDraftOf<S>;
    }
    default:
      return data;
  }
}

/* ── Merging an autosaved section ───────────────────────────── */

/** Puts one section back into the stored document. Verification flags, the encrypted account and the declaration time are server-controlled. */
export function mergeSection<S extends InsSection>(stored: InsurerApplication, s: S, data: InsDraftOf<S>): { app: InsurerApplication; accountSaved: boolean } {
  const app: InsurerApplication = structuredClone(stored);
  let accountSaved = false;
  switch (s) {
    case "contact": {
      const c = data as InsDraftOf<"contact">;
      const sameMobile = normaliseMobile(c.mobile) === normaliseMobile(stored.contact?.mobile ?? "");
      const sameEmail = c.email.trim().toLowerCase() === (stored.contact?.email ?? "").trim().toLowerCase();
      app.contact = {
        name: c.name,
        designation: c.designation,
        mobile: c.mobile.trim(),
        mobileVerified: sameMobile && Boolean(stored.contact?.mobileVerified),
        email: c.email.trim(),
        emailVerified: sameEmail && Boolean(stored.contact?.emailVerified),
      };
      break;
    }
    case "company": {
      const c = data as InsDraftOf<"company">;
      app.company = { ...c, pin: digitsOnly(c.pin) };
      break;
    }
    case "registration": {
      const r = data as InsDraftOf<"registration">;
      app.registration = { gstin: normaliseCode(r.gstin), pan: normaliseCode(r.pan), cin: r.cin.trim().toUpperCase(), establishedOn: r.establishedOn };
      break;
    }
    case "regulatory": {
      const r = data as InsDraftOf<"regulatory">;
      app.regulatory = { ...r, representative: { ...r.representative } };
      break;
    }
    case "branches":
      app.branches = (data as InsDraftOf<"branches">).map((b) => ({ ...b, pin: digitsOnly(b.pin) }));
      break;
    case "bank": {
      const b = data as InsDraftOf<"bank">;
      const typed = digitsOnly(b.accountNumber);
      let accountNumber = stored.bank?.accountNumber ?? "";
      if (PATTERNS.account.test(typed) && typed === digitsOnly(b.accountNumberConfirm)) {
        accountNumber = encryptField(typed);
        accountSaved = true;
      }
      app.bank = { holder: b.holder, bankName: b.bankName, accountNumber, accountMasked: accountNumber ? maskAccount(accountNumber) : "", ifsc: normaliseCode(b.ifsc), proof: b.proof };
      break;
    }
    case "documents":
      app.documents = { ...(data as InsDraftOf<"documents">) };
      break;
    case "declaration": {
      const d = data as InsDraftOf<"declaration">;
      app.declaration = { accepted: d.accepted, name: d.name, acceptedAt: stored.declaration?.acceptedAt ?? null };
      break;
    }
  }
  return { app, accountSaved };
}

/* ── File review states (after staff checked documents) ─────── */

export async function fileReviews(vendorId: number, ids: number[]): Promise<Record<number, FileReview>> {
  if (!ids.length) return {};
  const rows = await getDb()
    .select({ id: insFiles.id, status: insFiles.status, remarks: insFiles.remarks })
    .from(insFiles)
    .where(and(eq(insFiles.vendorId, vendorId), inArray(insFiles.id, ids)));
  return Object.fromEntries(rows.map((r) => [r.id, { status: r.status, remarks: r.remarks }]));
}

/* ── Loading a wizard step (pages) ──────────────────────────── */

export async function loadWizard(step: InsStepKey) {
  const ctx = await requireInsurer({ approved: false, next: `/insurance-vendor/register/${step}` });
  const { vendor } = ctx;
  if (!insEditable(vendor) || !ctx.can("profile.manage")) redirect("/insurance-vendor/application-status");
  const furthest = clampStep(vendor.step);
  if (insStepNumber(step) > furthest) redirect(`/insurance-vendor/register/${furthestKey(vendor)}`);

  const { app, bank } = toWizard(vendor.application);
  const reviews = await fileReviews(
    vendor.id,
    insReferencedFiles(app).map((f) => f.id),
  );
  const resubmission = vendor.status !== "draft";
  return {
    ctx,
    props: {
      step,
      reference: vendor.reference,
      status: vendor.status,
      statusLabel: INS_VENDOR_STATUS_LABEL[vendor.status],
      resubmission,
      furthest,
      app,
      bank,
      otp: otpDelivery(),
      savedAt: vendor.updatedAt.toISOString(),
      remarks: resubmission ? (vendor.adminRemarks ?? null) : null,
      corrections: resubmission ? insCorrectionsFor(vendor.requiredCorrections) : [],
      reviews,
      /** For the e-signature line, in IST. */
      today: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }),
    },
  };
}

export type InsWizardProps = Awaited<ReturnType<typeof loadWizard>>["props"];
