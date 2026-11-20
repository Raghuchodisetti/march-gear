import "server-only";
import { and, count, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { adCampaigns, insApprovals, insCampaigns, insCovers, insProducts, users } from "@/db/schema";
import type { InsCoverStatus, InsCoverType, InsProductStatus } from "@/db/enums";
import type { HistoryEntry } from "./shared";

/* Read models for /insurance-vendor/approvals (products and covers). Staff internal notes are never selected. */

export interface ApprovalItem {
  kind: "product" | "cover";
  id: number;
  coverType: InsCoverType | null;
  reference: string | null;
  name: string;
  status: InsProductStatus | InsCoverStatus;
  adminRemarks: string | null;
  requiredCorrections: string[];
  submittedAt: string | null;
  updatedAt: string;
  lastDecision: { action: string; at: string; remarks: string | null } | null;
  href: string;
}

const hrefFor = (kind: "product" | "cover", id: number, type: InsCoverType | null) =>
  kind === "product" ? `/insurance-vendor/products/${id}` : `${type === "coverage" ? "/insurance-vendor/coverage" : "/insurance-vendor/add-ons"}?open=${id}`;

export async function approvalItems(vendorId: number): Promise<ApprovalItem[]> {
  const db = getDb();
  const [products, covers, decisions] = await Promise.all([
    db
      .select({
        id: insProducts.id,
        reference: insProducts.reference,
        name: insProducts.name,
        status: insProducts.status,
        adminRemarks: insProducts.adminRemarks,
        requiredCorrections: insProducts.requiredCorrections,
        submittedAt: insProducts.submittedAt,
        updatedAt: insProducts.updatedAt,
      })
      .from(insProducts)
      .where(eq(insProducts.vendorId, vendorId))
      .orderBy(desc(insProducts.updatedAt))
      .limit(500),
    db
      .select({ id: insCovers.id, type: insCovers.type, name: insCovers.name, status: insCovers.status, adminRemarks: insCovers.adminRemarks, submittedAt: insCovers.submittedAt, updatedAt: insCovers.updatedAt })
      .from(insCovers)
      .where(eq(insCovers.vendorId, vendorId))
      .orderBy(desc(insCovers.updatedAt))
      .limit(500),
    db
      .select({ target: insApprovals.target, targetId: insApprovals.targetId, action: insApprovals.action, remarks: insApprovals.remarks, createdAt: insApprovals.createdAt })
      .from(insApprovals)
      .where(and(eq(insApprovals.vendorId, vendorId), inArray(insApprovals.target, ["product", "cover"]), eq(insApprovals.actorSide, "admin"), ne(insApprovals.action, "internal_note")))
      .orderBy(desc(insApprovals.createdAt), desc(insApprovals.id))
      .limit(3000),
  ]);
  const last = new Map<string, ApprovalItem["lastDecision"]>();
  for (const d of decisions) {
    const k = `${d.target}:${d.targetId}`;
    if (!last.has(k)) last.set(k, { action: d.action, at: d.createdAt.toISOString(), remarks: d.remarks });
  }
  return [
    ...products.map((p) => ({
      kind: "product" as const,
      id: p.id,
      coverType: null,
      reference: p.reference,
      name: p.name,
      status: p.status,
      adminRemarks: p.adminRemarks,
      requiredCorrections: p.requiredCorrections ?? [],
      submittedAt: p.submittedAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
      lastDecision: last.get(`product:${p.id}`) ?? null,
      href: hrefFor("product", p.id, null),
    })),
    ...covers.map((c) => ({
      kind: "cover" as const,
      id: c.id,
      coverType: c.type,
      reference: null,
      name: c.name,
      status: c.status,
      adminRemarks: c.adminRemarks,
      requiredCorrections: [],
      submittedAt: c.submittedAt?.toISOString() ?? null,
      updatedAt: c.updatedAt.toISOString(),
      lastDecision: last.get(`cover:${c.id}`) ?? null,
      href: hrefFor("cover", c.id, c.type),
    })),
  ];
}

export const TIMELINE_PAGE = 25;

/** Every vendor-visible step for products and covers, newest first, with the item's name. */
export async function approvalTimeline(vendorId: number, page: number, kind?: "product" | "cover") {
  const db = getDb();
  const where = and(eq(insApprovals.vendorId, vendorId), kind ? eq(insApprovals.target, kind) : inArray(insApprovals.target, ["product", "cover"]), ne(insApprovals.action, "internal_note"));
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ a: insApprovals, actorName: users.name })
      .from(insApprovals)
      .leftJoin(users, eq(users.id, insApprovals.actorUserId))
      .where(where)
      .orderBy(desc(insApprovals.createdAt), desc(insApprovals.id))
      .limit(TIMELINE_PAGE)
      .offset((page - 1) * TIMELINE_PAGE),
    db.select({ total: count() }).from(insApprovals).where(where),
  ]);
  const pIds = rows.filter((r) => r.a.target === "product" && r.a.targetId).map((r) => r.a.targetId!);
  const cIds = rows.filter((r) => r.a.target === "cover" && r.a.targetId).map((r) => r.a.targetId!);
  const [ps, cs] = await Promise.all([
    pIds.length ? db.select({ id: insProducts.id, name: insProducts.name, reference: insProducts.reference }).from(insProducts).where(and(eq(insProducts.vendorId, vendorId), inArray(insProducts.id, pIds))) : Promise.resolve([]),
    cIds.length ? db.select({ id: insCovers.id, name: insCovers.name, type: insCovers.type }).from(insCovers).where(and(eq(insCovers.vendorId, vendorId), inArray(insCovers.id, cIds))) : Promise.resolve([]),
  ]);
  const pName = new Map(ps.map((p) => [p.id, p]));
  const cName = new Map(cs.map((c) => [c.id, c]));
  const entries: (HistoryEntry & { subject: { name: string; href: string | null; kind: string } })[] = rows.map(({ a, actorName }) => {
    const p = a.target === "product" && a.targetId ? pName.get(a.targetId) : undefined;
    const c = a.target === "cover" && a.targetId ? cName.get(a.targetId) : undefined;
    return {
      id: a.id,
      target: a.target as "product" | "cover",
      targetId: a.targetId,
      action: a.action,
      fromStatus: a.fromStatus,
      toStatus: a.toStatus,
      remarks: a.remarks,
      actorSide: a.actorSide,
      actorName: a.actorSide === "vendor" ? actorName : null,
      createdAt: a.createdAt.toISOString(),
      subject: p
        ? { name: `${p.reference} · ${p.name}`, href: hrefFor("product", p.id, null), kind: "Product" }
        : c
          ? { name: c.name, href: hrefFor("cover", c.id, c.type), kind: c.type === "coverage" ? "Coverage item" : "Add-on cover" }
          : { name: a.target === "product" ? "A deleted product" : "A deleted cover", href: null, kind: a.target === "product" ? "Product" : "Cover" },
    };
  });
  return { entries, total: Number(total) };
}

/** The other approval workflows (campaigns, advertising), for the summary links. */
export async function otherWorkflowCounts(vendorId: number) {
  const db = getDb();
  const [campaigns, ads] = await Promise.all([
    db.select({ status: insCampaigns.status, n: count() }).from(insCampaigns).where(eq(insCampaigns.vendorId, vendorId)).groupBy(insCampaigns.status),
    db.select({ status: adCampaigns.status, n: count() }).from(adCampaigns).where(eq(adCampaigns.insVendorId, vendorId)).groupBy(adCampaigns.status),
  ]);
  const sum = (rows: { status: string; n: number }[], s: string[]) => rows.filter((r) => s.includes(r.status)).reduce((a, r) => a + Number(r.n), 0);
  return {
    campaigns: { review: sum(campaigns, ["pending_approval"]), attention: sum(campaigns, ["changes_requested", "rejected"]), approved: sum(campaigns, ["approved"]), total: sum(campaigns, campaigns.map((r) => r.status)) },
    ads: { review: sum(ads, ["pending_approval"]), attention: sum(ads, ["changes_requested", "rejected"]), approved: sum(ads, ["approved"]), total: sum(ads, ads.map((r) => r.status)) },
  };
}
