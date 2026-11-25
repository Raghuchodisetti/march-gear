import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalog } from "@/server/catalog";
import { requirePartner } from "@/server/partner/context";
import { catalogueOf, getPartnerVehicle } from "@/server/partner/inventory";
import { PortalHeader } from "@/components/portal/ui";
import { VehicleFormPage } from "@/components/portal/inventory/form-page";
import { newDetailsOf, vehicleTitle, vehicleToForm } from "@/components/portal/inventory/shared";

export const metadata: Metadata = { title: "Edit vehicle" };

export default async function EditVehiclePage(props: PageProps<"/dealer/inventory/[id]">) {
  const { id: raw } = await props.params;
  const ctx = await requirePartner({ perm: "inventory.manage", next: `/dealer/inventory/${encodeURIComponent(raw)}` });
  const id = /^\d{1,10}$/.test(raw) ? Number(raw) : 0;
  const v = id ? await getPartnerVehicle(ctx.partner.id, id) : null;
  if (!v) notFound();
  const cat = await getCatalog();
  const { car, ok } = catalogueOf(v, cat);
  const title = vehicleTitle({ year: v.year, brandName: v.brand ? cat.brandName(v.brand) : "", model: car?.name ?? v.model });
  const inStock = v.kind === "used" ? v.stock > 0 : v.stock > 0 || newDetailsOf(v.used).availability === "on_order";
  const live = v.status === "published" && ctx.approved && inStock && ok;
  const publicHref = !live ? null : v.kind === "used" ? (v.publicUsedCarId ? `/used-cars/${encodeURIComponent(v.publicUsedCarId)}` : null) : ctx.partner.publicDealerId ? `/dealers/${encodeURIComponent(ctx.partner.publicDealerId)}#stock` : null;

  return (
    <>
      <PortalHeader title={title} description={[car ? v.variant : null, v.reference].filter(Boolean).join(" · ")} back={{ href: "/dealer/inventory", label: "Vehicles" }} />
      <VehicleFormPage
        ctx={ctx}
        initial={vehicleToForm(v, car)}
        vehicle={{
          id: v.id,
          reference: v.reference,
          status: v.status,
          adminRemarks: v.adminRemarks,
          updatedAt: v.updatedAt.toISOString(),
          submittedAt: v.submittedAt?.toISOString() ?? null,
          publicHref,
          // What the listing said before the catalogue rule, when its model or variant has to be picked again.
          listedAs: ok ? null : [cat.brandName(v.brand), v.model, v.variant].filter(Boolean).join(" ") || "an unnamed car",
        }}
      />
    </>
  );
}
