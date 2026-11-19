"use client";

import { useState } from "react";
import { ArrowRight, Check, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/field";
import { Bar, RangeRing } from "./meters";

const JOURNEYS = [
  { from: "Mumbai", to: "Pune", km: 150, round: true },
  { from: "Bengaluru", to: "Mysuru", km: 145, round: true },
  { from: "Delhi", to: "Agra", km: 233, round: false },
  { from: "Delhi", to: "Jaipur", km: 281, round: false },
  { from: "Chennai", to: "Puducherry", km: 150, round: true },
  { from: "Mumbai", to: "Goa", km: 590, round: false },
];

type Mode = "claimed" | "real";

/** Range ring plus "what the range means" journeys, switchable between claimed and real-world. */
export function EvRangeJourneys({ range, realWorld }: { range: number; realWorld: number }) {
  const [mode, setMode] = useState<Mode>("real");
  const usable = mode === "claimed" ? range : realWorld;
  const commuteDays = Math.floor(usable / 40);

  return (
    <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-5">
        <div className="mx-auto w-full max-w-[380px]">
          <RangeRing range={range} realWorld={realWorld} tone="dark" />
        </div>
        <dl className="mt-10 grid grid-cols-2 gap-px bg-white/10">
          <div className="bg-ink-2 p-5">
            <dt className="text-[12px] text-white/50">40 km daily commute</dt>
            <dd className="mt-2 text-[22px] font-semibold num">{commuteDays} days</dd>
            <dd className="text-[12px] text-white/45">between charges</dd>
          </div>
          <div className="bg-ink-2 p-5">
            <dt className="text-[12px] text-white/50">Mumbai ↔ Pune legs</dt>
            <dd className="mt-2 text-[22px] font-semibold num">{(usable / 150).toFixed(1)}×</dd>
            <dd className="text-[12px] text-white/45">150 km each, one charge</dd>
          </div>
        </dl>
      </div>

      <div className="min-w-0 lg:col-span-7">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-white/60">
            Using <span className="font-semibold text-white num">{usable} km</span> of range per charge
          </p>
          <Segmented<Mode>
            tone="light"
            ariaLabel="Range basis"
            value={mode}
            onChange={setMode}
            options={[
              { value: "real", label: "Real-world" },
              { value: "claimed", label: "Claimed" },
            ]}
          />
        </div>

        <ul className="divide-y divide-white/10">
          {JOURNEYS.map((j, i) => {
            const distance = j.km * (j.round ? 2 : 1);
            const fits = distance <= usable;
            const stops = fits ? 0 : Math.ceil((distance - usable) / (usable * 0.7));
            return (
              <li key={`${j.from}-${j.to}`} className="py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className="flex items-center gap-2 text-[15px] font-medium">
                    {j.from}
                    <ArrowRight aria-hidden className="size-3.5 text-white/40" />
                    {j.to}
                    {j.round && <span className="text-white/50">and back</span>}
                  </p>
                  <p className="text-[13px] text-white/50 num">{distance} km</p>
                </div>
                <Bar
                  value={distance}
                  max={usable}
                  delay={i * 0.06}
                  className="mt-3"
                  trackClassName="bg-white/10"
                  barClassName={fits ? "bg-white" : "bg-red"}
                />
                <p className={cn("mt-2.5 flex items-center gap-2 text-[12.5px]", fits ? "text-white/70" : "text-white")}>
                  {fits ? (
                    <>
                      <Check aria-hidden className="size-3.5 text-red" /> On one charge, with <span className="num">{usable - distance} km</span> to spare
                    </>
                  ) : (
                    <>
                      <PlugZap aria-hidden className="size-3.5 text-red" />
                      {stops} fast-charge {stops === 1 ? "stop" : "stops"} on the way
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-[12px] text-white/45">
          Road distances are approximate. Real-world estimate assumes mixed driving with air-conditioning; fast-charge stops assume 10→80% top-ups.
        </p>
      </div>
    </div>
  );
}
