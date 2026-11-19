import type { CarModel } from "@/types";
import { Reveal } from "@/components/ui/reveal";
import { ArcGauge } from "./meters";
import { isEv, maxOf, minOf, peersOf } from "./utils";

/**
 * Engine & performance: four arc gauges scaled against comparable cars in the
 * catalogue (same class and body style), so the arcs mean something.
 */
export function CarPerformance({ car }: { car: CarModel }) {
  const ev = isEv(car);
  const peers = peersOf(car);
  const power = maxOf(car.power);
  const torque = maxOf(car.torque);
  const accel = maxOf(car.acceleration);
  const bestPower = Math.max(...peers.map((c) => maxOf(c.power)));
  const bestTorque = Math.max(...peers.map((c) => maxOf(c.torque)));
  const bestAccel = Math.min(...peers.map((c) => maxOf(c.acceleration)).filter((n) => n > 0));
  const bestSpeed = Math.max(...peers.map((c) => c.topSpeed));
  const peerLabel = `${peers.length} comparable ${car.isLuxury ? "luxury " : ""}cars`;

  const facts: [string, string][] = [
    [ev ? "Powertrain" : "Engine", car.engine],
    ["Power band", car.power],
    ["Torque band", car.torque],
    ["Gearbox", car.transmissions.join(" · ")],
    ...(ev && car.ev ? ([["Motor", `${car.ev.motorKw} kW`]] as [string, string][]) : []),
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-14 lg:grid-cols-4 lg:gap-x-10">
        <ArcGauge value={power} ratio={power / bestPower} label="Power" unit="bhp" caption={power === bestPower ? "Best in peer set" : `${Math.round((power / bestPower) * 100)}% of peer best`} />
        <ArcGauge value={torque} ratio={torque / bestTorque} label="Torque" unit="Nm" caption={torque === bestTorque ? "Best in peer set" : `${Math.round((torque / bestTorque) * 100)}% of peer best`} />
        <ArcGauge
          value={accel}
          decimals={1}
          ratio={accel > 0 ? bestAccel / accel : 0}
          label="0–100 km/h"
          unit="seconds"
          caption={accel === bestAccel ? "Quickest in peer set" : `Peer best ${bestAccel.toFixed(1)} s`}
        />
        <ArcGauge value={car.topSpeed} ratio={car.topSpeed / bestSpeed} label="Top speed" unit="km/h" caption={`Peer best ${bestSpeed} km/h`} />
      </div>

      <Reveal className="mt-16 grid grid-cols-1 gap-10 border-t border-white/10 pt-10 md:mt-20 lg:grid-cols-12">
        <p className="text-[13px] leading-relaxed text-white/50 lg:col-span-4">
          Arcs are scaled against the strongest figure among {peerLabel} on March Gear. Figures are for the most powerful variant
          {minOf(car.power) !== power ? "; entry versions produce less" : ""}.
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
