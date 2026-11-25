"use client";

import Image from "next/image";
import { carPhotoAlt } from "@/lib/image-alt";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Reveal } from "@/components/ui/reveal";
import { CarPlaceholder } from "@/components/vehicle/car-image";
import { isFactsOnly, known } from "@/lib/specs";
import type { CarModel } from "@/types";
import { useCarDetail } from "./context";
import { seatsLabel } from "./utils";

/** "4,330 mm long and 1,790 mm wide, with 190 mm of ground clearance." — only the published parts. */
function sizeSentence(car: CarModel) {
  const { length, width } = car.dimensions;
  const size = known(length) && known(width) ? `${formatNumber(length)} mm long and ${formatNumber(width)} mm wide` : "";
  const gc = known(car.groundClearance) ? `${formatNumber(car.groundClearance)} mm of ground clearance` : "";
  if (size && gc) return `${size}, with ${gc}.`;
  if (size) return `${size}.`;
  if (gc) return `${gc[0].toUpperCase()}${gc.slice(1)}.`;
  return "";
}

/** Interior & exterior: two editorial split blocks and a colour selector. */
export function CarDesign() {
  const { car, title } = useCarDetail();
  const [colorIndex, setColorIndex] = useState(0);
  const color = car.colors[colorIndex] ?? car.colors[0];
  // Models without photos yet show the body-type silhouette in the selected factory colour, and no cabin photo.
  const exteriorImage = car.images[2] ?? car.images[0];
  const interiorImage = car.images[1] ?? car.images[0];
  const size = sizeSentence(car);
  const interiorStats = [
    ["Wheelbase", known(car.dimensions.wheelbase) ? formatNumber(car.dimensions.wheelbase) : "", "mm"],
    ["Boot", known(car.bootSpace) ? `${car.bootSpace}` : "", "litres"],
    ["Seating", seatsLabel(car.seats), car.seats.length > 1 ? "layouts" : "seats"],
  ].filter(([, value]) => value);
  const exterior = car.features.find((g) => g.group === "Exterior")?.items.slice(0, 4) ?? [];
  const interior = [
    ...(car.features.find((g) => g.group === "Interior")?.items ?? []),
    ...(car.features.find((g) => g.group === "Comfort")?.items ?? []),
  ].slice(0, 4);

  return (
    <div className="space-y-20 md:space-y-28">
      {/* Exterior */}
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-7">
          <div className="relative aspect-[4/3] overflow-hidden bg-mist">
            {exteriorImage ? (
              <Image src={exteriorImage} alt={carPhotoAlt(exteriorImage, title, "exterior detail")} fill sizes="(min-width: 1024px) 56vw, 100vw" className="object-cover" />
            ) : (
              <CarPlaceholder bodyType={car.bodyType} paint={color?.hex} label={color ? "Colour swatch is approximate · photos coming soon" : undefined} />
            )}
            {color && (
              <div className="absolute bottom-4 left-4 flex items-center gap-2.5 bg-white/90 py-2 pl-2 pr-3.5 backdrop-blur-sm">
                <span aria-hidden className="size-5 rounded-full border border-ink/10" style={{ backgroundColor: color.hex }} />
                <span className="text-[12px] font-medium">{color.name}</span>
              </div>
            )}
          </div>
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-5">
          <p className="type-eyebrow text-muted">Exterior</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.h3
              key={color?.name ?? "none"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="type-h2 mt-5 text-balance"
            >
              {color ? `${car.name} in ${color.name}` : `The ${car.name}, outside`}
            </motion.h3>
          </AnimatePresence>
          {(size || car.colors.length > 0) && (
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              {size}
              {size && car.colors.length > 0 ? " " : ""}
              {car.colors.length > 0 && `Choose from ${car.colors.length} factory ${car.colors.length === 1 ? "colour" : "colours"}.`}
            </p>
          )}

          {color && (
          <div className="mt-8">
            <p className="text-[12.5px] text-muted" id={`${car.slug}-colours`}>
              Colour · <span className="font-medium text-ink">{color.name}</span>{" "}
              <span className="num">
                ({colorIndex + 1}/{car.colors.length})
              </span>
            </p>
            <div role="radiogroup" aria-labelledby={`${car.slug}-colours`} className="mt-4 flex flex-wrap gap-3">
              {car.colors.map((c, i) => {
                const active = i === colorIndex;
                return (
                  <button
                    key={c.name}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={c.name}
                    title={c.name}
                    onClick={() => setColorIndex(i)}
                    className={cn(
                      "relative inline-flex size-10 items-center justify-center rounded-full transition-[box-shadow] duration-[250ms]",
                      active ? "ring-2 ring-ink ring-offset-2" : "ring-1 ring-line ring-offset-2 hover:ring-ink/40",
                    )}
                  >
                    <span aria-hidden className="absolute inset-0 rounded-full border border-ink/10" style={{ backgroundColor: c.hex }} />
                    {active && <Check aria-hidden className="relative size-4 text-white mix-blend-difference" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {exterior.length > 0 && (
            <ul className="mt-10 border-t border-line">
              {exterior.map((f) => (
                <li key={f} className="border-b border-line py-3.5 text-[14px]">
                  {f}
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      </div>

      {/* Interior */}
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
        {interiorImage && (
          <Reveal className="lg:order-2 lg:col-span-7">
            <div className="relative aspect-[4/3] overflow-hidden bg-mist lg:aspect-[5/4]">
              <Image src={interiorImage} alt={carPhotoAlt(interiorImage, title, "cabin")} fill sizes="(min-width: 1024px) 56vw, 100vw" className="object-cover" />
            </div>
          </Reveal>
        )}
        <Reveal delay={0.1} className={interiorImage ? "lg:order-1 lg:col-span-5" : "lg:col-span-7"}>
          <p className="type-eyebrow text-muted">Interior</p>
          <h3 className="type-h2 mt-5 text-balance">
            {isFactsOnly(car) ? (
              <>Room for {seatsLabel(car.seats)}.</>
            ) : (
              <>
                Room for {seatsLabel(car.seats)}, <span className="type-editorial font-normal">considered</span> throughout.
              </>
            )}
          </h3>
          <dl className="mt-8 grid grid-cols-3 border-y border-line">
            {interiorStats.map(([label, value, unit]) => (
              <div key={label} className="border-l border-line py-5 pl-4 first:border-l-0 first:pl-0">
                <dt className="text-[12px] text-muted">{label}</dt>
                <dd className="mt-1.5 text-[20px] font-semibold num">{value}</dd>
                <dd className="text-[11.5px] text-muted">{unit}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-8 grid gap-3">
            {interior.map((f) => (
              <li key={f} className="flex items-center gap-3 text-[14px]">
                <span aria-hidden className="h-px w-4 bg-red" />
                {f}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </div>
  );
}
