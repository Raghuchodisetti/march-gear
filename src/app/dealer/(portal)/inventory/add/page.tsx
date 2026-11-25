import type { Metadata } from "next";
import { requirePartner } from "@/server/partner/context";
import { PortalHeader } from "@/components/portal/ui";
import { VehicleFormPage } from "@/components/portal/inventory/form-page";
import { emptyVehicle } from "@/components/portal/inventory/shared";

export const metadata: Metadata = { title: "Add vehicle" };

export default async function AddVehiclePage(props: PageProps<"/dealer/inventory/add">) {
  const ctx = await requirePartner({ perm: "inventory.manage", next: "/dealer/inventory/add" });
  const { kind } = await props.searchParams;
  return (
    <>
      <PortalHeader
        title="Add a vehicle"
        description="Pick the car from MarchGear's catalogue, then add your price, stock and showroom. New cars go live when you publish; used cars are reviewed by MarchGear first."
        back={{ href: "/dealer/inventory", label: "Vehicles" }}
      />
      <VehicleFormPage ctx={ctx} initial={emptyVehicle(kind === "used" ? "used" : "new")} />
    </>
  );
}
