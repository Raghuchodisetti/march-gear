"use server";

import { z } from "zod";
import { and, count, eq, isNull, like, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { INS_VENDOR_CATEGORIES, insBranches, insChangeRequests, insCompanies, insFiles, insVendors, type InsVendorStatus } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { slugify } from "@/lib/utils";
import { INS_DOC_KIND_LABEL, INS_VENDOR_STATUS_LABEL } from "@/insurance/labels";
import type { InsurerApplication } from "@/insurance/types";
import { PATTERNS } from "@/partner/application";
import { audit } from "@/server/audit";
import { requireStaff } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { notifyInsurer, recordInsApproval } from "@/server/insurance/records";
import { decryptField, encryptField, maskAccount } from "@/server/partner/crypto";
import { invalid } from "@/server/validation";
import { addDays, istDate } from "@/components/portal/billing/shared";
import { INS_KYC_DOC_KINDS, insFieldLabel as fieldLabel, insVendorName, splitInsCorrection } from "@/components/admin/insurance/ui";

/* ──────────────────────────────────────────────────────────────
   Staff decisions on insurance vendor accounts: the application
   review, suspension, documents, change requests, bank reveals and
   internal notes. Every decision is written to the approval
   history (shown to the vendor unless it's an internal note),
   notifies the vendor and is recorded in the admin activity log.
   ────────────────────────────────────────────────────────────── */

const RACE = "Someone else just updated this. Refresh to see the latest and try again.";
const id = z.coerce.number().int().positive();
const optionalRemarks = z
  .string()
  .trim()
  .max(2000, "Keep this under 2000 characters")
  .optional()
  .transform((v) => v || null);
const requiredRemarks = (message: string) => z.string({ error: message }).trim().min(5, message).max(2000, "Keep this under 2000 characters");
const correctionList = z
  .array(z.string().trim().min(3, "Describe the correction").max(300, "Keep each item under 300 characters"))
  .min(1, "Add at least one item")
  .max(20, "Add at most 20 items");

type Vendor = typeof insVendors.$inferSelect;
const touch = () => {
  revalidatePath("/admin", "layout");
  revalidatePath("/insurance", "layout");
};
/** "1 Dec 2026" in IST. */
const day = (iso: string) => new Date(`${iso}T00:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
const docName = (k: keyof typeof INS_DOC_KIND_LABEL) => INS_DOC_KIND_LABEL[k].replace(/^([A-Z])(?![A-Z])/, (c) => c.toLowerCase());
const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

async function loadVendor(vendorId: unknown): Promise<Vendor | null> {
  const vid = id.safeParse(vendorId);
  if (!vid.success) return null;
  const [v] = await getDb().select().from(insVendors).where(eq(insVendors.id, vid.data));
  return v ?? null;
}

/* ── Application decisions ──────────────────────────────────── */

const vendorDecision = z.discriminatedUnion("op", [
  z.object({ op: z.literal("under_review"), remarks: optionalRemarks }),
  z.object({ op: z.literal("request_changes"), corrections: correctionList, remarks: optionalRemarks }),
  z.object({
    op: z.literal("request_documents"),
    documents: z.array(z.enum(INS_KYC_DOC_KINDS)).max(INS_KYC_DOC_KINDS.length).default([]),
    /** Anything else to upload, one item each. */
    extra: z.array(z.string().trim().min(3, "Describe the document").max(300, "Keep each item under 300 characters")).max(10).default([]),
    remarks: optionalRemarks,
  }),
  z.object({
    op: z.literal("approve"),
    /** Insurers only: "create" a company from the application, or the id of an existing unlinked company. */
    company: z.string().trim().max(20).optional(),
    remarks: optionalRemarks,
  }),
  z.object({ op: z.literal("reject"), remarks: requiredRemarks("Tell the vendor why the application was rejected (at least 5 characters)") }),
]);
type VendorOp = z.infer<typeof vendorDecision>["op"];

const DECIDE_FROM: Record<VendorOp, InsVendorStatus[]> = {
  under_review: ["submitted", "pending_approval"],
  request_changes: ["submitted", "pending_approval", "under_review", "documents_required"],
  request_documents: ["submitted", "pending_approval", "under_review", "changes_requested"],
  approve: ["submitted", "pending_approval", "under_review", "documents_required", "changes_requested"],
  reject: ["submitted", "pending_approval", "under_review", "documents_required", "changes_requested"],
};
const DECIDE_TO: Record<VendorOp, InsVendorStatus> = {
  under_review: "under_review",
  request_changes: "changes_requested",
  request_documents: "documents_required",
  approve: "approved",
  reject: "rejected",
};

/** A unique company slug from a name ("acme-general", "acme-general-2"…). */
async function freeSlug(name: string) {
  const base = (slugify(name) || "insurer").slice(0, 70);
  const taken = await getDb().select({ slug: insCompanies.slug }).from(insCompanies).where(or(eq(insCompanies.slug, base), like(insCompanies.slug, `${base}-%`)));
  const set = new Set(taken.map((t) => t.slug));
  if (!set.has(base)) return base;
  for (let n = 2; n < 1000; n++) if (!set.has(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${Date.now().toString(36)}`;
}

/** Moves a vendor application through review: under review, corrections, documents, approve, reject. */
export async function vendorDecisionAction(vendorId: unknown, input: unknown): Promise<ActionResult<{ status: InsVendorStatus; companyId: number | null }>> {
  const me = await requireStaff("insurance");
  const parsed = vendorDecision.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = await loadVendor(vendorId);
  if (!v) return { ok: false, error: "This vendor no longer exists." };
  const d = parsed.data;
  if (!DECIDE_FROM[d.op].includes(v.status)) return { ok: false, error: `This application is ${INS_VENDOR_STATUS_LABEL[v.status].toLowerCase()}, so that decision isn't available. Refresh to see the latest.` };

  const db = getDb();
  const app = v.application;
  const to = DECIDE_TO[d.op];
  const name = insVendorName(v);
  const now = new Date();
  let remarks = d.remarks ?? null;
  const set: Partial<typeof insVendors.$inferInsert> = { status: to };
  let note: { title: string; body: string; href: string };

  // Approving an insurer links it to its insurance company — check the choice before changing anything.
  let companyPlan: { kind: "keep"; id: number; name: string } | { kind: "link"; id: number; name: string } | { kind: "create"; name: string } | null = null;
  if (d.op === "approve" && (v.category ?? app.regulatory?.category) === "insurer") {
    const [linked] = await db.select({ id: insCompanies.id, name: insCompanies.name }).from(insCompanies).where(eq(insCompanies.vendorId, v.id)).limit(1);
    if (linked) companyPlan = { kind: "keep", ...linked };
    else if (!d.company || d.company === "create") {
      const companyName = (app.company?.brandName || app.company?.legalName || v.brandName || v.legalName || "").trim();
      if (!companyName) return { ok: false, error: "The application has no company name to create the insurance company from — link an existing company instead.", fieldErrors: { company: "Choose a company to link" } };
      companyPlan = { kind: "create", name: companyName.slice(0, 160) };
    } else {
      const cid = id.safeParse(d.company);
      if (!cid.success) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { company: "Choose a company to link" } };
      const [c] = await db.select({ id: insCompanies.id, name: insCompanies.name, vendorId: insCompanies.vendorId }).from(insCompanies).where(eq(insCompanies.id, cid.data));
      if (!c) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { company: "That company no longer exists" } };
      if (c.vendorId && c.vendorId !== v.id) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { company: `${c.name} is already linked to another vendor` } };
      companyPlan = { kind: "link", id: c.id, name: c.name };
    }
  }

  switch (d.op) {
    case "under_review":
      set.requiredCorrections = null;
      set.adminRemarks = remarks;
      note = { title: "Your application is under review", body: remarks ?? "A MarchGear partner manager is reviewing your application and documents. We'll let you know as soon as there's a decision.", href: "/insurance-vendor/application-status" };
      break;
    case "request_changes": {
      const list = d.corrections;
      set.requiredCorrections = list;
      set.adminRemarks = remarks ?? `Please make ${list.length === 1 ? "this correction" : `these ${list.length} corrections`} and resubmit your application.`;
      remarks = [remarks, ...list.map((c) => `• ${splitInsCorrection(c).text}`)].filter(Boolean).join("\n");
      note = { title: "Corrections needed on your application", body: `${list.length} item${list.length === 1 ? "" : "s"} to fix: ${list.map((c) => splitInsCorrection(c).text).join("; ")}`, href: "/insurance-vendor/application-status" };
      break;
    }
    case "request_documents": {
      if (!d.documents.length && !d.extra.length) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { documents: "Choose at least one document, or describe one below" } };
      // Prefixed with the wizard step so the vendor's "Fix now" link opens the Documents step.
      const list = [...d.documents.map((k) => `documents: Upload your ${docName(k)}`), ...d.extra.map((x) => (splitInsCorrection(x).area ? x : `documents: ${x}`))];
      set.requiredCorrections = list;
      const names = [...d.documents.map((k, i) => (i ? docName(k) : INS_DOC_KIND_LABEL[k])), ...d.extra.map((x) => splitInsCorrection(x).text)];
      set.adminRemarks = remarks ?? `Please upload: ${names.join(", ")}.`;
      note = { title: "Documents needed for your application", body: `${remarks ? `${sentence(remarks)} ` : ""}Please upload: ${names.join(", ")}.`, href: "/insurance-vendor/application-status" };
      remarks = [remarks, `Documents requested: ${names.join(", ")}`].filter(Boolean).join("\n");
      break;
    }
    case "approve": {
      const { insuranceSettings } = (await getCatalog()).content;
      // The insurance billing engine derives the trial from approvedAt + vendorTrialDays and treats an empty
      // planRenewsAt as "trial running" (insPhase / ensureInsBillingState) — setting it here would turn the trial
      // into a free or paid period straight away.
      const trialLastDay = addDays(istDate(now), insuranceSettings.vendorTrialDays - 1);
      Object.assign(set, { approvedAt: now, decidedBy: me.id, planStatus: "trial", planRenewsAt: null, requiredCorrections: null, adminRemarks: remarks });
      note = {
        title: "Welcome to MarchGear — your company is approved",
        body: `${remarks ? `${sentence(remarks)} ` : ""}Your vendor portal is fully unlocked: add products, covers and campaigns for review.${insuranceSettings.vendorTrialDays > 0 ? ` Your free trial runs until ${day(trialLastDay)}.` : ""}`,
        href: "/insurance-vendor/dashboard",
      };
      break;
    }
    case "reject":
      Object.assign(set, { decidedBy: me.id, requiredCorrections: null, adminRemarks: d.remarks });
      note = { title: "Your vendor application was not approved", body: d.remarks, href: "/insurance-vendor/application-status" };
      break;
  }

  const [res] = await db.update(insVendors).set(set).where(and(eq(insVendors.id, v.id), eq(insVendors.status, v.status)));
  if (!res.affectedRows) return { ok: false, error: RACE };
  await recordInsApproval({ vendorId: v.id, target: "vendor", targetId: v.id, action: to, fromStatus: v.status, toStatus: to, remarks, actorUserId: me.id, actorSide: "admin" });

  let companyId: number | null = null;
  let extra = "";
  if (d.op === "approve") {
    // Branch offices from the application become branch records (once).
    const [{ n: branchCount }] = await db.select({ n: count() }).from(insBranches).where(eq(insBranches.vendorId, v.id));
    const fromApp = (app.branches ?? []).filter((b) => b.name?.trim() || b.address?.trim());
    if (branchCount === 0 && fromApp.length) {
      const primaryAt = Math.max(0, fromApp.findIndex((b) => b.isPrimary));
      await db.insert(insBranches).values(
        fromApp.map((b, i) => ({
          vendorId: v.id,
          name: (b.name || `Branch ${i + 1}`).trim().slice(0, 160),
          address: (b.address ?? "").trim().slice(0, 300),
          city: (b.city ?? "").trim().slice(0, 64),
          state: (b.state ?? "").trim().slice(0, 64),
          pin: (b.pin ?? "").replace(/\D/g, "").slice(0, 6),
          phone: b.phone?.trim().slice(0, 30) || null,
          email: b.email?.trim().slice(0, 190) || null,
          isPrimary: i === primaryAt,
        })),
      );
      extra += ` · ${fromApp.length} branch${fromApp.length === 1 ? "" : "es"} created`;
    }

    if (companyPlan) {
      if (companyPlan.kind === "keep") companyId = companyPlan.id;
      else if (companyPlan.kind === "link") {
        const [link] = await db.update(insCompanies).set({ vendorId: v.id }).where(and(eq(insCompanies.id, companyPlan.id), or(isNull(insCompanies.vendorId), eq(insCompanies.vendorId, v.id))));
        if (link.affectedRows) {
          companyId = companyPlan.id;
          await recordInsApproval({ vendorId: v.id, target: "company", targetId: companyPlan.id, action: "linked", remarks: `Linked to the insurance company ${companyPlan.name}`, actorUserId: me.id, actorSide: "admin" });
          await audit(me.id, "update", "ins_company", companyPlan.id, `Linked ${companyPlan.name} to vendor ${name} (${v.reference})`);
          extra += ` · linked to ${companyPlan.name}`;
        }
      } else {
        const website = /^https:\/\//.test(app.company?.website ?? "") ? app.company.website.slice(0, 300) : null;
        const [ins] = await db.insert(insCompanies).values({
          slug: await freeSlug(companyPlan.name),
          name: companyPlan.name,
          website,
          headquarters: app.company?.city?.slice(0, 120) || null,
          vendorId: v.id,
          isActive: true,
        });
        companyId = ins.insertId;
        await recordInsApproval({ vendorId: v.id, target: "company", targetId: companyId, action: "linked", remarks: `Insurance company ${companyPlan.name} created from the application`, actorUserId: me.id, actorSide: "admin" });
        await audit(me.id, "create", "ins_company", companyId, `Created ${companyPlan.name} from vendor ${name} (${v.reference})`);
        extra += ` · created company ${companyPlan.name}`;
      }
    }
  }

  await notifyInsurer(v.id, { kind: "application", ...note });
  await audit(me.id, "status", "ins_vendor", v.id, `${INS_VENDOR_STATUS_LABEL[v.status]} → ${INS_VENDOR_STATUS_LABEL[to]}: ${name} (${v.reference})${extra}`);
  touch();
  return { ok: true, status: to, companyId };
}

