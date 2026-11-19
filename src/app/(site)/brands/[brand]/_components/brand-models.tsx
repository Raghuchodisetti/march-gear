"use client";

import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Cog, Fuel, Gauge, ShieldCheck, Zap } from "lucide-react";
import type { BodyType, CarModel } from "@/types";
import { isElectric } from "@/lib/catalog";
import { formatPriceRange } from "@/lib/format";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spec } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { useCatalog } from "@/components/providers/catalog-provider";
import { CarCard } from "@/components/vehicle/car-card";
import { bestEfficiency, carHref, fuelSummary, transmissionSummary } from "@/components/vehicle/card-utils";
import { CompareToggle } from "@/components/vehicle/toggles";

const ORDER: BodyType[] = ["SUV", "Sedan", "Hatchback", "MUV", "Coupe"];
const PLURAL: Record<BodyType, string> = { SUV: "SUVs", Sedan: "Sedans", Hatchback: "Hatchbacks", MUV: "MUVs", Coupe: "Coupés" };

/** The brand line-up: body-type tabs over a CarCard grid, or a feature for single-model brands. */
export function BrandModels({ cars }: { cars: CarModel[] }) {
  const types = ORDER.filter((t) => cars.some((c) => c.bodyType === t));
  const [tab, setTab] = useState<string>("all");
  const list = tab === "all" ? cars : cars.filter((c) => c.bodyType === tab);

  if (cars.length === 1) return <ModelFeature car={cars[0]} />;

  return (
    <div>
      {types.length > 1 && (
        <Tabs
          ariaLabel="Filter models by body type"
          value={tab}
          onChange={setTab}
          items={[
            { value: "all", label: "All models", count: cars.length },
            ...types.map((t) => ({ value: t, label: PLURAL[t], count: cars.filter((c) => c.bodyType === t).length })),
          ]}
        />
      )}
      <div className={cn("relative mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2", cars.length > 2 && "lg:grid-cols-3")}>
        <AnimatePresence mode="popLayout" initial={false}>
          {list.map((car) => (
            <motion.div
              key={car.slug}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <CarCard car={car} sizes={cars.length > 2 ? "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw" : "(min-width: 640px) 45vw, 92vw"} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Single-model brands get an editorial split instead of a lonely card. */
function ModelFeature({ car }: { car: CarModel }) {
  const { brandName } = useCatalog();
  const title = `${brandName(car.brand)} ${car.name}`;
  const ev = isElectric(car);
  return (
    <article className="grid grid-cols-1 border border-line lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-mist lg:aspect-auto lg:min-h-[460px]">
        <Image src={car.images[0]} alt={title} fill sizes="(min-width: 1024px) 56vw, 100vw" className="object-cover" style={{ objectPosition: car.focus ?? "50% 55%" }} />
      </div>
      <div className="flex flex-col p-6 sm:p-8 xl:p-12">
        <p className="type-eyebrow text-muted">{car.bodyType}</p>
        <h3 className="type-h2 mt-4">{car.name}</h3>
        <p className="type-editorial mt-3 text-[20px] text-ink/70">{car.tagline}</p>
        <p className="mt-6 text-[17px] font-semibold num">{formatPriceRange(car.priceMin, car.priceMax)}</p>
        <p className="mt-0.5 text-[11.5px] text-muted">Ex-showroom · indicative</p>
        <div className="mt-8 grid grid-cols-2 gap-6 border-t border-line pt-6">
          <Spec icon={<Fuel />} label="Fuel" value={fuelSummary(car)} />
          <Spec icon={<Cog />} label="Gearbox" value={transmissionSummary(car)} />
          <Spec icon={ev ? <Zap /> : <Gauge />} label={ev ? "Claimed range" : "Claimed mileage"} value={bestEfficiency(car)} />
          <Spec icon={<ShieldCheck />} label="Safety" value={car.safetyRating > 0 ? `${car.safetyRating}★ · ${car.safetyAgency}` : "Not tested"} />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-4 pt-10">
          <Button href={carHref(car)} variant="dark" arrow>
            View {car.name}
          </Button>
          <CompareToggle slug={car.slug} label={title} />
        </div>
      </div>
    </article>
  );
}
