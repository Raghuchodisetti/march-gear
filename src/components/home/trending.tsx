"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { CategorySlug } from "@/types";
import { carCategories, cars } from "@/data/cars";
import { EASE } from "@/lib/motion";
import { Carousel } from "@/components/ui/carousel";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { Tabs } from "@/components/ui/tabs";
import { CarCard } from "@/components/vehicle/car-card";

const FILTERS: { value: "all" | CategorySlug; label: string }[] = [
  { value: "all", label: "All" },
  { value: "suv", label: "SUVs" },
  { value: "sedan", label: "Sedans" },
  { value: "hatchback", label: "Hatchbacks" },
  { value: "electric", label: "Electric" },
  { value: "luxury", label: "Luxury" },
];

export function TrendingCars() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");

  const list = useMemo(() => {
    const pool = filter === "all" ? cars : cars.filter((c) => carCategories(c).includes(filter));
    // Trending first, then the strongest reviews.
    return [...pool].sort((a, b) => Number(!!b.trending) - Number(!!a.trending) || b.rating * b.reviewCount - a.rating * a.reviewCount).slice(0, 8);
  }, [filter]);

  return (
    <section aria-labelledby="trending-title" className="py-20 md:py-28">
      <div className="container-x">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow>Trending this week</Eyebrow>
            <h2 id="trending-title" className="type-h2 mt-5 max-w-xl text-balance">
              The cars India is researching right now.
            </h2>
          </div>
          <TextLink href="/new-cars?sort=popular">View all new cars</TextLink>
        </div>

        <Tabs
          className="mt-10"
          ariaLabel="Filter trending cars"
          items={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={filter}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="mt-10"
          >
            <Carousel label="trending cars" controls="bottom" itemClassName="w-[82%] sm:w-[46%] lg:w-[31.5%] xl:w-[24%]">
              {list.map((car, i) => (
                <CarCard key={car.slug} car={car} priority={i < 2 && filter === "all"} />
              ))}
            </Carousel>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