/* ── Suspend / reactivate (admins) ──────────────────────────── */

const accountChange = z.object({
  op: z.enum(["suspend", "reactivate"]),
  remarks: z.string().trim().max(2000, "Keep this under 2000 characters").optional().transform((v) => v || null),
});

/** Admins only: suspend an approved vendor (its products leave the public site) or reactivate a suspended one. */
export async function vendorAccountAction(vendorId: unknown, input: unknown): Promise<ActionResult<{ status: InsVendorStatus }>> {
  const me = await requireStaff("admin");
  const parsed = accountChange.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { op, remarks } = parsed.data;
  if (op === "suspend" && (!remarks || remarks.length < 5)) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { remarks: "Give the vendor a reason (at least 5 characters)" } };
  const v = await loadVendor(vendorId);
  if (!v) return { ok: false, error: "This vendor no longer exists." };
  const from: InsVendorStatus = op === "suspend" ? "approved" : "suspended";
  if (v.status !== from) return { ok: false, error: `This vendor is ${INS_VENDOR_STATUS_LABEL[v.status].toLowerCase()}, so it can't be ${op === "suspend" ? "suspended" : "reactivated"}.` };
  const to: InsVendorStatus = op === "suspend" ? "suspended" : "approved";
  const [res] = await getDb()
    .update(insVendors)
    .set({ status: to, decidedBy: me.id, adminRemarks: remarks, ...(op === "reactivate" && !v.approvedAt ? { approvedAt: new Date() } : {}) })
    .where(and(eq(insVendors.id, v.id), eq(insVendors.status, v.status)));
  if (!res.affectedRows) return { ok: false, error: RACE };
  const action = op === "suspend" ? "suspended" : "reactivated";
  await recordInsApproval({ vendorId: v.id, target: "vendor", targetId: v.id, action, fromStatus: v.status, toStatus: to, remarks, actorUserId: me.id, actorSide: "admin" });
  await notifyInsurer(v.id, {
    kind: "account",
    title: op === "suspend" ? "Your company has been suspended on MarchGear" : "Your company is active again",
    body: op === "suspend" ? `${sentence(remarks!)} Your products are hidden from the MarchGear website until the account is reactivated.` : (remarks ?? "Your published products are visible on MarchGear again."),
    href: op === "suspend" ? "/insurance-vendor/application-status" : "/insurance-vendor/dashboard",
  });
  await audit(me.id, "status", "ins_vendor", v.id, `${op === "suspend" ? "Suspended" : "Reactivated"} vendor ${insVendorName(v)} (${v.reference})`);
  touch();
  return { ok: true, status: to };
}

