import type { Metadata } from "next";
import Image from "next/image";
import { carPhotoAlt } from "@/lib/image-alt";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { carFaqs } from "@/data/car-faqs";
import { formatPrice, formatPriceShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Accordion } from "@/components/ui/accordion";
import { Eyebrow } from "@/components/ui/section-heading";
import { Counter, Reveal } from "@/components/ui/reveal";
import { WishlistButton } from "@/components/vehicle/toggles";
import { DetailSection } from "@/components/car-detail/section";
import { ShareButton } from "@/components/car-detail/buy-actions";
import { EnquiryButtons } from "@/components/car-detail/variant-buy";
import { BottomActionBar } from "@/components/car-detail/bottom-bar";
import { Bar } from "@/components/car-detail/meters";
import { EvRangeJourneys } from "@/components/car-detail/ev-range";
import { EvChargingTimeline } from "@/components/car-detail/ev-charging";
import { EvCostCalculator } from "@/components/car-detail/ev-cost";
import { fitDescription, fitTitle, pageMetadata } from "@/components/seo/metadata";
import { CarPlaceholder } from "@/components/vehicle/car-image";
import { NOT_PUBLISHED, isFactsOnly, known, specText, accelText } from "@/lib/specs";
import {
  BOTTOM_BAR_PADDING,
  REAL_WORLD_FACTOR,
  competitorsOf,
  efficiencyOf,
  isEv,
  pad2,
  parseAc,
  parseDc,
  sortedVariants,
} from "@/components/car-detail/utils";

export async function generateStaticParams() {
  const { electricCars } = await getCatalog();
  return electricCars().map((car) => ({ slug: car.slug }));
}

export async function generateMetadata(props: PageProps<"/electric-cars/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const { getCar, brandName } = await getCatalog();
  const car = getCar(slug);
  if (!car || !isEv(car) || !car.ev) return { title: "Electric car not found" };
  const brand = brandName(car.brand);
  const name = `${brand} ${car.name}`;
  return pageMetadata({
    title: fitTitle([`${name} Range, Battery & Charging`, `${name} Range & Charging`, `${car.name} Range & Charging`, `${name} EV`]),
    description: fitDescription(
      car.ev.dcCharge
        ? `${name}: up to ${car.ev.rangeKm} km claimed range, a ${car.ev.batteryKwh} kWh battery and DC fast charging in ${car.ev.dcCharge}.`
        : `${name}: up to ${car.ev.rangeKm} km claimed range and a ${car.ev.batteryKwh} kWh battery.`,
      "Real-world range, charging times, running costs and variants.",
    ),
    path: `/electric-cars/${car.slug}`,
    images: "segment",
  });
}

