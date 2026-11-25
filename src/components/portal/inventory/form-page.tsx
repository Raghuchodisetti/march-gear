import { getCatalog, getClientCatalogData } from "@/server/catalog";
import type { PartnerContext } from "@/server/partner/context";
import { brandLineups, listShowroomOptions } from "@/server/partner/inventory";
import { CatalogProvider } from "@/components/providers/catalog-provider";
import { VehicleForm, type VehicleFormProps } from "./vehicle-form";
import type { VehicleFormValue } from "./shared";

/**
 * Server half of the add/edit pages: loads the catalogue (brands and models only — the portal
 * doesn't need editorial data), the dealership's showrooms and its approved brand line-ups.
 */
export async function VehicleFormPage({ ctx, initial, vehicle }: { ctx: PartnerContext; initial: VehicleFormValue; vehicle?: VehicleFormProps["vehicle"] }) {
  const [data, full, showrooms, lineups] = await Promise.all([getClientCatalogData(), getCatalog(), listShowroomOptions(ctx.partner.id), brandLineups(ctx.partner.id)]);
  const catalog = { ...data, upcoming: [], dealers: [], dealerProfiles: {}, dealerReviews: [], usedCars: [], authors: [], articles: [], ownerReviews: [] };
  // The listing's own model in full (colours, specs); others load when the dealer picks them.
  const initialCar = initial.modelSlug ? full.getCar(initial.modelSlug) : undefined;
  const p = ctx.partner;
  const primary = showrooms.find((s) => s.isPrimary) ?? showrooms[0];
  return (
    <CatalogProvider data={catalog}>
      <VehicleForm
        vehicle={vehicle}
        initial={initial}
        initialCar={initialCar}
        showrooms={showrooms}
        lineups={lineups}
        partnerId={p.id}
        dealer={{ id: p.publicDealerId, name: p.tradeName || p.legalName || p.application.business.tradeName || "Your dealership", city: primary?.city || p.city || "", area: "" }}
      />
    </CatalogProvider>
  );
}