/* ── Bank account, internal notes ───────────────────────────── */

/** Admins only (as for dealers): the full bank account number, decrypted on the server. Every reveal is logged. */
export async function revealInsBankAccountAction(vendorId: unknown): Promise<ActionResult<{ accountNumber: string }>> {
  const me = await requireStaff("insurance");
  if (me.role !== "admin") return { ok: false, error: "Only MarchGear administrators can reveal a full bank account number." };
  const v = await loadVendor(vendorId);
  if (!v) return { ok: false, error: "This vendor no longer exists." };
  const stored = v.application.bank?.accountNumber ?? "";
  if (!stored) return { ok: false, error: "No bank account number on file." };
  let accountNumber: string;
  try {
    accountNumber = decryptField(stored);
  } catch {
    return { ok: false, error: "The stored account number couldn't be decrypted — check PARTNER_DATA_KEY." };
  }
  await audit(me.id, "note", "ins_vendor", v.id, `Revealed the full bank account number of ${insVendorName(v)} (${v.reference})`);
  return { ok: true, accountNumber };
}

/** A staff-only note on a vendor — kept in the approval history, never shown to the vendor. */
export async function addInsInternalNoteAction(vendorId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff("insurance");
  const parsed = z.object({ note: z.string({ error: "Write a note" }).trim().min(2, "Write a note").max(2000, "Keep this under 2000 characters") }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = await loadVendor(vendorId);
  if (!v) return { ok: false, error: "This vendor no longer exists." };
  await recordInsApproval({ vendorId: v.id, target: "vendor", targetId: v.id, action: "internal_note", remarks: parsed.data.note, actorUserId: me.id, actorSide: "admin" });
  await audit(me.id, "note", "ins_vendor", v.id, `Internal note on ${insVendorName(v)} (${v.reference})`);
  return { ok: true };
}

/* ── Documents ──────────────────────────────────────────────── */

const docReview = z.discriminatedUnion("status", [
  z.object({ status: z.literal("verified"), remarks: optionalRemarks }),
  z.object({ status: z.literal("rejected"), remarks: requiredRemarks("Tell the vendor what's wrong with this document (at least 5 characters)") }),
  z.object({ status: z.literal("pending"), remarks: optionalRemarks }),
]);

/** Verify, reject (with a remark) or reset one of a vendor's account documents. */
export async function reviewInsDocumentAction(fileId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff("insurance");
  const parsed = docReview.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const fid = id.safeParse(fileId);
  if (!fid.success) return { ok: false, error: "Document not found" };
  const db = getDb();
  const [f] = await db
    .select({ id: insFiles.id, vendorId: insFiles.vendorId, kind: insFiles.kind, status: insFiles.status, remarks: insFiles.remarks, reference: insVendors.reference, brandName: insVendors.brandName, legalName: insVendors.legalName })
    .from(insFiles)
    .innerJoin(insVendors, eq(insVendors.id, insFiles.vendorId))
    .where(eq(insFiles.id, fid.data));
  if (!f) return { ok: false, error: "This document no longer exists." };
  if (!(INS_KYC_DOC_KINDS as readonly string[]).includes(f.kind)) return { ok: false, error: "Only account documents are reviewed here." };
  const { status, remarks } = parsed.data;
  if (status === f.status && (remarks ?? null) === (f.remarks ?? null)) return { ok: true };
  await db.update(insFiles).set({ status, remarks }).where(eq(insFiles.id, f.id));
  const label = INS_DOC_KIND_LABEL[f.kind as keyof typeof INS_DOC_KIND_LABEL] ?? f.kind;
  await recordInsApproval({ vendorId: f.vendorId, target: "document", targetId: f.id, action: status === "pending" ? "reset" : status, fromStatus: f.status, toStatus: status, remarks, actorUserId: me.id, actorSide: "admin" });
  if (status !== "pending")
    await notifyInsurer(f.vendorId, {
      kind: "document",
      title: status === "verified" ? `${label} verified` : `${label} needs attention`,
      body: remarks ?? (status === "verified" ? "MarchGear has checked and verified this document." : undefined),
      href: "/insurance-vendor/application-status",
    });
  await audit(me.id, "status", "ins_vendor", f.vendorId, `${label} ${status === "pending" ? "reset to pending" : status} for ${insVendorName(f)} (${f.reference})`);
  touch();
  return { ok: true };
}

/* ── Change requests ────────────────────────────────────────── */

const changeDecision = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), remarks: optionalRemarks }),
  z.object({ decision: z.literal("reject"), remarks: requiredRemarks("Tell the vendor why the change was rejected (at least 5 characters)") }),
]);

