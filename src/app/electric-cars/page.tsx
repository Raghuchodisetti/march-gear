import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, Home, PlugZap, Route, Zap } from "lucide-react";
import { electricCars } from "@/data/cars";
import { brandName } from "@/data/brands";
import { upcomingCars } from "@/data/upcoming";
import { IMG } from "@/data/images";
import { formatINR, formatMonth, formatPriceRange } from "@/lib/format";
import { Badge, DemoNote } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Carousel } from "@/components/ui/carousel";
import { Counter, Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { Eyebrow, SectionHeading } from "@/components/ui/section-heading";
import { dcMinutes } from "@/components/listing/ev-utils";
import { ListingSkeleton } from "@/components/listing/listing-skeleton";
import { EvExplorer } from "./_components/ev-explorer";

export const metadata: Metadata = {
  title: "Electric cars in India — range, charging & prices",
  description:
    "Every electric car on sale in India, compared by claimed range, battery size and DC fast-charging time. Plus a plain-English guide to AC vs DC charging.",
};

const EVS = electricCars();
const longest = Math.max(...EVS.map((c) => c.ev?.rangeKm ?? 0));
const fastest = Math.min(...EVS.map(dcMinutes));
const cheapest = Math.min(...EVS.map((c) => c.priceMin));
const upcomingEvs = upcomingCars.filter((c) => c.fuel === "Electric").sort((a, b) => a.expectedLaunch.localeCompare(b.expectedLaunch));

/* Running-cost teaser — indicative assumptions, stated on the page. */
const KM_PER_MONTH = 1200;
const PETROL = { pricePerLitre: 103, kmpl: 15 };
const EV = { pricePerKwh: 8, kmPerKwh: 6.5 };
const petrolPerKm = PETROL.pricePerLitre / PETROL.kmpl;
const evPerKm = EV.pricePerKwh / EV.kmPerKwh;
const yearlySaving = Math.round(((petrolPerKm - evPerKm) * KM_PER_MONTH * 12) / 1000) * 1000;

/* Time to add ~200 km at 6.5 km/kWh (~31 kWh), with typical average power. */
const CHARGE_TIMES = [
  { label: "3.3 kW portable charger", kind: "AC", minutes: 570 },
  { label: "7.2 kW home wallbox", kind: "AC", minutes: 260 },
  { label: "11 kW wallbox (3-phase)", kind: "AC", minutes: 170 },
  { label: "60 kW public DC", kind: "DC", minutes: 38 },
  { label: "150 kW public DC", kind: "DC", minutes: 16 },
];
const maxMinutes = Math.max(...CHARGE_TIMES.map((c) => c.minutes));

function duration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export default function ElectricCarsPage() {
  const lakh = cheapest / 100_000;

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <Image
          src={IMG.heroEvDusk}
          alt=""
          fill
          preload
          sizes="100vw"
          className="-z-10 animate-kenburns object-cover opacity-50"
          style={{ objectPosition: "50% 60%" }}
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/60 to-ink/30" />
        <div className="container-x pb-12 pt-10 md:pb-16 md:pt-14">
          <Breadcrumbs items={[{ label: "Electric cars" }]} tone="light" />
          <Reveal className="mt-20 max-w-4xl md:mt-36">
            <Eyebrow tone="light">Electric cars</Eyebrow>
            <h1 className="type-display mt-6 text-balance">
              Electric Vehicle <span className="type-editorial font-normal text-white/85">Universe</span>
            </h1>
            <p className="type-lead mt-6 max-w-xl text-white/70">
              Every EV on sale in India, measured by what matters day to day — how far it goes, how quickly it charges and what it really costs to run.
            </p>
          </Reveal>

          <dl className="mt-16 grid grid-cols-2 border-t border-white/15 md:mt-24 md:grid-cols-4">
            <HeroStat label="Electric models on sale">
              <Counter to={EVS.length} />
            </HeroStat>
            <HeroStat label="Longest claimed range">
              <Counter to={longest} suffix=" km" />
            </HeroStat>
            <HeroStat label="Fastest DC top-up">
              <Counter to={fastest} suffix=" min" />
            </HeroStat>
            <HeroStat label="Starting ex-showroom">
              <Counter to={lakh} decimals={2} prefix="₹" suffix=" L" />
            </HeroStat>
          </dl>
        </div>
      </section>

      {/* ── Listing ──────────────────────────────────────────── */}
      <section aria-labelledby="ev-listing-title">
        <div className="container-x flex flex-col gap-4 pt-14 md:flex-row md:items-end md:justify-between md:pt-20">
          <div>
            <Eyebrow>On sale now</Eyebrow>
            <h2 id="ev-listing-title" className="type-h2 mt-5">
              Every electric car, by range
            </h2>
          </div>
          <DemoNote>Claimed (MIDC) figures · indicative demo pricing</DemoNote>
        </div>
        <Suspense fallback={<ListingSkeleton cards={6} />}>
          <EvExplorer />
        </Suspense>
      </section>

      {/* ── AC vs DC ─────────────────────────────────────────── */}
      <section className="border-t border-line py-20 md:py-28">
        <div className="container-x">
          <SectionHeading
            eyebrow="Charging, explained"
            title={
              <>
                AC or DC — <span className="type-editorial font-normal">what actually matters</span>
              </>
            }
            description="Most EV owners do more than 80% of their charging at home on AC. DC fast charging is the road-trip tool — quick, but pricier per unit."
          />

          <div className="mt-14 grid grid-cols-1 border-y border-line md:mt-20 md:grid-cols-2">
            <ChargeMode
              code="AC"
              title="Alternating current"
              where="Home & workplace wallboxes"
              icon={<Home aria-hidden className="size-4" />}
              facts={[
                ["Typical power", "3.3 – 11 kW"],
                ["Full charge, 50 kWh", "5 – 15 hours"],
                ["Indicative cost", "₹7 – 9 per kWh"],
              ]}
              note="The car's on-board charger converts AC to DC, which caps speed. Slow, cheap and gentle on the battery — ideal overnight."
            />
            <ChargeMode
              code="DC"
              title="Direct current"
              where="Highway & city fast-charging hubs"
              icon={<PlugZap aria-hidden className="size-4" />}
              facts={[
                ["Typical power", "30 – 350 kW"],
                ["10 – 80%, 50 kWh", "20 – 60 minutes"],
                ["Indicative cost", "₹18 – 25 per kWh"],
              ]}
              note="Power flows straight to the battery, bypassing the on-board charger. Charging slows above ~80% to protect the cells."
              className="border-t border-line md:border-l md:border-t-0"
            />
          </div>

          <div className="mt-14 grid grid-cols-1 gap-10 md:mt-20 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
            <div>
              <h3 className="type-h3">Time to add 200 km</h3>
              <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-muted">
                Indicative, for an EV averaging 6.5 km per kWh. Actual times vary with battery temperature, state of charge and charger load.
              </p>
            </div>
            <RevealGroup className="space-y-5" gap={0.06}>
              {CHARGE_TIMES.map((c) => (
                <RevealItem key={c.label}>
                  <div className="flex items-baseline justify-between gap-4 text-[13.5px]">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className={`type-eyebrow w-7 shrink-0 ${c.kind === "DC" ? "text-red" : "text-muted"}`}>{c.kind}</span>
                      <span className="truncate text-ink">{c.label}</span>
                    </span>
                    <span className="shrink-0 font-semibold num">{duration(c.minutes)}</span>
                  </div>
                  <div className="mt-2 h-[3px] w-full bg-line">
                    <div className={`h-full ${c.kind === "DC" ? "bg-red" : "bg-ink"}`} style={{ width: `${Math.max(2, (c.minutes / maxMinutes) * 100)}%` }} />
                  </div>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </div>
      </section>

      {/* ── Savings teaser ───────────────────────────────────── */}
      <section className="bg-mist py-20 md:py-28">
        <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center lg:gap-20">
          <Reveal>
            <Eyebrow>Running costs</Eyebrow>
            <h2 className="type-h2 mt-5 text-balance">
              About <span className="type-editorial font-normal">a fifth</span> of the cost per kilometre.
            </h2>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-muted">
              Charged mostly at home, an electric car typically costs a fraction of a petrol equivalent to run. Plug in your own commute, tariff and fuel price for an honest number.
            </p>
            <Button href="/tools/ev-vs-petrol" className="mt-9" arrow>
              Calculate your savings
            </Button>
          </Reveal>

          <Reveal delay={0.1} className="border border-line bg-white p-6 sm:p-8 md:p-10">
            <p className="type-eyebrow text-muted">Cost per km · indicative</p>
            <div className="mt-8 space-y-7">
              <CostBar label="Petrol hatchback / SUV" detail={`₹${PETROL.pricePerLitre}/L at ${PETROL.kmpl} kmpl`} perKm={petrolPerKm} max={petrolPerKm} tone="ink" />
              <CostBar label="Electric, home charging" detail={`₹${EV.pricePerKwh}/kWh at ${EV.kmPerKwh} km/kWh`} perKm={evPerKm} max={petrolPerKm} tone="red" />
            </div>
            <div className="mt-10 border-t border-line pt-6">
              <p className="text-[13px] text-muted">Indicative yearly saving at {KM_PER_MONTH.toLocaleString("en-IN")} km a month</p>
              <p className="type-h2 mt-2 num">
                <Counter to={yearlySaving} prefix="₹" />
              </p>
              <DemoNote className="mt-2 block">Assumptions shown above · not financial advice</DemoNote>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Upcoming EVs ─────────────────────────────────────── */}
      {upcomingEvs.length > 0 && (
        <section className="overflow-hidden py-20 md:py-28">
          <div className="container-x">
            <Carousel
              label="upcoming electric cars"
              itemClassName="w-[78%] sm:w-[44%] lg:w-[30%] xl:w-[23.5%]"
              headerSlot={
                <SectionHeading
                  eyebrow="Coming soon"
                  title="The next wave of EVs"
                  description={`${upcomingEvs.length} electric launches expected over the coming months. Dates and prices are indicative.`}
                  align="left"
                />
              }
            >
              {upcomingEvs.map((car) => (
                <Link key={car.slug} href="/upcoming-cars?fuel=electric" className="group/up block">
                  <div className="relative aspect-[4/5] overflow-hidden bg-ink">
                    <Image
                      src={car.image}
                      alt={`${brandName(car.brand)} ${car.name} (representative image)`}
                      fill
                      sizes="(min-width: 1280px) 24vw, (min-width: 1024px) 30vw, (min-width: 640px) 44vw, 78vw"
                      className="object-cover opacity-90 transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/up:scale-[1.04]"
                    />
                    <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
                    <Badge tone="glass" className="absolute left-4 top-4">
                      {formatMonth(car.expectedLaunch)}
                    </Badge>
                    <div className="absolute inset-x-5 bottom-5 text-white">
                      <p className="type-eyebrow text-white/60">{brandName(car.brand)}</p>
                      <h3 className="type-h3 mt-2">{car.name}</h3>
                      <p className="mt-2 flex items-center gap-1.5 text-[13px] text-white/75">
                        <Zap aria-hidden className="size-3.5 text-red" />
                        {car.highlights[0]}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between gap-3">
                    <p className="text-[14px] font-semibold num">{formatPriceRange(car.priceMin, car.priceMax)}</p>
                    <p className="text-[11px] text-muted">Expected · indicative</p>
                  </div>
                </Link>
              ))}
            </Carousel>
          </div>
        </section>
      )}

      {/* ── Closing links ────────────────────────────────────── */}
      <section className="border-t border-line">
        <div className="container-x grid grid-cols-1 divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {[
            { href: "/compare?cars=tata-nexon-ev,mg-windsor-ev,hyundai-creta-electric", eyebrow: "Compare", title: "Nexon EV vs Windsor EV vs Creta Electric" },
            { href: "/tools/ev-vs-petrol", eyebrow: "Tool", title: "EV vs petrol: total cost of ownership" },
            { href: "/news?category=Electric", eyebrow: "Stories", title: "The latest from our EV desk" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="group/link flex items-start justify-between gap-6 py-8 md:px-8 md:py-12 md:first:pl-0 md:last:pr-0">
              <span>
                <span className="type-eyebrow text-muted">{l.eyebrow}</span>
                <span className="type-h4 mt-3 block text-balance">{l.title}</span>
              </span>
              <ArrowUpRight aria-hidden className="mt-6 size-5 shrink-0 text-red transition-transform duration-[250ms] group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function HeroStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/15 py-6 pr-4 even:border-l even:pl-5 [&:nth-child(n+3)]:border-b-0 md:border-b-0 md:border-l md:py-8 md:pl-6 md:first:border-l-0 md:first:pl-0 md:even:pl-6">
      <dt className="text-[12.5px] text-white/55">{label}</dt>
      <dd className="mt-2 font-display text-[34px] font-semibold leading-none tracking-[-0.035em] [font-stretch:108%] num md:text-[44px]">{children}</dd>
    </div>
  );
}

function ChargeMode({
  code,
  title,
  where,
  icon,
  facts,
  note,
  className,
}: {
  code: string;
  title: string;
  where: string;
  icon: React.ReactNode;
  facts: [string, string][];
  note: string;
  className?: string;
}) {
  return (
    <Reveal className={`py-10 md:px-10 md:py-14 md:first:pl-0 ${className ?? ""}`}>
      <div className="flex items-end justify-between gap-6">
        <p className="font-display text-[88px] font-semibold leading-[0.8] tracking-[-0.06em] [font-stretch:115%] md:text-[120px]">{code}</p>
        <span className="mb-1 inline-flex items-center gap-2 text-[12.5px] text-muted">
          {icon}
          {where}
        </span>
      </div>
      <h3 className="type-h4 mt-8">{title}</h3>
      <dl className="mt-6 divide-y divide-line border-y border-line">
        {facts.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-3.5 text-[14px]">
            <dt className="text-muted">{k}</dt>
            <dd className="font-medium num">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 max-w-md text-[14px] leading-relaxed text-muted">{note}</p>
    </Reveal>
  );
}

function CostBar({ label, detail, perKm, max, tone }: { label: string; detail: string; perKm: number; max: number; tone: "ink" | "red" }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] font-medium">{label}</p>
          <p className="mt-0.5 text-[12px] text-muted">{detail}</p>
        </div>
        <p className="shrink-0 font-display text-[26px] font-semibold tracking-[-0.03em] num">
          {formatINR(perKm * 100)}
          <span className="sr-only"> per 100 km</span>
        </p>
      </div>
      <div className="mt-3 h-[3px] w-full bg-line">
        <div className={`h-full ${tone === "red" ? "bg-red" : "bg-ink"}`} style={{ width: `${(perKm / max) * 100}%` }} />
      </div>
      <p aria-hidden className="mt-1.5 text-right text-[11px] text-muted">
        per 100 km · <Route className="inline size-3" /> ₹{perKm.toFixed(2)}/km
      </p>
    </div>
  );
}
