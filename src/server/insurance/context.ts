import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { insMembers, insVendors } from "@/db/schema";
import type { InsVendorStatus } from "@/db/enums";
import type { SessionUser } from "@/lib/action-result";
import { insPermissionsFor, type InsPermission } from "@/insurance/permissions";
import { getSessionUser } from "@/server/auth";

/* ──────────────────────────────────────────────────────────────
   Who is using the insurance vendor portal, for which vendor, and
   what they may do. Every portal page and Server Action goes
   through requireInsurer() / insurerAction() — never trust the
   client. Scope every query by ctx.vendor.id.
   ────────────────────────────────────────────────────────────── */

export type VendorRow = typeof insVendors.$inferSelect;
export type InsMemberRow = typeof insMembers.$inferSelect;

export interface InsurerContext {
  user: SessionUser;
  vendor: VendorRow;
  member: InsMemberRow;
  perms: InsPermission[];
  can: (p: InsPermission) => boolean;
  approved: boolean;
}

/** Insurer sessions last a week (like dealer sessions). */
export const INSURER_SESSION_TTL = 7 * 86_400_000;

/** Statuses in which the full portal (products, enquiries, campaigns…) is open. */
export const INS_PORTAL_OPEN: InsVendorStatus[] = ["approved"];
/** Statuses that lock the vendor out of everything except status, notifications, support and settings. */
export const INS_PORTAL_BLOCKED: InsVendorStatus[] = ["suspended", "rejected"];

/** The signed-in vendor user's context, or null. Deduplicated per request. */
export const getInsurerContext = cache(async (): Promise<InsurerContext | null> => {
  const user = await getSessionUser();
  if (!user || user.role !== "insurer") return null;
  const [row] = await getDb()
    .select({ member: insMembers, vendor: insVendors })
    .from(insMembers)
    .innerJoin(insVendors, eq(insVendors.id, insMembers.vendorId))
    .where(and(eq(insMembers.userId, user.id), eq(insMembers.isActive, true)))
    .orderBy(asc(insMembers.id))
    .limit(1);
  if (!row) return null;
  const perms = insPermissionsFor(row.member);
  return {
    user,
    vendor: row.vendor,
    member: row.member,
    perms,
    can: (p) => perms.includes(p),
    approved: INS_PORTAL_OPEN.includes(row.vendor.status),
  };
});

/**
 * For portal pages. Redirects to sign-in when signed out, to the application status page when the
 * vendor isn't approved (unless `approved: false`), and to the dashboard when the person lacks `perm`.
 */
export async function requireInsurer(opts: { perm?: InsPermission; approved?: boolean; next?: string } = {}): Promise<InsurerContext> {
  const ctx = await getInsurerContext();
  if (!ctx) redirect(`/insurance-vendor/login${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ""}`);
  if (opts.approved !== false && !ctx.approved) redirect("/insurance-vendor/application-status");
  if (opts.perm && !ctx.can(opts.perm)) redirect("/insurance-vendor/dashboard?denied=1");
  return ctx;
}

export type InsurerActionError = { ok: false; error: string };

/**
 * For Server Actions: the context, or an error result to return as-is.
 * `approved` defaults to true — most actions need an approved vendor.
 */
export async function insurerAction(perm?: InsPermission, opts: { approved?: boolean } = {}): Promise<InsurerContext | InsurerActionError> {
  const ctx = await getInsurerContext();
  if (!ctx) return { ok: false, error: "Your session has ended. Please sign in again." };
  if (opts.approved !== false && !ctx.approved) return { ok: false, error: "This is available once your company is approved." };
  if (perm && !ctx.can(perm)) return { ok: false, error: "You don't have permission to do that. Ask your company's owner or administrator." };
  return ctx;
}

export const isInsurerError = (v: InsurerContext | InsurerActionError): v is InsurerActionError => "ok" in v && v.ok === false;

/** The name to show for a vendor. */
export const vendorName = (v: Pick<VendorRow, "brandName" | "legalName" | "application">) =>
  v.brandName || v.legalName || v.application.company.brandName || v.application.company.legalName || "Your company";
