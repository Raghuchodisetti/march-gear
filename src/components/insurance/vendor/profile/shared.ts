import type { FileReviewStatus } from "@/db/enums";
import { INS_REQUIRED_DOCUMENTS } from "@/insurance/application";
import type { FileRef, InsurerApplication, InsurerProfile } from "@/insurance/types";

/* ──────────────────────────────────────────────────────────────
   Company profile — the verified fields a vendor may ask MarchGear
   to change (dotted paths into the application) and the KYC
   document slots. Client-safe.
   ────────────────────────────────────────────────────────────── */

export const CHANGE_FIELDS = [
  "company.legalName",
  "company.brandName",
  "company.businessType",
  "company.address",
  "registration.gstin",
  "registration.pan",
  "registration.cin",
  "regulatory.category",
  "regulatory.registrationType",
  "regulatory.licenceNumber",
  "regulatory.licenceValidUntil",
  "bank.holder",
  "bank.bankName",
  "bank.accountNumber",
  "bank.ifsc",
] as const;
export type ChangeField = (typeof CHANGE_FIELDS)[number];

export const CHANGE_LABEL: Record<ChangeField, string> = {
  "company.legalName": "Legal name",
  "company.brandName": "Brand name",
  "company.businessType": "Business type",
  "company.address": "Registered address",
  "registration.gstin": "GSTIN",
  "registration.pan": "PAN",
  "registration.cin": "CIN / LLPIN",
  "regulatory.category": "Regulatory category",
  "regulatory.registrationType": "Registration type",
  "regulatory.licenceNumber": "Licence / registration number",
  "regulatory.licenceValidUntil": "Licence valid until",
  "bank.holder": "Account holder",
  "bank.bankName": "Bank",
  "bank.accountNumber": "Account number",
  "bank.ifsc": "IFSC",
};

/** A string value at a dotted path of the application ("" when missing). */
export function readPath(app: InsurerApplication, path: string): string {
  let cur: unknown = app;
  for (const k of path.split(".")) cur = cur && typeof cur === "object" ? (cur as Record<string, unknown>)[k] : undefined;
  return cur === null || cur === undefined ? "" : String(cur);
}

export interface DocSlot {
  path: string;
  label: string;
  file: FileRef;
  /** Points this slot at another file (mutates the application it came from). */
  assign: (f: FileRef) => void;
}

/** Every uploaded KYC document in the application, with a stable path for replacing it. */
export function docSlots(app: InsurerApplication): DocSlot[] {
  const out: DocSlot[] = [];
  const d = app.documents;
  for (const r of INS_REQUIRED_DOCUMENTS) {
    const f = d[r.key];
    if (f) out.push({ path: `documents.${r.key}`, label: r.label, file: f, assign: (x) => (d[r.key] = x) });
  }
  (d.supporting ?? []).forEach((f, i) => f && out.push({ path: `documents.supporting.${i}`, label: `Supporting document ${i + 1}`, file: f, assign: (x) => (d.supporting[i] = x) }));
  (app.regulatory.documents ?? []).forEach((f, i) => f && out.push({ path: `regulatory.documents.${i}`, label: `Regulatory document ${i + 1}`, file: f, assign: (x) => (app.regulatory.documents[i] = x) }));
  if (app.bank.proof) out.push({ path: "bank.proof", label: "Bank proof (cancelled cheque / statement)", file: app.bank.proof, assign: (x) => (app.bank.proof = x) });
  return out;
}

export interface DocView {
  path: string;
  label: string;
  kind: string;
  file: FileRef;
  status: FileReviewStatus;
  remarks: string | null;
  uploadedAt: string | null;
}

export const emptyInsurerProfile = (): InsurerProfile => ({ logo: "", about: "", website: "", supportPhone: "", supportEmail: "", claimsPhone: "", claimsEmail: "", supportHours: "" });

export interface ChangeRequestView {
  id: number;
  status: "pending" | "approved" | "rejected";
  fields: { key: string; label: string; from: string; to: string }[];
  reason: string | null;
  remarks: string | null;
  requestedBy: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface BranchView {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  pin: string;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
}
