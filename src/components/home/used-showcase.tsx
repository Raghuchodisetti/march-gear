"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, RotateCcw, ShieldCheck, Tag } from "lucide-react";
import { usedCars } from "@/data/used-cars";
import { EASE } from "@/lib/motion";
import { Chip } from "@/components/ui/chip";
import { Counter } from "@/components/ui/reveal";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { UsedCarCard } from "@/components/vehicle/used-car-card";

const CITIES = ["All cities", "Mumbai", "New Delhi", "Bengaluru", "Hyderabad", "Pune"];

const PROMISES = [
  { icon: BadgeCheck, title: "200-point inspection", text: "Engine, chassis and electronics checked by certified engineers." },
  { icon: RotateCcw, title: "7-day return", text: "Not the one? Return it, no questions asked." },
  { icon: ShieldCheck, title: "1-year warranty", text: "Comprehensive cover on verified inventory." },
  { icon: Tag, title: "Fixed, fair pricing", text: "Market-benchmarked prices. No haggling." },
];

export function UsedShowcase() {
  const [city, setCity] = useState(CITIES[0]);
  const list = useMemo(() => {
    const pool = city === CITIES[0] ? usedCars : usedCars.filter((c) => c.city === city);
    return [...pool].sort((a, b) => Number(b.verified) - Number(a.verified) || b.inspectionScore - a.inspectionScore).slice(0, 4);
  }, [city]);

  return (
    <section aria-labelledby="used-title" className="border-t border-line py-20 md:py-28">
      <div className="container-x grid grid-cols-1 gap-14 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <Eyebrow>Certified pre-owned</Eyebrow>
            <h2 id="used-title" className="type-h2 mt-5 text-balance">
              Premium used cars, verified to the bolt.
            </h2>
            <div className="mt-8 grid grid-cols-2 gap-6 border-y border-line py-6">
              <div>
                <p className="font-display text-4xl font-semibold tracking-[-0.03em] num">
                  <Counter to={2400} suffix="+" />
                </p>
                <p className="mt-1 text-[13px] text-muted">verified listings</p>
              </div>
              <div>
                <p className="font-display text-4xl font-semibold tracking-[-0.03em] num">
                  <Counter to={140} />
                </p>
                <p className="mt-1 text-[13px] text-muted">cities covered</p>
              </div>
            </div>
            <ul className="mt-8 space-y-5">
              {PROMISES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <Icon className="mt-0.5 size-5 shrink-0 text-red" aria-hidden />
                  <div>
                    <p className="text-[15px] font-medium">{title}</p>
                    <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap items-center gap-5">
              <Button href="/used-cars?verified=1" variant="dark" arrow>
                Browse verified cars
              </Button>
              <TextLink href="/sell-car">Sell your car</TextLink>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Filter by city">
            {CITIES.map((c) => (
              <Chip key={c} selected={c === city} onClick={() => setCity(c)}>
                {c}
              </Chip>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={city}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="mt-8 no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0"
            >
              {list.map((car) => (
                <UsedCarCard key={car.id} car={car} className="w-[84%] shrink-0 snap-start sm:w-auto" sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 84vw" />
              ))}
              {list.length === 0 && (
                <p className="col-span-full border border-dashed border-line px-6 py-16 text-center text-muted">
                  No verified listings in {city} this week — check back soon or browse all cities.
                </p>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="mt-8 flex justify-end">
            <TextLink href={city === CITIES[0] ? "/used-cars" : `/used-cars?city=${encodeURIComponent(city)}`}>
              {city === CITIES[0] ? "View all used cars" : `All used cars in ${city}`}
            </TextLink>
          </div>
        </div>
      </div>
    </section>
  );
}
