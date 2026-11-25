import type { CarModel } from "@/types";
import { getCatalog } from "@/server/catalog";
import { Reveal } from "@/components/ui/reveal";
import { NOT_PUBLISHED, accelSeconds, known, powerBhp, specText, torqueNm } from "@/lib/specs";
import { ArcGauge } from "./meters";
import { isEv, maxOf, minOf, peersOf } from "./utils";

/**
 * Engine & performance: four arc gauges scaled against comparable cars in the
 * catalogue (same class and body style), so the arcs mean something.
 */
export async function CarPerformance({ car }: { car: CarModel }) {
  const ev = isEv(car);
  const peers = peersOf(car, await getCatalog());
  // Gauges compare published figures only (power in bhp, converted from kW/PS where needed).
  const power = powerBhp(car.power) ?? 0;
  const torque = torqueNm(car.torque) ?? 0;
  const accel = accelSeconds(car.acceleration) ?? 0;
  const bestPower = Math.max(power, ...peers.map((c) => powerBhp(c.power) ?? 0));
  const bestTorque = Math.max(torque, ...peers.map((c) => torqueNm(c.torque) ?? 0));
  const accels = [accel, ...peers.map((c) => accelSeconds(c.acceleration) ?? 0)].filter((n) => n > 0);
  const bestAccel = accels.length ? Math.min(...accels) : 0;
  const bestSpeed = Math.max(car.topSpeed, ...peers.map((c) => c.topSpeed));
  const peerLabel = `${peers.length} comparable ${car.isLuxury ? "luxury " : ""}cars`;

  const facts: [string, string][] = [
    [ev ? "Powertrain" : "Engine", specText(car.engine)],
    ["Power band", specText(car.power)],
    ["Torque band", specText(car.torque)],
    ["Gearbox", car.transmissions.join(" · ")],
    ...(ev && car.ev ? ([["Motor", known(car.ev.motorKw) ? `${car.ev.motorKw} kW` : NOT_PUBLISHED]] as [string, string][]) : []),
  ];
  const gauges = [
    power > 0 && <ArcGauge key="p" value={power} ratio={power / bestPower} label="Power" unit="bhp" caption={power === bestPower ? "Best in peer set" : `${Math.round((power / bestPower) * 100)}% of peer best`} />,
    torque > 0 && <ArcGauge key="t" value={torque} ratio={torque / bestTorque} label="Torque" unit="Nm" caption={torque === bestTorque ? "Best in peer set" : `${Math.round((torque / bestTorque) * 100)}% of peer best`} />,
    accel > 0 && (
      <ArcGauge
        key="a"
        value={accel}
        decimals={1}
        ratio={bestAccel / accel}
        label="0–100 km/h"
        unit="seconds"
        caption={accel === bestAccel ? "Quickest in peer set" : `Peer best ${bestAccel.toFixed(1)} s`}
      />
    ),
    car.topSpeed > 0 && <ArcGauge key="s" value={car.topSpeed} ratio={car.topSpeed / bestSpeed} label="Top speed" unit="km/h" caption={`Peer best ${bestSpeed} km/h`} />,
  ].filter(Boolean);

  return (
    <div>
      {gauges.length > 0 && <div className="grid grid-cols-2 gap-x-6 gap-y-14 lg:grid-cols-4 lg:gap-x-10">{gauges}</div>}

      <Reveal className={gauges.length > 0 ? "mt-16 grid grid-cols-1 gap-10 border-t border-white/10 pt-10 md:mt-20 lg:grid-cols-12" : "grid grid-cols-1 gap-10 lg:grid-cols-12"}>
        <p className="text-[13px] leading-relaxed text-white/50 lg:col-span-4">
          {gauges.length > 0 ? (
            <>
              Arcs are scaled against the strongest figure among {peerLabel} on March Gear. Figures are for the most powerful variant
              {minOf(car.power) !== maxOf(car.power) ? "; entry versions produce less" : ""}.
            </>
          ) : (
            <>The maker hasn&rsquo;t published power, torque or performance figures for this model yet; the specification below is what&rsquo;s available.</>
          )}
        </p>
        <dl className="grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:col-span-8">
          {facts.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-6 border-b border-white/10 py-3.5 text-[14px]">
              <dt className="text-white/55">{label}</dt>
              <dd className="text-right font-medium num">{value}</dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </div>
  );
}