export default async function ElectricCarPage(props: PageProps<"/electric-cars/[slug]">) {
  const { slug } = await props.params;
  const cat = await getCatalog();
  const { brandName } = cat;
  const car = cat.getCar(slug);
  if (!car || !isEv(car) || !car.ev) notFound();

  const ev = car.ev;
  const brand = brandName(car.brand);
  const title = `${brand} ${car.name}`;
  const realWorld = Math.round(ev.rangeKm * REAL_WORLD_FACTOR);
  const dc = parseDc(ev.dcCharge);
  const ac = parseAc(ev.acCharge);
  const variants = sortedVariants(car);
  const base = variants[0];
  const maxRange = Math.max(ev.rangeKm, ...variants.map((v) => efficiencyOf(v).value));
  const rivals = competitorsOf(car, cat, 3);
  const compareHref = `/compare?cars=${[car.slug, ...rivals.map((r) => r.slug)].join(",")}`;
  const faqs = carFaqs(car, cat);
  const evTech = Array.from(new Set([...(car.features.find((g) => g.group === "Performance")?.items ?? []), ...car.highlights])).slice(0, 7);
  const techImage = car.images[1] ?? car.images[0];
  const factsOnly = isFactsOnly(car);
  // Charging times as published; the timeline needs both a DC and an AC time to draw.
  const timeline = dc.minutes > 0 && ac.hours > 0;
  const showTech = evTech.length > 0 || Boolean(techImage);
  const order = ["range", "charging", "running-costs", ...(showTech ? ["ev-technology"] : []), "variants", "faqs"];
  const idx = (id: string) => pad2(order.indexOf(id) + 1);

  // A figure the maker doesn't publish reads as a dash (with the published wording, if any, underneath).
  const heroStats: { label: string; value?: number; decimals?: number; suffix?: string; note: string }[] = [
    { label: "Claimed range", value: ev.rangeKm, decimals: 0, suffix: " km", note: ev.rangeStandard ? `${ev.rangeStandard} · ≈ ${realWorld} km real-world` : `≈ ${realWorld} km real-world` },
    { label: "Battery", value: ev.batteryKwh, decimals: ev.batteryKwh % 1 ? 1 : 0, suffix: " kWh", note: known(ev.motorKw) ? `${ev.motorKw} kW motor` : "Motor output not published" },
    dc.minutes > 0 ? { label: "DC fast charge", value: dc.minutes, decimals: 0, suffix: " min", note: dc.window } : { label: "DC fast charge", note: ev.dcCharge || "Not published" },
    ac.hours > 0
      ? { label: "AC home charge", value: ac.hours, decimals: ac.hours % 1 ? 1 : 0, suffix: " h", note: ac.power ? `${ac.power} wallbox` : "Home wallbox" }
      : { label: "AC home charge", note: ev.acCharge || "Not published" },
  ];

  return (
    <div className={cn("bg-ink text-white", BOTTOM_BAR_PADDING)}>
      {/* Cinematic hero */}
      <section aria-labelledby="ev-title" className="relative isolate flex min-h-[88svh] flex-col overflow-hidden">
        {car.images[0] ? (
          <Image
            src={car.images[0]}
            alt={carPhotoAlt(car.images[0], title)}
            fill
            preload
            sizes="100vw"
            className="-z-10 animate-kenburns object-cover opacity-60"
            style={{ objectPosition: car.focus ?? "50% 55%" }}
          />
        ) : (
          <div className="absolute inset-0 -z-10">
            {/* No photo yet: the silhouette sits above the title; the label would collide with it, so it's left out here. */}
            <CarPlaceholder bodyType={car.bodyType} tone="dark" label={null} className="hidden justify-start pt-[11svh] opacity-80 md:flex" />
          </div>
        )}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/55 to-ink/30" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/70 via-transparent to-transparent" />

        <div className="container-x pt-6 md:pt-8">
          <Breadcrumbs
            tone="light"
            items={[
              { label: "Electric Cars", href: "/electric-cars" },
              { label: brand, href: `/brands/${car.brand}` },
              { label: car.name },
            ]}
          />
        </div>

        <div className="container-x mt-auto pb-10 pt-24 md:pb-14">
          <Reveal className="max-w-4xl">
            <Eyebrow tone="light">Electric · {brand}</Eyebrow>
            <h1 id="ev-title" className="type-display mt-6 text-balance">
              <span className="sr-only">{brand} </span>
              {car.name}
            </h1>
            <p className="type-lead mt-5 max-w-xl text-white/70">{car.tagline}</p>
          </Reveal>

          <div className="mt-9 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <EnquiryButtons title={title} detail={base.name} carSlug={car.slug} />
              <div className="flex items-center gap-2">
                <WishlistButton id={car.slug} label={title} tone="dark" />
                <ShareButton label={title} tone="dark" />
              </div>
            </div>
            <p className="text-[13px] text-white/55">
              From <span className="font-semibold text-white num">{formatPrice(car.priceMin)}</span> · {car.priceCity ? `ex-showroom ${car.priceCity}` : "ex-showroom, indicative"}
            </p>
          </div>

          <dl className="mt-12 grid grid-cols-2 border-t border-white/15 lg:grid-cols-4">
            {heroStats.map((s, i) => (
              <div
                key={s.label}
                className={cn(
                  "border-white/15 pt-6 lg:pb-2",
                  i > 0 && "lg:border-l lg:pl-8",
                  i % 2 === 1 && "border-l pl-5",
                  i >= 2 && "mt-6 border-t lg:mt-0 lg:border-t-0",
                )}
              >
                <dt className="type-eyebrow text-white/50">{s.label}</dt>
                <dd className="mt-4">
                  {s.value !== undefined ? (
                    <Counter
                      to={s.value}
                      decimals={s.decimals}
                      suffix={s.suffix}
                      className="font-display text-[clamp(1.75rem,1.3rem+1.8vw,3rem)] font-semibold leading-none tracking-[-0.03em] num"
                    />
                  ) : (
                    <span className="font-display text-[clamp(1.75rem,1.3rem+1.8vw,3rem)] font-semibold leading-none tracking-[-0.03em] text-white/40">{NOT_PUBLISHED}</span>
                  )}
                  <span className="mt-2 block text-[12.5px] text-white/50">{s.note}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <DetailSection
        id="range"
        index={idx("range")}
        eyebrow="Range"
        tone="dark"
        title={
          <>
            {ev.rangeKm} km, <span className="type-editorial font-normal">in real terms.</span>
          </>
        }
        description="What a single charge covers on journeys you know. Switch between the claimed figure and our real-world estimate."
      >
        <EvRangeJourneys range={ev.rangeKm} realWorld={realWorld} />
      </DetailSection>

      <DetailSection
        id="charging"
        index={idx("charging")}
        eyebrow="Charging"
        tone="dark"
        title={timeline ? "Top up over coffee. Fill up overnight." : "Charging, as published."}
        description={
          ev.dcCharge && ev.acCharge
            ? `DC fast charging takes ${ev.dcCharge}; a full charge on a home wallbox takes ${ev.acCharge}.`
            : ev.dcCharge
              ? `DC fast charging: ${ev.dcCharge}. The maker doesn't publish an AC charging time.`
              : ev.acCharge
                ? `AC charging: ${ev.acCharge}. The maker doesn't publish a DC fast-charging time.`
                : "The maker hasn't published charging times for this model yet."
        }
      >
        {timeline ? (
          <EvChargingTimeline ev={ev} />
        ) : (
          <dl className="grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-2">
            {[
              ["DC fast charge", ev.dcCharge],
              ["AC charge", ev.acCharge],
            ].map(([label, value]) => (
              <div key={label} className="bg-ink-2 p-6">
                <dt className="type-eyebrow text-white/50">{label}</dt>
                <dd className="mt-3 text-[16px] font-medium">{value || "Not published"}</dd>
              </div>
            ))}
          </dl>
        )}
      </DetailSection>

      <DetailSection
        id="running-costs"
        index={idx("running-costs")}
        eyebrow="Running costs"
        tone="dark"
        title="What it costs to run, charged at home."
        description={`Move the slider to your daily distance. Compared with an equivalent petrol car at ₹${cat.content.toolRates.fuelPrices.petrol} per litre and 15 kmpl.`}
      >
        <EvCostCalculator batteryKwh={ev.batteryKwh} rangeKm={ev.rangeKm} name={car.name} />
      </DetailSection>

      {showTech && (
      <DetailSection id="ev-technology" index={idx("ev-technology")} eyebrow="EV technology" tone="dark" title={factsOnly ? "The electric drivetrain." : "Engineered electric, end to end."}>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-12">
          <Reveal className="lg:col-span-5">
            {techImage && (
              <div className="relative aspect-[4/5] overflow-hidden bg-ink-2 max-lg:aspect-[4/3]">
                <Image src={techImage} alt={carPhotoAlt(techImage, title, "charging and technology detail")} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover opacity-90" />
              </div>
            )}
            <dl className="mt-px grid grid-cols-3 gap-px bg-white/10">
              {[
                ["Power", specText(car.power)],
                ["Torque", specText(car.torque)],
                ["0–100", specText(accelText(car.acceleration))],
              ].map(([label, value]) => (
                <div key={label} className="bg-ink-2 p-4">
                  <dt className="text-[11.5px] text-white/50">{label}</dt>
                  <dd className="mt-1 text-[13.5px] font-medium num">{value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-7">
            <ol className="border-t border-white/10">
              {evTech.map((f, i) => (
                <li key={f} className="flex items-baseline gap-6 border-b border-white/10 py-5">
                  <span className="w-6 shrink-0 text-[12px] font-medium text-red num">{pad2(i + 1)}</span>
                  <span className="type-h4 font-medium">{f}</span>
                </li>
              ))}
            </ol>
            {car.overview.trim() && <p className="mt-6 max-w-lg text-[14px] leading-relaxed text-white/55">{car.overview}</p>}
          </Reveal>
        </div>
      </DetailSection>
      )}

      <DetailSection
        id="variants"
        index={idx("variants")}
        eyebrow="Variants"
        tone="dark"
        title="Choose your range."
        description="Claimed range and ex-showroom price for every variant. Open one for its full on-road breakdown."
      >
        <ul className="border-t border-white/10">
          {variants.map((v, i) => {
            const range = efficiencyOf(v).value;
            return (
              <li key={v.slug} className="border-b border-white/10">
                <Link
                  href={`/cars/${car.slug}/${v.slug}`}
                  className="group grid grid-cols-1 gap-4 py-6 transition-colors duration-[250ms] hover:bg-white/[0.03] md:grid-cols-[1.2fr_2fr_140px_32px] md:items-center md:gap-8 md:px-4"
                >
                  <span className="min-w-0">
                    <span className="block text-[16px] font-medium">{v.name}</span>
                    {v.features.length > 0 && <span className="mt-0.5 block text-[12.5px] text-white/50">{v.features.join(" · ")}</span>}
                  </span>
                  <span className="flex items-center gap-4">
                    <Bar value={range} max={maxRange} delay={i * 0.08} trackClassName="bg-white/10" barClassName={range === maxRange ? "bg-red" : "bg-white"} />
                    <span className="w-16 shrink-0 text-right text-[15px] font-semibold num">{range > 0 ? `${range} km` : NOT_PUBLISHED}</span>
                  </span>
                  <span className="flex items-center justify-between md:block md:text-right">
                    <span className="text-[12px] text-white/50 md:hidden">Ex-showroom</span>
                    <span className="text-[15px] num">{formatPriceShort(v.price)}</span>
                  </span>
                  <ArrowRight aria-hidden className="hidden size-4 text-red transition-transform duration-[250ms] group-hover:translate-x-0.5 md:block" />
                </Link>
              </li>
            );
          })}
        </ul>
      </DetailSection>

      {/* Onward journeys */}
      <section aria-label={`More on the ${title}`} className="container-x pb-14 md:pb-20">
        <div className="grid grid-cols-1 gap-px bg-white/10 md:grid-cols-2">
          <Link href={`/cars/${car.slug}`} className="group relative isolate flex min-h-[300px] flex-col justify-end overflow-hidden bg-ink-2 p-6 md:min-h-[380px] md:p-10">
            {car.images[0] && (
              <Image
                src={car.images[0]}
                alt=""
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="-z-10 object-cover opacity-45 transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover:scale-[1.04]"
                style={{ objectPosition: car.focus ?? "50% 55%" }}
              />
            )}
            <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
            <span className="type-eyebrow text-white/60">Full model page</span>
            <span className="type-h2 mt-4 flex items-end justify-between gap-6">
              The complete {car.name} story
              <ArrowUpRight aria-hidden className="size-7 shrink-0 text-red transition-transform duration-[250ms] group-hover:-translate-y-1 group-hover:translate-x-1" />
            </span>
            <span className="mt-3 max-w-md text-[14px] text-white/60">
              {factsOnly ? "Specifications, safety, features, every variant and owner reviews." : "Specifications, safety, features, gallery, expert and owner reviews."}
            </span>
          </Link>
          <Link href={compareHref} className="group flex min-h-[300px] flex-col justify-between bg-ink-2 p-6 transition-colors duration-[400ms] hover:bg-ink-3 md:min-h-[380px] md:p-10">
            <span className="type-eyebrow text-white/60">Compare</span>
            <span>
              <span className="type-h2 flex items-end justify-between gap-6">
                {car.name} vs rivals
                <ArrowUpRight aria-hidden className="size-7 shrink-0 text-red transition-transform duration-[250ms] group-hover:-translate-y-1 group-hover:translate-x-1" />
              </span>
              <span className="mt-6 block border-t border-white/10">
                {rivals.map((r) => (
                  <span key={r.slug} className="flex items-baseline justify-between gap-4 border-b border-white/10 py-3 text-[14px]">
                    <span className="truncate">
                      {brandName(r.brand)} {r.name}
                    </span>
                    <span className="shrink-0 text-white/50 num">{r.efficiency || NOT_PUBLISHED}</span>
                  </span>
                ))}
              </span>
            </span>
          </Link>
        </div>
      </section>

      <DetailSection id="faqs" index={idx("faqs")} eyebrow="FAQs" tone="dark" title="Questions, answered.">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <p className="max-w-xs text-[15px] leading-relaxed text-white/55 lg:col-span-4">
            Charging, range and ownership answers for the {title}, generated from our specification data.
          </p>
          <div className="min-w-0 lg:col-span-8">
            <Accordion tone="light" items={faqs.map((f) => ({ id: f.id, title: f.question, content: f.answer }))} defaultOpen={[faqs[0]?.id]} />
          </div>
        </div>
      </DetailSection>

      <div aria-hidden className="container-x">
        <div className="border-t border-white/10" />
      </div>

      <BottomActionBar tone="dark" exShowroom={base.price} ev subject={title} detail={base.name} carSlug={car.slug} />
    </div>
  );
}
