import { Coffee, Moon, Zap } from "lucide-react";
import type { EvSpec } from "@/types";
import { Reveal } from "@/components/ui/reveal";
import { Bar } from "./meters";
import { formatDuration, numbersIn, parseAc, parseDc } from "./utils";

/** Charging timeline: DC fast top-up against a full AC charge on one time axis. */
export function EvChargingTimeline({ ev }: { ev: EvSpec }) {
  const dc = parseDc(ev.dcCharge);
  const ac = parseAc(ev.acCharge);
  const axisHours = Math.max(1, Math.ceil(ac.hours));
  const step = axisHours > 8 ? 2 : 1;
  const ticks = Array.from({ length: Math.floor(axisHours / step) + 1 }, (_, i) => i * step);
  const axisMinutes = axisHours * 60;

  // Range added by one DC session: either stated in km, or a state-of-charge window.
  const windowNums = numbersIn(dc.window);
  const dcKm = /km/.test(dc.window) ? windowNums[0] : windowNums.length >= 2 ? ((windowNums[1] - windowNums[0]) / 100) * ev.rangeKm : ev.rangeKm * 0.7;
  const kmPer10 = Math.round((dcKm / Math.max(1, dc.minutes)) * 10);
  const acKmPerHour = Math.round(ev.rangeKm / Math.max(0.5, ac.hours));
  const windowLabel = /km/.test(dc.window) ? dc.window : dc.window.replace("–", " → ");

  const rows = [
    {
      key: "dc",
      label: "DC fast charge",
      detail: windowLabel,
      minutes: dc.minutes,
      bar: "bg-red",
      icon: <Zap aria-hidden className="size-4 text-red" />,
    },
    {
      key: "ac",
      label: "AC home charge",
      detail: `0 → 100% · ${ac.power} wallbox`,
      minutes: ac.hours * 60,
      bar: "bg-white",
      icon: <Moon aria-hidden className="size-4 text-white/70" />,
    },
  ];

  return (
    <div>
      <Reveal className="bg-ink-2 p-6 md:p-10">
        <div className="space-y-10">
          {rows.map((r, i) => (
            <div key={r.key}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="flex items-center gap-2.5 text-[15px] font-medium">
                  {r.icon}
                  {r.label}
                  <span className="text-[13px] font-normal text-white/50">{r.detail}</span>
                </p>
                <p className="font-display text-[22px] font-semibold tracking-[-0.02em] num">{formatDuration(r.minutes)}</p>
              </div>
              <Bar value={r.minutes} max={axisMinutes} delay={i * 0.15} className="h-3" trackClassName="bg-white/[0.06]" barClassName={r.bar} />
            </div>
          ))}
        </div>
        <div className="relative mt-4 h-5" aria-hidden>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute top-0 -translate-x-1/2 text-[11px] text-white/50 num first:translate-x-0 last:-translate-x-full"
              style={{ left: `${(t / axisHours) * 100}%` }}
            >
              {t}h
            </span>
          ))}
        </div>
      </Reveal>

      <div className="mt-px grid grid-cols-1 gap-px bg-white/10 md:grid-cols-3">
        <div className="bg-ink p-6 md:p-8">
          <Coffee aria-hidden className="size-5 text-red" />
          <p className="mt-6 text-[22px] font-semibold num">+{kmPer10} km</p>
          <p className="mt-1 text-[13px] text-white/55">of range for every 10 minutes on a DC fast charger — about a coffee stop.</p>
        </div>
        <div className="bg-ink p-6 md:p-8">
          <Moon aria-hidden className="size-5 text-white/70" />
          <p className="mt-6 text-[22px] font-semibold num">+{acKmPerHour} km/h</p>
          <p className="mt-1 text-[13px] text-white/55">added per hour on a {ac.power} home wallbox. Plug in overnight, leave full.</p>
        </div>
        <div className="bg-ink p-6 md:p-8">
          <Zap aria-hidden className="size-5 text-white/70" />
          <p className="mt-6 text-[22px] font-semibold num">{ev.batteryKwh} kWh</p>
          <p className="mt-1 text-[13px] text-white/55">battery driving a {ev.motorKw} kW motor. Charging speeds taper above 80%.</p>
        </div>
      </div>
    </div>
  );
}
