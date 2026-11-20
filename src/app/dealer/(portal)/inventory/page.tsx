import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PARTNER_VEHICLE_STATUS, type PartnerVehicleStatus } from "@/db/enums";
import { getCatalog } from "@/server/catalog";
import { requirePartner } from "@/server/partner/context";
import { INVENTORY_PAGE_SIZE, listPartnerVehicles } from "@/server/partner/inventory";
import { Button } from "@/components/ui/button";
import { PortalHeader, StatCard, pageParam, strParam } from "@/components/portal/ui";
import { InventoryList } from "@/components/portal/inventory/inventory-list";
import { SORTS, type InventorySort, type InventoryTab, type VehicleListRow } from "@/components/portal/inventory/shared";

export const metadata: Metadata = { title: "Vehicles" };

export default async function InventoryPage(props: PageProps<"/dealer/inventory">) {
  const ctx = await requirePartner({ perm: "inventory.view", next: "/dealer/inventory" });
  const sp = await props.searchParams;
  const tabRaw = strParam(sp.tab);
  const tab: InventoryTab = tabRaw === "new" || tabRaw === "used" ? tabRaw : "all";
  const statusRaw = strParam(sp.status);
  const status = PARTNER_VEHICLE_STATUS.includes(statusRaw as PartnerVehicleStatus) ? (statusRaw as PartnerVehicleStatus) : undefined;
  const sortRaw = strParam(sp.sort);
  const sort: InventorySort = SORTS.some((s) => s.value === sortRaw) ? (sortRaw as InventorySort) : "updated";
  const dir = strParam(sp.dir) === "asc" ? "asc" : "desc";
  const q = strParam(sp.q)?.slice(0, 80);
  const page = pageParam(sp.page);

  const [data, { brandName }] = await Promise.all([listPartnerVehicles(ctx.partner.id, { tab, status, q, sort, dir, page }), getCatalog()]);
  const dealerId = ctx.partner.publicDealerId;
  const rows: VehicleListRow[] = data.rows.map(({ v, showroom }) => ({
    id: v.id,
    reference: v.reference,
    kind: v.kind,
    brand: v.brand,
    brandName: v.brand ? brandName(v.brand) : "",
    model: v.model,
    variant: v.variant,
    year: v.year,
    colour: v.colour,
    fuel: v.fuel,
    transmission: v.transmission,
    sellingPrice: v.sellingPrice,
    exShowroom: v.exShowroom,
    stock: v.stock,
    status: v.status,
    adminRemarks: v.adminRemarks,
    views: v.views,
    enquiries: v.enquiries,
    image: v.images[0] ?? null,
    showroom,
    publicHref:
      v.status !== "published" || !ctx.approved
        ? null
        : v.kind === "used"
          ? v.publicUsedCarId && v.stock > 0
            ? `/used-cars/${encodeURIComponent(v.publicUsedCarId)}`
            : null
          : dealerId && v.stock > 0
            ? `/dealers/${encodeURIComponent(dealerId)}#stock`
            : null,
    updatedAt: v.updatedAt.toISOString(),
    submittedAt: v.submittedAt?.toISOString() ?? null,
  }));

  const s = data.summary;
  const canManage = ctx.can("inventory.manage");
  const attention = s.changes_requested + s.rejected;

  return (
    <>
      <PortalHeader
        title="Vehicles"
        description="New-car stock and pre-owned cars. MarchGear reviews every listing before it appears on the website."
        actions={
          canManage ? (
            <Button href="/dealer/inventory/add" icon={<Plus aria-hidden className="size-4" />}>
              Add vehicle
            </Button>
          ) : undefined
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Live on the website" value={s.published} note={`${s.approved} approved, awaiting publish`} href="/dealer/inventory?status=published" />
        <StatCard label="Pending approval" value={s.pending_approval} note="With the MarchGear team" href="/dealer/inventory?status=pending_approval" />
        <StatCard
          label="Needs your attention"
          value={attention}
          tone={attention ? "red" : undefined}
          note={attention ? "Changes requested or rejected" : "Nothing to fix"}
          href={s.changes_requested ? "/dealer/inventory?status=changes_requested" : s.rejected ? "/dealer/inventory?status=rejected" : undefined}
        />
        <StatCard label="Drafts" value={s.draft} note={`${s.archived} archived`} href="/dealer/inventory?status=draft" />
      </div>

      {!canManage && (
        <p className="mb-5 border-l-2 border-ink/20 bg-white px-4 py-3 text-[13px] text-muted">
          You can view inventory. Adding, editing and submitting vehicles needs the &ldquo;Add, edit and submit vehicles&rdquo; permission — ask your dealership&rsquo;s owner.
        </p>
      )}

      <InventoryList
        rows={rows}
        total={data.total}
        pageSize={INVENTORY_PAGE_SIZE}
        filters={{ tab, status: status ?? "", q: q ?? "", sort, dir, page }}
        tabCounts={data.tabCounts}
        statusCounts={data.statusCounts}
        canManage={canManage}
      />
    </>
  );
}
