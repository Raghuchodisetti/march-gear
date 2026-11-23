import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerMembers, partners } from "@/db/schema";
import type { PartnerStatus } from "@/db/enums";
import type { SessionUser } from "@/lib/action-result";
import { permissionsFor, type Permission } from "@/partner/permissions";
import { getSessionUser } from "@/server/auth";

/* ──────────────────────────────────────────────────────────────
   Who is using the dealer portal, for which dealership, and what
   they may do. Every portal page and Server Action goes through
   requirePartner() / partnerAction() — never trust the client.
   ────────────────────────────────────────────────────────────── */

export type PartnerRow = typeof partners.$inferSelect;
export type MemberRow = typeof partnerMembers.$inferSelect;

export interface PartnerContext {
  user: SessionUser;
  partner: PartnerRow;
  member: MemberRow;
  perms: Permission[];
  can: (p: Permission) => boolean;
  approved: boolean;
}

/** Statuses in which the full portal (inventory, offers, CRM…) is open. */
export const PORTAL_OPEN: PartnerStatus[] = ["approved"];
/** Statuses that lock the dealership out of everything except status, support and settings. */
export const PORTAL_BLOCKED: PartnerStatus[] = ["suspended", "deactivated", "rejected"];

/** The signed-in dealer's context, or null. Deduplicated per request. */
export const getPartnerContext = cache(async (): Promise<PartnerContext | null> => {
  const user = await getSessionUser("dealer");
  if (!user || user.role !== "dealer") return null;
  const [row] = await getDb()
    .select({ member: partnerMembers, partner: partners })
    .from(partnerMembers)
    .innerJoin(partners, eq(partners.id, partnerMembers.partnerId))
    .where(and(eq(partnerMembers.userId, user.id), eq(partnerMembers.isActive, true)))
    .orderBy(asc(partnerMembers.id))
    .limit(1);
  if (!row) return null;
  const perms = permissionsFor(row.member);
  return {
    user,
    partner: row.partner,
    member: row.member,
    perms,
    can: (p) => perms.includes(p),
    approved: PORTAL_OPEN.includes(row.partner.status),
  };
});

/**
 * For portal pages. Redirects to sign-in when signed out, to the application status page when the
 * dealership isn't approved (unless `approved: false`), and to the dashboard when the person lacks `perm`.
 */
export async function requirePartner(opts: { perm?: Permission; approved?: boolean; next?: string } = {}): Promise<PartnerContext> {
  const ctx = await getPartnerContext();
  if (!ctx) redirect(`/dealer/login${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ""}`);
  if (opts.approved !== false && !ctx.approved) redirect("/dealer/application-status");
  if (opts.perm && !ctx.can(opts.perm)) redirect("/dealer/dashboard?denied=1");
  return ctx;
}

export type PartnerActionError = { ok: false; error: string };

/**
 * For Server Actions: the context, or an error result to return as-is.
 * `approved` defaults to true — most actions need an approved dealership.
 */
export async function partnerAction(perm?: Permission, opts: { approved?: boolean } = {}): Promise<PartnerContext | PartnerActionError> {
  const ctx = await getPartnerContext();
  if (!ctx) return { ok: false, error: "Your session has ended. Please sign in again." };
  if (opts.approved !== false && !ctx.approved) return { ok: false, error: "This is available once your dealership is approved." };
  if (perm && !ctx.can(perm)) return { ok: false, error: "You don't have permission to do that. Ask your dealership's owner or administrator." };
  return ctx;
}

export const isActionError = (v: PartnerContext | PartnerActionError): v is PartnerActionError => "ok" in v && v.ok === false;