const EDITABLE_ROOTS = new Set(["contact", "company", "registration", "regulatory", "bank"]);
const FORMAT: Record<string, { test: (v: string) => boolean; label: string; upper?: boolean }> = {
  "registration.gstin": { test: (v) => PATTERNS.gst.test(v), label: "GSTIN", upper: true },
  "registration.pan": { test: (v) => PATTERNS.pan.test(v), label: "PAN", upper: true },
  "bank.ifsc": { test: (v) => PATTERNS.ifsc.test(v), label: "IFSC", upper: true },
  "contact.mobile": { test: (v) => PATTERNS.mobile.test(v), label: "mobile number" },
  "regulatory.representative.mobile": { test: (v) => PATTERNS.mobile.test(v), label: "representative mobile" },
  "company.pin": { test: (v) => PATTERNS.pin.test(v), label: "PIN code" },
  "regulatory.licenceValidUntil": { test: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), label: "licence validity date" },
  "registration.establishedOn": { test: (v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))), label: "establishment date" },
  "regulatory.category": { test: (v) => (INS_VENDOR_CATEGORIES as readonly string[]).includes(v), label: "category" },
};

/** Applies "company.legalName" → value style changes to a copy of the application (existing text fields only). */
function applyFields(app: InsurerApplication, fields: Record<string, { from: string; to: string }>): { ok: true; app: InsurerApplication } | { ok: false; error: string } {
  const next = structuredClone(app) as unknown as Record<string, unknown>;
  for (const [path, change] of Object.entries(fields)) {
    const parts = path.split(".");
    if (parts.length < 2 || parts.length > 3 || !EDITABLE_ROOTS.has(parts[0]) || parts.some((s) => !/^[A-Za-z]+$/.test(s))) return { ok: false, error: `“${path}” can't be changed through a change request.` };
    let obj = next;
    for (const key of parts.slice(0, -1)) {
      const child = Object.hasOwn(obj, key) ? obj[key] : undefined;
      if (!child || typeof child !== "object" || Array.isArray(child)) return { ok: false, error: `“${fieldLabel(path)}” isn't a field of the application.` };
      obj = child as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1];
    if (!Object.hasOwn(obj, leaf) || typeof obj[leaf] !== "string") return { ok: false, error: `“${fieldLabel(path)}” isn't a text field of the application.` };
    let value = String(change?.to ?? "").trim();
    if (path === "bank.accountNumber") {
      // Already encrypted by the vendor portal — check the plain number, store the encrypted value.
      let plain: string;
      try {
        plain = decryptField(value).replace(/\s/g, "");
      } catch {
        return { ok: false, error: "The new account number couldn't be read — reject the request and ask the vendor to submit it again." };
      }
      if (!PATTERNS.account.test(plain)) return { ok: false, error: "The new account number isn't valid — reject the request and ask the vendor to correct it." };
      obj[leaf] = encryptField(value);
      obj.accountMasked = maskAccount(value);
      continue;
    }
    const fmt = FORMAT[path];
    if (fmt) {
      if (fmt.upper) value = value.toUpperCase();
      if (!fmt.test(value)) return { ok: false, error: `The new ${fmt.label} isn't valid — reject the request and ask the vendor to correct it.` };
    }
    obj[leaf] = value;
  }
  return { ok: true, app: next as unknown as InsurerApplication };
}

