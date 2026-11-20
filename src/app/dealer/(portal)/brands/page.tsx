import type { Metadata } from "next";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerApprovals, partnerBrands, partnerShowrooms } from "@/db/schema";
import { getCatalog } from "@/server/catalog";
import { requirePartner } from "@/server/partner/context";
import { todayISO } from "@/server/validation";
import { PortalHeader, formatDay } from "@/components/portal/ui";
import { BrandManager, type BrandView } from "@/components/portal/brands/brand-manager";

export const metadata: Metadata = { title: "Brands" };

const ACTION_LABEL: Record<string, string> = {
  submitted: "Submitted for review",
  resubmitted: "Resubmitted for review",
  approved: "Approved by MarchGear",
  rejected: "Rejected by MarchGear",
  expired: "Marked expired",
  changes_requested: "Changes requested by MarchGear",
};

export default async function BrandsPage() {
  const ctx = await requirePartner({ perm: "brands.manage" });
  const db = getDb();
  const [rows, rooms, catalog] = await Promise.all([
    db.select().from(partnerBrands).where(eq(partnerBrands.partnerId, ctx.partner.id)).orderBy(asc(partnerBrands.createdAt)),
    db
      .select({ id: partnerShowrooms.id, name: partnerShowrooms.name })
      .from(partnerShowrooms)
      .where(and(eq(partnerShowrooms.partnerId, ctx.partner.id), eq(partnerShowrooms.isActive, true)))
      .orderBy(desc(partnerShowrooms.isPrimary), asc(partnerShowrooms.id)),
    getCatalog(),
  ]);
  const events = rows.length
    ? await db
        .select({ targetId: partnerApprovals.targetId, action: partnerApprovals.action, createdAt: partnerApprovals.createdAt })
        .from(partnerApprovals)
        .where(and(eq(partnerApprovals.partnerId, ctx.partner.id), eq(partnerApprovals.target, "brand"), ne(partnerApprovals.action, "internal_note"), inArray(partnerApprovals.targetId, rows.map((r) => r.id))))
        .orderBy(desc(partnerApprovals.createdAt), desc(partnerApprovals.id))
    : [];
  const latest = new Map<number, (typeof events)[number]>();
  for (const e of events) if (e.targetId !== null && !latest.has(e.targetId)) latest.set(e.targetId, e);

  const today = todayISO();
  const dayMs = 86_400_000;
  const brands: BrandView[] = rows.map((r) => {
    const daysLeft = r.validUntil ? Math.round((Date.parse(`${r.validUntil}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / dayMs) : null;
    const validity: BrandView["validity"] = daysLeft === null ? "none" : daysLeft < 0 || r.status === "expired" ? "expired" : daysLeft <= 30 ? "soon" : "ok";
    const ev = latest.get(r.id);
    return {
      id: r.id,
      brand: r.brand,
      name: catalog.brandName(r.brand),
      status: r.status,
      validity,
      daysLeft,
      certificate: r.certificate,
      validUntil: r.validUntil ?? "",
      validUntilLabel: r.validUntil ? formatDay(r.validUntil) : null,
      showroomIds: r.showroomIds,
      models: r.models.length,
      variants: r.variants.length,
      remarks: r.remarks,
      lastEvent: ev ? `${ACTION_LABEL[ev.action] ?? ev.action.replace(/_/g, " ")} · ${formatDay(ev.createdAt)}` : null,
    };
  });

  return (
    <>
      <PortalHeader title="Brands" description="Your manufacturer authorisations. MarchGear verifies each certificate before the brand appears on your public page." />
      <BrandManager
        brands={brands}
        showrooms={rooms}
        catalogBrands={catalog.brands.map((b) => ({ slug: b.slug, name: b.name })).sort((a, b) => a.name.localeCompare(b.name))}
      />
    </>
  );
}
