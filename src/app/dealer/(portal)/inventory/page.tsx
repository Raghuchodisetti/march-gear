import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Library, Plus } from "lucide-react";
import { PARTNER_VEHICLE_STATUS, type PartnerVehicleStatus } from "@/db/enums";
import { getCatalog } from "@/server/catalog";
import { requirePartner } from "@/server/partner/context";
import { INVENTORY_PAGE_SIZE, catalogueOf, listPartnerVehicles, needsCatalogueCount } from "@/server/partner/inventory";
import { Button } from "@/components/ui/button";
import { PortalHeader, StatCard, pageParam, strParam } from "@/components/portal/ui";
import { InventoryList } from "@/components/portal/inventory/inventory-list";
import { REQUEST_MODEL_HREF, SORTS, newDetailsOf, type InventorySort, type InventoryTab, type VehicleListRow } from "@/components/portal/inventory/shared";

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

  const [data, cat, missing] = await Promise.all([listPartnerVehicles(ctx.partner.id, { tab, status, q, sort, dir, page }), getCatalog(), needsCatalogueCount(ctx.partner.id)]);
  const dealerId = ctx.partner.publicDealerId;
  const rows: VehicleListRow[] = data.rows.map(({ v, showroom }) => {
    const { car, ok } = catalogueOf(v, cat);
    const nd = newDetailsOf(v.used);
    const available = v.kind === "used" ? v.stock > 0 : v.stock > 0 || nd.availability === "on_order";
    return {
      id: v.id,
      reference: v.reference,
      kind: v.kind,
      brand: v.brand,
      brandName: v.brand ? cat.brandName(v.brand) : "",
      model: v.model,
      variant: v.variant,
      year: v.year,
      colour: v.colour,
      fuel: v.fuel,
      transmission: v.transmission,
      sellingPrice: v.sellingPrice,
      exShowroom: v.exShowroom,
      stock: v.stock,
      availability: v.kind === "new" ? nd.availability : "in_stock",
      waitingWeeks: v.kind === "new" ? nd.waitingWeeks : null,
      status: v.status,
      adminRemarks: v.adminRemarks,
      needsCatalogue: !ok,
      views: v.views,
      enquiries: v.enquiries,
      // New cars show the catalogue's photo; used cars the dealer's own.
      image: (v.kind === "new" ? car?.images[0] : v.images[0]) ?? null,
      showroom,
      publicHref:
        v.status !== "published" || !ctx.approved || !ok || !available
          ? null
          : v.kind === "used"
            ? v.publicUsedCarId
              ? `/used-cars/${encodeURIComponent(v.publicUsedCarId)}`
              : null
            : dealerId
              ? `/dealers/${encodeURIComponent(dealerId)}#stock`
              : null,
      updatedAt: v.updatedAt.toISOString(),
      submittedAt: v.submittedAt?.toISOString() ?? null,
    };
  });

  const s = data.summary;
  const k = data.byKind;
  const canManage = ctx.can("inventory.manage");
  const attention = s.changes_requested + s.rejected + missing;

  return (
    <>
      <PortalHeader
        title="Vehicles"
        description="Your new-car stock and pre-owned cars, picked from MarchGear's catalogue. New cars go live when you publish; used cars are reviewed by MarchGear first."
        actions={
          canManage ? (
            <Button href="/dealer/inventory/add" icon={<Plus aria-hidden className="size-4" />}>
              Add vehicle
            </Button>
          ) : undefined
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Live on the website" value={s.published} note={`${k.new.published} new · ${k.used.published} used`} href="/dealer/inventory?status=published" />
        <StatCard label="Used cars in review" value={k.used.pending_approval} note={k.used.approved ? `${k.used.approved} approved, awaiting publish` : "With the MarchGear team"} href="/dealer/inventory?tab=used&status=pending_approval" />
        <StatCard
          label="Needs your attention"
          value={attention}
          tone={attention ? "red" : undefined}
          note={attention ? [missing ? `${missing} need a catalogue model` : null, s.changes_requested + s.rejected ? "changes requested or rejected" : null].filter(Boolean).join(" · ") : "Nothing to fix"}
          href={s.changes_requested ? "/dealer/inventory?status=changes_requested" : s.rejected ? "/dealer/inventory?status=rejected" : undefined}
        />
        <StatCard label="Paused & drafts" value={s.unpublished + s.draft} note={`${s.unpublished} paused · ${s.draft} drafts · ${s.archived} archived`} href={s.unpublished ? "/dealer/inventory?status=unpublished" : "/dealer/inventory?status=draft"} />
      </div>

      {missing > 0 && (
        <div className="mb-5 flex gap-3 border-l-2 border-red bg-white px-4 py-3 text-[13.5px]" role="note">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
          <p>
            <span className="font-semibold">
              {missing === 1 ? "1 listing needs" : `${missing} listings need`} a catalogue model.
            </span>{" "}
            {missing === 1 ? "It's" : "They're"} hidden from the website until you open {missing === 1 ? "it" : "each one"} and pick the model and variant from MarchGear&rsquo;s catalogue — look for &ldquo;Needs a catalogue model&rdquo; below.
          </p>
        </div>
      )}

      <p className="mb-5 flex gap-3 border border-line bg-[#fafafa] px-4 py-3 text-[13px] leading-relaxed text-ink/80">
        <Library aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
        <span>
          <span className="font-semibold text-ink">Cars come from MarchGear&rsquo;s catalogue.</span> You choose the model and variant and set your colour, price, stock and showroom — specifications, features and new-car photos are filled in for you. Can&rsquo;t find a model?{" "}
          <Link href={REQUEST_MODEL_HREF} className="font-medium text-red underline-offset-4 hover:underline">
            Ask MarchGear support to add it
          </Link>
          .
        </span>
      </p>

      {!canManage && (
        <p className="mb-5 border-l-2 border-ink/20 bg-white px-4 py-3 text-[13px] text-muted">
          You can view inventory. Adding, editing, publishing and submitting vehicles needs the &ldquo;Add, edit and submit vehicles&rdquo; permission — ask your dealership&rsquo;s owner.
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
