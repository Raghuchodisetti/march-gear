import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalog } from "@/server/catalog";
import { requirePartner } from "@/server/partner/context";
import { getPartnerVehicle } from "@/server/partner/inventory";
import { PortalHeader } from "@/components/portal/ui";
import { VehicleFormPage } from "@/components/portal/inventory/form-page";
import { vehicleTitle, vehicleToForm } from "@/components/portal/inventory/shared";

export const metadata: Metadata = { title: "Edit vehicle" };

export default async function EditVehiclePage(props: PageProps<"/dealer/inventory/[id]">) {
  const { id: raw } = await props.params;
  const ctx = await requirePartner({ perm: "inventory.manage", next: `/dealer/inventory/${encodeURIComponent(raw)}` });
  const id = /^\d{1,10}$/.test(raw) ? Number(raw) : 0;
  const v = id ? await getPartnerVehicle(ctx.partner.id, id) : null;
  if (!v) notFound();
  const { brandName } = await getCatalog();
  const title = vehicleTitle({ year: v.year, brandName: v.brand ? brandName(v.brand) : "", model: v.model });
  const live = v.status === "published" && ctx.approved && v.stock > 0;
  const publicHref = !live ? null : v.kind === "used" ? (v.publicUsedCarId ? `/used-cars/${encodeURIComponent(v.publicUsedCarId)}` : null) : ctx.partner.publicDealerId ? `/dealers/${encodeURIComponent(ctx.partner.publicDealerId)}#stock` : null;

  return (
    <>
      <PortalHeader title={title} description={[v.variant, v.reference].filter(Boolean).join(" · ")} back={{ href: "/dealer/inventory", label: "Vehicles" }} />
      <VehicleFormPage
        ctx={ctx}
        initial={vehicleToForm(v)}
        vehicle={{
          id: v.id,
          reference: v.reference,
          status: v.status,
          adminRemarks: v.adminRemarks,
          updatedAt: v.updatedAt.toISOString(),
          submittedAt: v.submittedAt?.toISOString() ?? null,
          publicHref,
        }}
      />
    </>
  );
}