/** Approves (applies) or rejects a vendor's request to change verified business details. */
export async function decideInsChangeRequestAction(requestId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff("insurance");
  const parsed = changeDecision.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const rid = id.safeParse(requestId);
  if (!rid.success) return { ok: false, error: "Change request not found" };
  const db = getDb();
  const [cr] = await db.select().from(insChangeRequests).where(eq(insChangeRequests.id, rid.data));
  if (!cr) return { ok: false, error: "This change request no longer exists." };
  if (cr.status !== "pending") return { ok: false, error: "This change request has already been decided." };
  const v = await loadVendor(cr.vendorId);
  if (!v) return { ok: false, error: "This vendor no longer exists." };
  const what = Object.keys(cr.fields).map(fieldLabel).join(", ");
  const { decision, remarks } = parsed.data;
  const now = new Date();

  if (decision === "approve") {
    const applied = applyFields(v.application, cr.fields);
    if (!applied.ok) return { ok: false, error: applied.error };
    const a = applied.app;
    const [claim] = await db.update(insChangeRequests).set({ status: "approved", remarks, decidedBy: me.id, decidedAt: now }).where(and(eq(insChangeRequests.id, cr.id), eq(insChangeRequests.status, "pending")));
    if (!claim.affectedRows) return { ok: false, error: RACE };
    const category = (INS_VENDOR_CATEGORIES as readonly string[]).includes(a.regulatory?.category ?? "") ? (a.regulatory.category as (typeof INS_VENDOR_CATEGORIES)[number]) : v.category;
    await db
      .update(insVendors)
      .set({
        application: a,
        legalName: a.company?.legalName || v.legalName,
        brandName: a.company?.brandName || v.brandName,
        city: a.company?.city || v.city,
        state: a.company?.state || v.state,
        gst: a.registration?.gstin || v.gst,
        licenceNumber: a.regulatory?.licenceNumber || v.licenceNumber,
        licenceValidUntil: a.regulatory?.licenceValidUntil || v.licenceValidUntil,
        category,
      })
      .where(eq(insVendors.id, v.id));
  } else {
    const [claim] = await db.update(insChangeRequests).set({ status: "rejected", remarks, decidedBy: me.id, decidedAt: now }).where(and(eq(insChangeRequests.id, cr.id), eq(insChangeRequests.status, "pending")));
    if (!claim.affectedRows) return { ok: false, error: RACE };
  }

  await recordInsApproval({
    vendorId: v.id,
    target: "profile_change",
    targetId: cr.id,
    action: decision === "approve" ? "approved" : "rejected",
    fromStatus: "pending",
    toStatus: decision === "approve" ? "approved" : "rejected",
    remarks: [`Fields: ${what}`, remarks].filter(Boolean).join("\n"),
    actorUserId: me.id,
    actorSide: "admin",
  });
  await notifyInsurer(v.id, {
    kind: "profile_change",
    title: decision === "approve" ? "Your change request was approved" : "Your change request was not approved",
    body: decision === "approve" ? `Updated: ${what}.${remarks ? ` ${remarks}` : ""}` : remarks!,
    href: "/insurance-vendor/settings",
  });
  await audit(me.id, "update", "ins_vendor", v.id, `${decision === "approve" ? "Approved" : "Rejected"} change request (${what}) for ${insVendorName(v)} (${v.reference})`);
  touch();
  return { ok: true };
}
