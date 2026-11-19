import type { ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import type { CarModel, FeatureGroup } from "@/types";
import { isElectric } from "@/lib/catalog";
import { onRoadPrice } from "@/data/cities";
import { calculateEmi } from "@/lib/finance";
import { formatINR, formatNumber, formatPrice, formatPriceRange } from "@/lib/format";
import { RatingInline, ScoreBar, Stars } from "@/components/ui/rating";

export interface Cell {
  display: ReactNode;
  /** Value used to decide whether a row differs between cars */
  key: string;
  /** Numeric value used to find the best in the row */
  num?: number;
}

export interface SpecRow {
  id: string;
  label: string;
  hint?: string;
  best?: "max" | "min";
  cells: Cell[];
}

export interface SpecGroup {
  id: string;
  title: string;
  rows: SpecRow[];
}

const LOAN = { share: 0.8, rate: 9.5, months: 60 };

const nums = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
const maxOf = (s: string) => {
  const n = nums(s);
  return n.length ? Math.max(...n) : undefined;
};

const text = (value: string | number | undefined, unit = ""): Cell =>
  value === undefined || value === "" ? { display: <span className="text-muted">—</span>, key: "—" } : { display: `${value}${unit}`, key: `${value}${unit}` };

function row(id: string, label: string, cars: CarModel[], fn: (car: CarModel) => Cell, opts: { hint?: string; best?: "max" | "min" } = {}): SpecRow {
  return { id, label, cells: cars.map(fn), ...opts };
}

/** Builds every comparison group for the selected cars, in display order. */
export function buildGroups(cars: CarModel[], city: { slug: string; name: string }): SpecGroup[] {
  const allEv = cars.every(isElectric);
  const noneEv = cars.every((c) => !isElectric(c));
  const sameEfficiencyKind = allEv || noneEv;

  const groups: SpecGroup[] = [
    {
      id: "overview",
      title: "Verdict",
      rows: [
        row(
          "expert",
          "Expert score",
          cars,
          (c) => ({
            display: <ScoreBar label={c.expertScore >= 8.5 ? "Outstanding" : c.expertScore >= 8 ? "Excellent" : c.expertScore >= 7.5 ? "Very good" : "Good"} value={c.expertScore} />,
            key: String(c.expertScore),
            num: c.expertScore,
          }),
          { best: "max", hint: "March Gear road test, out of 10" },
        ),
        row("rating", "Owner rating", cars, (c) => ({ display: <RatingInline value={c.rating} count={c.reviewCount} />, key: String(c.rating), num: c.rating }), {
          best: "max",
        }),
        row("body", "Body type", cars, (c) => text(c.bodyType)),
      ],
    },
    {
      id: "price",
      title: "Price & ownership",
      rows: [
        row("ex-showroom", "Ex-showroom price", cars, (c) => ({ display: formatPriceRange(c.priceMin, c.priceMax), key: `${c.priceMin}-${c.priceMax}`, num: c.priceMin }), {
          best: "min",
          hint: "Indicative",
        }),
        row(
          "on-road",
          `On-road, ${city.name}`,
          cars,
          (c) => {
            const v = onRoadPrice(c.priceMin, city.slug, isElectric(c));
            return { display: `${formatPrice(v)} onwards`, key: String(v), num: v };
          },
          { best: "min", hint: "Base variant, incl. RTO & insurance" },
        ),
        row(
          "emi",
          "EMI from",
          cars,
          (c) => {
            const v = Math.round(calculateEmi(onRoadPrice(c.priceMin, city.slug, isElectric(c)) * LOAN.share, LOAN.rate, LOAN.months));
            return { display: `${formatINR(v)}/mo`, key: String(v), num: v };
          },
          { best: "min", hint: `${LOAN.share * 100}% loan · ${LOAN.rate}% · ${LOAN.months / 12} yrs` },
        ),
        row("variants", "Variants", cars, (c) => ({ display: String(c.variants.length), key: String(c.variants.length), num: c.variants.length })),
      ],
    },
    {
      id: "engine",
      title: "Engine & performance",
      rows: [
        row("fuel", "Fuel", cars, (c) => text(c.fuelTypes.join(", "))),
        row("engine", "Engine / motor", cars, (c) => text(c.engine)),
        row("power", "Power", cars, (c) => ({ ...text(c.power), num: maxOf(c.power) }), { best: "max" }),
        row("torque", "Torque", cars, (c) => ({ ...text(c.torque), num: maxOf(c.torque) }), { best: "max" }),
        row("transmission", "Transmission", cars, (c) => text(c.transmissions.join(" / "))),
        row("acceleration", "0 – 100 km/h", cars, (c) => ({ ...text(c.acceleration), num: maxOf(c.acceleration) }), { best: "min" }),
        row("top-speed", "Top speed", cars, (c) => ({ ...text(c.topSpeed, " km/h"), num: c.topSpeed }), { best: "max" }),
      ],
    },
    {
      id: "efficiency",
      title: "Efficiency",
      rows: [
        row(
          "efficiency",
          allEv ? "Claimed range" : noneEv ? "Claimed mileage" : "Claimed mileage / range",
          cars,
          (c) => ({ ...text(c.efficiency), num: sameEfficiencyKind ? c.efficiencyValue : undefined }),
          { best: "max", hint: allEv ? "MIDC cycle" : "ARAI, best variant" },
        ),
        ...(cars.some(isElectric)
          ? [
              row("battery", "Battery", cars, (c) => (c.ev ? { ...text(c.ev.batteryKwh, " kWh"), num: c.ev.batteryKwh } : text(undefined)), { best: "max" }),
              row("dc", "DC fast charge", cars, (c) => (c.ev ? { ...text(c.ev.dcCharge), num: maxOf(c.ev.dcCharge.split("(")[0]) } : text(undefined)), {
                best: "min",
              }),
              row("ac", "AC charge", cars, (c) => (c.ev ? text(c.ev.acCharge) : text(undefined))),
            ]
          : []),
        ...(cars.some((c) => c.fuelTank) ? [row("tank", "Fuel tank", cars, (c) => (c.fuelTank ? { ...text(c.fuelTank, " L"), num: c.fuelTank } : text(undefined)), { best: "max" })] : []),
      ],
    },
    {
      id: "dimensions",
      title: "Dimensions & capacity",
      rows: [
        row("length", "Length", cars, (c) => ({ ...text(formatNumber(c.dimensions.length), " mm"), num: c.dimensions.length }), { best: "max" }),
        row("width", "Width", cars, (c) => ({ ...text(formatNumber(c.dimensions.width), " mm"), num: c.dimensions.width }), { best: "max" }),
        row("height", "Height", cars, (c) => text(formatNumber(c.dimensions.height), " mm")),
        row("wheelbase", "Wheelbase", cars, (c) => ({ ...text(formatNumber(c.dimensions.wheelbase), " mm"), num: c.dimensions.wheelbase }), { best: "max" }),
        row("boot", "Boot space", cars, (c) => ({ ...text(c.bootSpace, " L"), num: c.bootSpace }), { best: "max" }),
        row("clearance", "Ground clearance", cars, (c) => ({ ...text(c.groundClearance, " mm"), num: c.groundClearance }), { best: "max" }),
        row("seats", "Seats", cars, (c) => ({ ...text(c.seats.join(" / ")), num: Math.max(...c.seats) }), { best: "max" }),
      ],
    },
    {
      id: "safety",
      title: "Safety",
      rows: [
        row(
          "ncap",
          "Crash-test rating",
          cars,
          (c) =>
            c.safetyAgency === "Not tested" || c.safetyRating === 0
              ? { display: <span className="text-muted">Not tested</span>, key: "0", num: 0 }
              : {
                  display: (
                    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Stars value={c.safetyRating} size={13} />
                      <span className="num">{c.safetyRating}/5</span>
                    </span>
                  ),
                  key: String(c.safetyRating),
                  num: c.safetyRating,
                },
          { best: "max" },
        ),
        row("agency", "Tested by", cars, (c) => text(c.safetyAgency)),
        row("airbags", "Airbags", cars, (c) => ({ ...text(c.airbags), num: c.airbags }), { best: "max" }),
      ],
    },
  ];

  /* Feature presence matrix, one group per feature family. */
  const order: FeatureGroup["group"][] = ["Safety", "Comfort", "Infotainment", "Interior", "Exterior", "Performance"];
  for (const family of order) {
    const items: string[] = [];
    cars.forEach((c) =>
      c.features
        .filter((g) => g.group === family)
        .flatMap((g) => g.items)
        .forEach((i) => {
          if (!items.includes(i)) items.push(i);
        }),
    );
    if (!items.length) continue;
    groups.push({
      id: `features-${family.toLowerCase()}`,
      title: `Features · ${family === "Performance" ? "EV & performance" : family}`,
      rows: items.map((item) =>
        row(`f-${family}-${item}`, item, cars, (c) => {
          const has = c.features.some((g) => g.group === family && g.items.includes(item));
          return {
            key: has ? "yes" : "no",
            display: has ? (
              <span className="inline-flex items-center">
                <Check aria-hidden className="size-4 text-ink" strokeWidth={2.5} />
                <span className="sr-only">Available</span>
              </span>
            ) : (
              <span className="inline-flex items-center">
                <Minus aria-hidden className="size-4 text-ink/25" />
                <span className="sr-only">Not available</span>
              </span>
            ),
          };
        }),
      ),
    });
  }

  return groups;
}

/** Index set of cells holding the best numeric value in a row (empty if no clear winner). */
export function bestCells(r: SpecRow): Set<number> {
  if (!r.best) return new Set();
  const values = r.cells.map((c) => c.num).filter((n): n is number => n !== undefined);
  if (values.length < 2) return new Set();
  const target = r.best === "max" ? Math.max(...values) : Math.min(...values);
  if (values.every((v) => v === target)) return new Set();
  return new Set(r.cells.flatMap((c, i) => (c.num === target ? [i] : [])));
}

export function rowDiffers(r: SpecRow) {
  return new Set(r.cells.map((c) => c.key)).size > 1;
}
