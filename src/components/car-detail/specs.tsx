import Link from "next/link";
import type { CarModel } from "@/types";
import { getCatalog } from "@/server/catalog";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NOT_PUBLISHED, accelText, known, powerBhp, specText } from "@/lib/specs";
import { SpecRow } from "./section";
import { Bar } from "./meters";
import { competitorsOf, isEv, seatsLabel } from "./utils";

/** Facts-only data stores unpublished figures as 0 / "": they read "—" here. */
const mm = (n: number) => (known(n) ? `${formatNumber(n)} mm` : NOT_PUBLISHED);

export function specGroups(car: CarModel) {
  const ev = isEv(car);
  return [
    {
      title: ev ? "Motor, battery & drive" : "Engine & transmission",
      rows: [
        [ev ? "Powertrain" : "Engine", specText(car.engine)],
        ["Max power", specText(car.power)],
        ["Max torque", specText(car.torque)],
        ["Fuel type", car.fuelTypes.join(", ")],
        ["Transmission", car.transmissions.join(", ")],
        ...(ev && car.ev
          ? [
              ["Battery", `${car.ev.batteryKwh} kWh`],
              ["Motor output", specText(car.ev.motorKw, " kW")],
              ["DC fast charge", specText(car.ev.dcCharge)],
              ["AC charge", specText(car.ev.acCharge)],
            ]
          : car.fuelTank
            ? [["Fuel tank", `${car.fuelTank} litres`]]
            : []),
      ] as [string, string][],
    },
    {
      title: "Dimensions & capacity",
      rows: [
        ["Length", mm(car.dimensions.length)],
        ["Width", mm(car.dimensions.width)],
        ["Height", mm(car.dimensions.height)],
        ["Wheelbase", mm(car.dimensions.wheelbase)],
        ["Ground clearance", mm(car.groundClearance)],
        ["Boot space", specText(car.bootSpace, " litres")],
        ["Seating", `${seatsLabel(car.seats)} seats`],
      ] as [string, string][],
    },
    {
      title: "Performance & efficiency",
      rows: [
        ["0–100 km/h", specText(accelText(car.acceleration))],
        ["Top speed", specText(car.topSpeed, " km/h")],
        [ev ? "Claimed range" : "Claimed efficiency", specText(car.efficiency && car.ev?.rangeStandard ? `${car.efficiency} (${car.ev.rangeStandard})` : car.efficiency)],
        ["Airbags", known(car.airbags) ? `Up to ${car.airbags}` : NOT_PUBLISHED],
        ["Crash rating", car.safetyAgency === "Not tested" ? "Not tested" : `${car.safetyRating}-star, ${car.safetyAgency}`],
      ] as [string, string][],
    },
  ];
}

/** Three grouped spec tables. Shared by the model and variant pages. */
export function SpecTables({ car, dark, className }: { car: CarModel; dark?: boolean; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-12", className)}>
      {specGroups(car).map((g) => (
        <div key={g.title}>
          <h3 className={cn("type-h4 border-b pb-4", dark ? "border-white/40" : "border-ink")}>{g.title}</h3>
          <dl>
            {g.rows.map(([label, value]) => (
              <SpecRow key={label} label={label} value={value} dark={dark} />
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

/** Horizontal bars measuring the car against its listed competitors. */
export async function SpecComparison({ car }: { car: CarModel }) {
  const cat = await getCatalog();
  const { brandName } = cat;
  const rivals = competitorsOf(car, cat, 3);
  if (rivals.length === 0) return null;
  const field = [car, ...rivals];

  // Only figures the makers publish; a metric needs this car and at least one rival to be worth drawing.
  const metrics = [
    { title: "Max power", unit: "bhp", value: (c: CarModel) => powerBhp(c.power) ?? 0 },
    { title: "Boot space", unit: "litres", value: (c: CarModel) => c.bootSpace },
    { title: "Ground clearance", unit: "mm", value: (c: CarModel) => c.groundClearance },
  ].filter((m) => m.value(car) > 0 && rivals.some((r) => m.value(r) > 0));
  if (metrics.length === 0) return null;

  return (
    <div className="mt-16 bg-mist p-6 md:mt-20 md:p-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="type-eyebrow text-muted">Visualised</p>
          <h3 className="type-h3 mt-3">How it measures up</h3>
        </div>
        <p className="max-w-sm text-[13px] text-muted">
          Against its closest rivals — the {car.name} is shown in red. Bars are scaled to the best figure in each group.
        </p>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8 lg:gap-12">
        {metrics.map((m) => {
          const shown = field.filter((c) => m.value(c) > 0);
          const best = Math.max(...shown.map(m.value));
          return (
            <div key={m.title}>
              <p className="flex items-baseline justify-between border-b border-ink pb-3">
                <span className="type-h4">{m.title}</span>
                <span className="text-[12px] text-muted">{m.unit}</span>
              </p>
              <ul className="mt-5 space-y-4">
                {shown.map((c, i) => {
                  const self = c.slug === car.slug;
                  const v = m.value(c);
                  return (
                    <li key={c.slug}>
                      <div className="mb-2 flex items-baseline justify-between gap-3 text-[13px]">
                        {self ? (
                          <span className="truncate font-semibold">{c.name}</span>
                        ) : (
                          <Link href={`/cars/${c.slug}`} className="truncate text-muted hover:text-ink">
                            {brandName(c.brand)} {c.name}
                          </Link>
                        )}
                        <span className={cn("shrink-0 num", self ? "font-semibold" : "text-muted")}>{formatNumber(v)}</span>
                      </div>
                      <Bar
                        value={v}
                        max={best}
                        delay={i * 0.08}
                        barClassName={self ? "bg-red" : "bg-ink/30"}
                        trackClassName="bg-white"
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
