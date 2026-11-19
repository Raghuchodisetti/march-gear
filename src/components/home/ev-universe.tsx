"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, BatteryCharging, Gauge, PlugZap } from "lucide-react";
import { electricCars } from "@/data/cars";
import { brandName } from "@/data/brands";
import { formatPriceRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Counter } from "@/components/ui/reveal";
import { Eyebrow } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";

const EVS = electricCars().sort((a, b) => a.priceMin - b.priceMin);
const MAX_RANGE = 700;

export function EvUniverse() {
  const [active, setActive] = useState(EVS.findIndex((c) => c.slug === "porsche-taycan"));
  const car = EVS[active] ?? EVS[0];
  const ev = car.ev!;

  return (
    <section aria-labelledby="ev-title" className="relative overflow-hidden bg-ink py-20 text-white md:py-28">
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full bg-red/10 blur-[120px]" />
      <div className="container-x relative">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Eyebrow tone="light">Electric vehicle universe</Eyebrow>
            <h2 id="ev-title" className="type-h1 mt-5 text-balance">
              Silent. Instant. <span className="type-editorial text-white/90">Inevitable.</span>
            </h2>
          </div>
          <p className="max-w-sm text-[15px] leading-relaxed text-white/60">
            Seven electric models, from city-friendly compacts to 870-horsepower grand tourers. Pick one to see how far it really goes.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Selector */}
          <div className="lg:col-span-4">
            <ul role="tablist" aria-label="Electric models" aria-orientation="vertical" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:block lg:space-y-0 lg:overflow-visible lg:px-0">
              {EVS.map((c, i) => {
                const on = i === active;
                return (
                  <li key={c.slug} className="shrink-0 lg:border-b lg:border-white/10">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setActive(i)}
                      className={cn(
                        "group relative flex w-full items-center justify-between gap-6 whitespace-nowrap rounded-full border px-4 py-2.5 text-left transition-colors duration-[350ms] lg:rounded-none lg:border-0 lg:px-0 lg:py-5",
                        on ? "border-white bg-white text-ink lg:bg-transparent lg:text-white" : "border-white/20 text-white/55 hover:text-white",
                      )}
                    >
                      <span className="flex items-center gap-4">
                        <span aria-hidden className={cn("hidden h-px bg-red transition-[width] duration-[400ms] lg:block", on ? "w-8" : "w-0")} />
                        <span>
                          <span className="hidden text-[12px] text-white/45 lg:block">{brandName(c.brand)}</span>
                          <span className="text-[14px] font-medium lg:font-display lg:text-xl lg:font-semibold lg:tracking-[-0.02em]">{c.name}</span>
                        </span>
                      </span>
                      <span className="hidden text-[13px] num lg:block">{c.ev!.rangeKm} km</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Stage */}
          <div className="lg:col-span-8">
            <div className="relative aspect-[16/10] overflow-hidden bg-ink-2">
              <AnimatePresence initial={false}>
                <motion.div
                  key={car.slug}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 1.06 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: EASE }}
                >
                  <Image src={car.images[0]} alt={`${brandName(car.brand)} ${car.name}`} fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" style={{ objectPosition: car.focus ?? "50% 55%" }} />
                </motion.div>
              </AnimatePresence>
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 md:p-8">
                <AnimatePresence mode="wait">
                  <motion.div key={car.slug} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.5, ease: EASE }}>
                    <p className="text-[12px] text-white/60">{brandName(car.brand)}</p>
                    <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
                      <h3 className="type-h2">{car.name}</h3>
                      <p className="text-[15px] font-semibold num">{formatPriceRange(car.priceMin, car.priceMax)}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Range + specs */}
            <div className="mt-px grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-3">
              <Stat icon={<Gauge />} label="Claimed range" value={<><span className="num">{ev.rangeKm}</span> km</>} />
              <Stat icon={<BatteryCharging />} label="Battery" value={<><span className="num">{ev.batteryKwh}</span> kWh</>} />
              <Stat icon={<PlugZap />} label="DC fast charge" value={ev.dcCharge} />
            </div>
            <div className="bg-ink-2 px-5 py-5 md:px-6">
              <div className="flex items-center justify-between text-[12px] text-white/50">
                <span>0 km</span>
                <span>Mumbai → Pune and back ≈ 300 km</span>
                <span>{MAX_RANGE} km</span>
              </div>
              <div className="relative mt-3 h-[3px] bg-white/10">
                <motion.div className="absolute inset-y-0 left-0 bg-red" animate={{ width: `${(ev.rangeKm / MAX_RANGE) * 100}%` }} transition={{ duration: 0.9, ease: EASE }} />
                <span aria-hidden className="absolute -top-1 h-[11px] w-px bg-white/60" style={{ left: `${(300 / MAX_RANGE) * 100}%` }} />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button href="/electric-cars" variant="light" arrow>
                Discover electric cars
              </Button>
              <Link href={`/electric-cars/${car.slug}`} className="group inline-flex items-center gap-1.5 text-[14px] font-medium text-white/80 hover:text-white">
                Explore the {car.name}
                <ArrowUpRight className="size-4 text-red transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-10 border-t border-white/10 pt-12 sm:grid-cols-3">
          <Fact value={<Counter to={6.1} decimals={1} suffix="%" />} label="of new cars sold in October were electric" />
          <Fact value={<Counter to={25000} suffix="+" />} label="public charging points nationwide" />
          <Fact value={<Counter to={1.2} decimals={1} prefix="₹" suffix="/km" />} label="typical home-charging running cost" />
        </div>
        <p className="mt-6 text-[11.5px] text-white/35">Market figures are illustrative demo data.</p>
      </div>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-ink-2 px-5 py-5 md:px-6">
      <p className="flex items-center gap-2 text-[12px] text-white/50 [&>svg]:size-4 [&>svg]:text-red">
        {icon}
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em]">{value}</p>
    </div>
  );
}

function Fact({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <p className="font-display text-5xl font-semibold tracking-[-0.04em] num md:text-6xl">{value}</p>
      <p className="mt-3 max-w-[16rem] text-[14px] leading-relaxed text-white/55">{label}</p>
    </div>
  );
}
