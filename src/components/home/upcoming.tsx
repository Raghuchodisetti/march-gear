import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { formatMonth, formatPriceRange } from "@/lib/format";
import { Carousel } from "@/components/ui/carousel";
import { Eyebrow } from "@/components/ui/section-heading";

export async function UpcomingCars() {
  const { upcoming: upcomingCars, brandName } = await getCatalog();
  const list = [...upcomingCars].sort((a, b) => (a.expectedLaunch > b.expectedLaunch ? 1 : -1));
  return (
    <section aria-labelledby="upcoming-title" className="bg-mist py-14 md:py-20">
      <div className="container-x">
        <Carousel
          label="upcoming cars"
          itemClassName="w-[78%] sm:w-[44%] lg:w-[30%] xl:w-[23.5%]"
          headerSlot={
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:pr-10">
              <div>
                <Eyebrow>On the horizon</Eyebrow>
                <h2 id="upcoming-title" className="type-h2 mt-5 max-w-xl text-balance">
                  The 2027 launch calendar.
                </h2>
              </div>
              <p className="max-w-xs text-[13px] leading-relaxed text-muted">
                Expected dates and prices are indicative mock data, compiled for demonstration.{" "}
                <Link href="/upcoming-cars" className="font-medium text-ink underline-offset-4 hover:underline">
                  See the full calendar
                </Link>
              </p>
            </div>
          }
        >
          {list.map((car) => {
            const [mon, year] = formatMonth(car.expectedLaunch).split(" ");
            return (
              <Link key={car.slug} href="/upcoming-cars" className="group/up block">
                <article>
                  <div className="relative aspect-[4/5] overflow-hidden bg-ink text-white">
                    <Image
                      src={car.image}
                      alt={`${brandName(car.brand)} ${car.name} teaser`}
                      fill
                      sizes="(min-width: 1280px) 24vw, (min-width: 640px) 44vw, 78vw"
                      className="object-cover opacity-80 grayscale-[35%] transition-[transform,filter,opacity] duration-[900ms] ease-[var(--ease-premium)] group-hover/up:scale-[1.05] group-hover/up:opacity-95 group-hover/up:grayscale-0"
                    />
                    <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-ink/70 via-transparent to-ink/90" />
                    <div className="absolute left-5 top-5">
                      <p className="font-display text-5xl font-semibold uppercase leading-none tracking-[-0.04em] [font-stretch:115%]">{mon}</p>
                      <p className="mt-1 text-[13px] font-medium text-white/60 num">{year} · expected</p>
                    </div>
                    <span className="absolute right-5 top-5 rounded-full border border-white/30 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em]">
                      {car.fuel}
                    </span>
                    <div className="absolute inset-x-5 bottom-5">
                      <p className="text-[12px] text-white/60">{brandName(car.brand)}</p>
                      <h3 className="type-h3 mt-1">{car.name}</h3>
                      <p className="mt-3 line-clamp-2 max-h-0 text-[13px] leading-relaxed text-white/70 opacity-0 transition-all duration-[500ms] group-hover/up:max-h-12 group-hover/up:opacity-100">
                        {car.teaser}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-b border-line py-4">
                    <div>
                      <p className="text-[14px] font-semibold num">{formatPriceRange(car.priceMin, car.priceMax)}</p>
                      <p className="text-[11.5px] text-muted">Expected · indicative</p>
                    </div>
                    <ArrowUpRight className="size-4 text-muted transition-[transform,color] duration-[250ms] group-hover/up:-translate-y-0.5 group-hover/up:translate-x-0.5 group-hover/up:text-red" aria-hidden />
                  </div>
                </article>
              </Link>
            );
          })}
        </Carousel>
      </div>
    </section>
  );
}
