import "server-only";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { insApprovals, insCovers, insProducts, users } from "@/db/schema";
import type { InsCoverType } from "@/db/enums";
import type { HistoryEntry } from "@/components/insurance/vendor/approvals/shared";
import type { CoverView } from "./shared";

/* Read models for /insurance-vendor/coverage and /add-ons. Every query is scoped by the vendor. */

export type CoverRow = typeof insCovers.$inferSelect;

/** Which products (of this vendor) use each cover — from the products' coverage.coverIds and addOns. */
export async function coverUsage(vendorId: number) {
  const rows = await getDb()
    .select({ id: insProducts.id, reference: insProducts.reference, name: insProducts.name, status: insProducts.status, coverage: insProducts.coverage, addOns: insProducts.addOns })
    .from(insProducts)
    .where(eq(insProducts.vendorId, vendorId))
    .limit(1000);
  const byCover = new Map<number, CoverView["usedBy"]>();
  for (const p of rows) {
    const ids = new Set([...(p.coverage?.coverIds ?? []), ...(p.addOns ?? []).map((a) => a.coverId)]);
    for (const id of ids) {
      const list = byCover.get(id) ?? [];
      list.push({ id: p.id, reference: p.reference, name: p.name, status: p.status });
      byCover.set(id, list);
    }
  }
  return byCover;
}

/** Covers MarchGear has approved at least once. */
async function everApprovedIds(vendorId: number, ids: number[]) {
  if (!ids.length) return new Set<number>();
  const rows = await getDb()
    .select({ id: insApprovals.targetId })
    .from(insApprovals)
    .where(and(eq(insApprovals.vendorId, vendorId), eq(insApprovals.target, "cover"), inArray(insApprovals.targetId, ids), inArray(insApprovals.action, ["approved", "approved_published"])));
  return new Set(rows.map((r) => r.id).filter((x): x is number => x !== null));
}

export function toCoverView(c: CoverRow, usedBy: CoverView["usedBy"], everApproved: boolean): CoverView {
  return {
    id: c.id,
    type: c.type,
    key: c.key,
    name: c.name,
    description: c.description,
    eligibility: c.eligibility,
    maxVehicleAgeYears: c.maxVehicleAgeYears,
    fuels: c.fuels ?? [],
    exclusions: c.exclusions ?? [],
    limits: c.limits,
    pricing: c.pricing,
    status: c.status,
    adminRemarks: c.adminRemarks,
    submittedAt: c.submittedAt?.toISOString() ?? null,
    updatedAt: c.updatedAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
    usedBy,
    everApproved: everApproved || c.status === "approved",
  };
}

/** Every cover of one type for the vendor (vendors have tens, not thousands), newest first. */
export async function listCoverViews(vendorId: number, type?: InsCoverType): Promise<CoverView[]> {
  const rows = await getDb()
    .select()
    .from(insCovers)
    .where(and(eq(insCovers.vendorId, vendorId), type ? eq(insCovers.type, type) : undefined))
    .orderBy(desc(insCovers.updatedAt), desc(insCovers.id))
    .limit(500);
  const [usage, approved] = await Promise.all([coverUsage(vendorId), everApprovedIds(vendorId, rows.map((r) => r.id))]);
  return rows.map((r) => toCoverView(r, usage.get(r.id) ?? [], approved.has(r.id)));
}

export async function getCoverRow(vendorId: number, id: number) {
  const [row] = await getDb()
    .select()
    .from(insCovers)
    .where(and(eq(insCovers.id, id), eq(insCovers.vendorId, vendorId)))
    .limit(1);
  return row ?? null;
}

/** The vendor-visible approval history of one cover (staff internal notes excluded). */
export async function coverHistory(vendorId: number, id: number): Promise<HistoryEntry[]> {
  const rows = await getDb()
    .select({ a: insApprovals, actorName: users.name })
    .from(insApprovals)
    .leftJoin(users, eq(users.id, insApprovals.actorUserId))
    .where(and(eq(insApprovals.vendorId, vendorId), eq(insApprovals.target, "cover"), eq(insApprovals.targetId, id), ne(insApprovals.action, "internal_note")))
    .orderBy(desc(insApprovals.createdAt), desc(insApprovals.id))
    .limit(100);
  return rows.map(({ a, actorName }) => ({
    id: a.id,
    target: "cover",
    targetId: a.targetId,
    action: a.action,
    fromStatus: a.fromStatus,
    toStatus: a.toStatus,
    remarks: a.remarks,
    actorSide: a.actorSide,
    // Staff names stay private; the vendor sees "MarchGear team".
    actorName: a.actorSide === "vendor" ? actorName : null,
    createdAt: a.createdAt.toISOString(),
  }));
}
