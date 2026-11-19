"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Clock, MapPin, Star } from "lucide-react";
import { cities } from "@/data/cities";
import { EASE } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { useCity, useUI } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";

export function DealerNetwork() {
  const { city, setCity } = useCity();
  const { openEnquiry } = useUI();
  const { dealers, brandName } = useCatalog();

  const { list, local } = useMemo(() => {
    const inCity = dealers.filter((d) => d.city === city.name);
    if (inCity.length >= 1) {
      const rest = dealers.filter((d) => d.city !== city.name).sort((a, b) => b.rating - a.rating);
      return { list: [...inCity, ...rest].slice(0, 3), local: inCity.length };
    }
    return { list: [...dealers].sort((a, b) => b.rating - a.rating).slice(0, 3), local: 0 };
  }, [city.name, dealers]);

  return (
    <section aria-labelledby="dealers-title" className="py-14 md:py-20">
      <div className="container-x">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow>Dealer network</Eyebrow>
            <h2 id="dealers-title" className="type-h2 mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <span>Trusted showrooms near</span>
              <span className="group relative inline-flex items-center gap-2 border-b-2 border-red pb-1">
                <MapPin className="size-6 text-red md:size-8" aria-hidden />
                <span>{city.name}</span>
                <ChevronDown className="size-5 text-muted transition-transform group-hover:translate-y-0.5" aria-hidden />
                <label htmlFor="dealer-city" className="sr-only">
                  Choose city
                </label>
                <select id="dealer-city" value={city.slug} onChange={(e) => setCity(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
                  {cities.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </span>
            </h2>
          </div>
          <p className="max-w-sm text-[14px] leading-relaxed text-muted">
            {local > 0
              ? `${local} partner showroom${local > 1 ? "s" : ""} in ${city.name}, plus our highest-rated dealers nationwide.`
              : `We're onboarding partners in ${city.name}. Here are our highest-rated showrooms nationwide.`}
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={city.slug}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="no-scrollbar -mx-5 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-2 md:gap-5 md:overflow-visible md:px-0 lg:grid-cols-3"
          >
            {list.map((d) => (
              <article key={d.id} className="group/dealer flex w-[86%] shrink-0 snap-start flex-col border md:w-auto border-line transition-colors duration-[400ms] hover:border-ink/25">
                <Link href={`/dealers/${d.id}`} className="relative block aspect-[16/9] overflow-hidden bg-ink">
                  <Image src={d.image} alt={`${d.name} showroom`} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover opacity-90 transition-transform duration-[900ms] ease-[var(--ease-premium)] group-hover/dealer:scale-[1.04]" />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 bg-white px-2 py-1 text-[12px] font-semibold num">
                    <Star className="size-3 fill-ink" aria-hidden /> {d.rating.toFixed(1)}
                    <span className="font-normal text-muted">({d.reviewCount.toLocaleString("en-IN")})</span>
                  </span>
                  {d.city === city.name && (
                    <span className="absolute right-3 top-3 bg-ink/75 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm num">{d.distanceKm} km away</span>
                  )}
                </Link>
                <div className="flex flex-1 flex-col p-5 md:p-6">
                  <p className="type-eyebrow text-muted">{brandName(d.brand)}</p>
                  <h3 className="type-h3 mt-2">
                    <Link href={`/dealers/${d.id}`} className="hover:text-red">
                      {d.name}
                    </Link>
                  </h3>
                  <p className="mt-2 flex items-center gap-1.5 text-[13.5px] text-muted">
                    <MapPin className="size-3.5" aria-hidden /> {d.area}, {d.city}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-muted">
                    <Clock className="size-3.5" aria-hidden /> {d.hours}
                  </p>
                  <ul className="mt-5 flex flex-wrap gap-1.5">
                    {d.services.slice(0, 3).map((s) => (
                      <li key={s} className="bg-mist px-2.5 py-1 text-[12px]">
                        {s}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto flex gap-2 pt-6">
                    <Button size="sm" variant="dark" className="flex-1" onClick={() => openEnquiry({ kind: "contact-dealer", subject: d.name, detail: `${d.area}, ${d.city}`, dealerId: d.id })}>
                      Contact dealer
                    </Button>
                    <Button size="sm" variant="outline" href={`/dealers/${d.id}`}>
                      Showroom
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </motion.div>
        </AnimatePresence>

        <div className="mt-10 flex justify-end">
          <TextLink href={`/dealers?city=${encodeURIComponent(city.name)}`}>Find all dealers</TextLink>
        </div>
      </div>
    </section>
  );
}
