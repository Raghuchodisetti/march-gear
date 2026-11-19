"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CarModel, City, Variant } from "@/types";
import { onRoadPrice } from "@/data/cities";
import { useCity } from "@/components/providers/app-provider";
import { isEv } from "./utils";

interface CarDetailValue {
  car: CarModel;
  /** "Hyundai" */
  brand: string;
  /** "Hyundai Creta" */
  title: string;
  ev: boolean;
  variant: Variant;
  setVariant: (slug: string) => void;
  city: City;
  /** Indicative on-road price of the selected variant in the selected city */
  onRoad: number;
}

const CarDetailContext = createContext<CarDetailValue | null>(null);

/** Holds the selected variant so the hero, sticky bars and EMI stay in sync. */
export function CarDetailProvider({ car, brand, children }: { car: CarModel; brand: string; children: ReactNode }) {
  const [slug, setSlug] = useState(car.variants[0].slug);
  const { city } = useCity();

  const value = useMemo<CarDetailValue>(() => {
    const variant = car.variants.find((v) => v.slug === slug) ?? car.variants[0];
    const ev = isEv(car);
    return {
      car,
      brand,
      title: `${brand} ${car.name}`,
      ev,
      variant,
      setVariant: setSlug,
      city,
      onRoad: onRoadPrice(variant.price, city.slug, ev),
    };
  }, [car, brand, slug, city]);

  return <CarDetailContext.Provider value={value}>{children}</CarDetailContext.Provider>;
}

export function useCarDetail() {
  const ctx = useContext(CarDetailContext);
  if (!ctx) throw new Error("useCarDetail must be used inside <CarDetailProvider>");
  return ctx;
}
