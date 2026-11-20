import type { Catalog } from "@/lib/catalog";
import { parseEngineCc } from "@/insurance/estimator";
import { FUELS } from "@/insurance/search";
import type { FuelName } from "@/insurance/types";
import type { BuilderVehicle } from "./pricing";

/* The customer's car from the catalogue variant — shared by the builder (useCatalog) and the server (getCatalog). Client-safe. */

export interface VehicleSpec {
  brand: string;
  model: string;
  variant: string;
  year: number | null;
  isNew: boolean;
  city: string;
  state: string;
}

export type VehicleResult = { ok: true; vehicle: BuilderVehicle } | { ok: false; error: string; field: "brand" | "model" | "variant" };

export function vehicleFromCatalog(catalog: Pick<Catalog, "getCar" | "getBrand" | "brandName">, spec: VehicleSpec): VehicleResult {
  const { getCar, getBrand, brandName } = catalog;
  if (!spec.brand) return { ok: false, field: "brand", error: "Choose the car's brand" };
  const car = spec.model ? getCar(spec.model) : undefined;
  if (!car || car.brand !== spec.brand) return { ok: false, field: "model", error: "Choose the car's model from the catalogue" };
  const variant = car.variants.find((v) => v.slug === spec.variant);
  if (!variant) return { ok: false, field: "variant", error: "Choose the variant — its ex-showroom price sets the IDV" };
  const fuel = (FUELS as string[]).includes(variant.fuel) ? (variant.fuel as FuelName) : "";
  return {
    ok: true,
    vehicle: {
      brand: car.brand,
      model: car.slug,
      variant: variant.slug,
      brandName: brandName(car.brand),
      modelName: car.name,
      variantName: variant.name,
      year: spec.isNew ? null : spec.year,
      isNew: spec.isNew,
      fuel,
      exShowroom: variant.price,
      engineCc: parseEngineCc(car.engine),
      motorKw: car.ev?.motorKw ?? null,
      bodyType: car.bodyType ?? null,
      isLuxury: Boolean(car.isLuxury || getBrand(car.brand)?.isLuxury),
      city: spec.city,
      state: spec.state,
    },
  };
}
