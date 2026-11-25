import type { Metadata } from "next";
import { carPhotoAlt } from "@/lib/image-alt";
import { CarImage } from "@/components/vehicle/car-image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Plus } from "lucide-react";
import type { CarModel, Variant } from "@/types";
import { getVariant } from "@/lib/catalog";
import { getCatalog } from "@/server/catalog";
import { creditFor } from "@/server/photo-credits";
import { PhotoCreditLine } from "@/components/vehicle/photo-credit";
import { formatPrice, formatPriceShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { DetailSection, SpecRow } from "@/components/car-detail/section";
import { SpecTables } from "@/components/car-detail/specs";
import { OnRoadBreakdown } from "@/components/car-detail/on-road-breakdown";
import { EnquiryButtons, VariantBuyPanel } from "@/components/car-detail/variant-buy";
import { BottomActionBar } from "@/components/car-detail/bottom-bar";
import { BOTTOM_BAR_PADDING, competitorsOf, efficiencyOf, isEv, pad2, sortedVariants } from "@/components/car-detail/utils";
import { fitDescription, fitTitle, pageMetadata } from "@/components/seo/metadata";

/** "Petrol · Manual · 18.4 kmpl" without empty parts (some variants have no published figure). */
const variantLine = (v: Pick<Variant, "fuel" | "transmission" | "efficiency">) => [v.fuel, v.transmission, v.efficiency].filter(Boolean).join(" · ");

/**
 * Prebuilt at deploy for models with editorial content; the researched catalogue's thousands of other
 * variant pages render on first visit and are cached from then on.
 */
export async function generateStaticParams() {
  const { cars } = await getCatalog();
  return cars.filter((car) => car.images.length > 0 && car.overview.trim()).flatMap((car) => car.variants.map((v) => ({ slug: car.slug, variant: v.slug })));
}

export async function generateMetadata(props: PageProps<"/cars/[slug]/[variant]">): Promise<Metadata> {
  const { slug, variant: variantSlug } = await props.params;
  const { getCar, brandName } = await getCatalog();
  const car = getCar(slug);
  const variant = car && getVariant(car, variantSlug);
  if (!car || !variant) return { title: "Variant not found" };
  const brand = brandName(car.brand);
  const full = `${brand} ${car.name} ${variant.name}`;
  return pageMetadata({
    title: fitTitle([`${full} Price & Specs`, `${full} Price`, `${car.name} ${variant.name} Price & Specs`, `${car.name} ${variant.name} Price`, `${car.name} ${variant.name}`]),
    description: fitDescription(
      `${full}: ${[variant.fuel, variant.transmission, variant.efficiency].filter(Boolean).join(", ")}.`,
      [
        `Ex-showroom ${formatPrice(variant.price)} (${car.priceCity ?? "indicative"}), with the on-road price by city, features and full specifications.`,
        `Ex-showroom ${formatPrice(variant.price)} (${car.priceCity ?? "indicative"}), on-road price by city, features and specs.`,
        `${formatPrice(variant.price)} ex-showroom (${car.priceCity ?? "indicative"}), features and specs.`,
      ],
    ),
    path: `/cars/${car.slug}/${variant.slug}`,
    images: "segment",
  });
}

/** What the next trim up adds (or, for the flagship, what it adds over the previous one). */
function stepDiff(car: CarModel, variant: Variant) {
  const list = sortedVariants(car);
  const i = list.findIndex((v) => v.slug === variant.slug);
  const next = list[i + 1];
  const prev = list[i - 1];
  const [from, to] = next ? [variant, next] : prev ? [prev, variant] : [undefined, undefined];
  if (!from || !to) return null;

  const changes: string[] = [];
  if (from.fuel !== to.fuel) changes.push(`${to.fuel} instead of ${from.fuel.toLowerCase()}`);
  if (from.transmission !== to.transmission) changes.push(`${to.transmission} gearbox instead of ${from.transmission.toLowerCase()}`);
  const a = efficiencyOf(from);
  const b = efficiencyOf(to);
  if (a.unit === b.unit && a.value !== b.value) {
    const d = Number((b.value - a.value).toFixed(2));
    changes.push(`${d > 0 ? "+" : ""}${d} ${b.unit} claimed ${isEv(car) ? "range" : "efficiency"}`);
  }
  const adds = to.features.filter((f) => !from.features.includes(f));
  return { mode: next ? ("next" as const) : ("previous" as const), from, to, delta: to.price - from.price, adds, changes };
}

export default async function VariantPage(props: PageProps<"/cars/[slug]/[variant]">) {
  const { slug, variant: variantSlug } = await props.params;
  const cat = await getCatalog();
  const car = cat.getCar(slug);
  const variant = car && getVariant(car, variantSlug);
  if (!car || !variant) notFound();

  const brand = cat.brandName(car.brand);
  const title = `${brand} ${car.name}`;
  const ev = isEv(car);
  const variants = sortedVariants(car);
  const position = variants.findIndex((v) => v.slug === variant.slug) + 1;
  const diff = stepDiff(car, variant);
  const highlights = car.highlights.slice(0, 4);
  const showFeatures = variant.features.length > 0 || highlights.length > 0;
  // Section numbers follow the sections actually shown.
  const order = ["price-breakdown", ...(showFeatures ? ["key-features"] : []), ...(diff ? ["step-up"] : []), "specifications", "other-variants"];
  const idx = (id: string) => pad2(order.indexOf(id) + 1);
  const heroCredit = await creditFor(car.images[0]);

  return (
    <div className={BOTTOM_BAR_PADDING}>
      {/* Opener */}
      <section aria-labelledby="variant-title" className="border-b border-line">
        <div className="container-x pt-6 md:pt-8">
          <Breadcrumbs
            items={[
              { label: "New Cars", href: "/new-cars" },
              { label: brand, href: `/brands/${car.brand}` },
              { label: car.name, href: `/cars/${car.slug}` },
              { label: variant.name },
            ]}
          />
          <Link
            href={`/cars/${car.slug}#variants`}
            className="group mt-8 inline-flex items-center gap-2 text-[13px] font-medium text-muted transition-colors hover:text-ink md:mt-10"
          >
            <ArrowLeft aria-hidden className="size-4 transition-transform duration-[250ms] group-hover:-translate-x-0.5" />
            All {car.name} variants
          </Link>
        </div>

        <div className="container-x grid grid-cols-1 gap-10 pb-14 pt-8 md:pb-20 lg:grid-cols-12 lg:gap-12">
          <div className="min-w-0 lg:col-span-7">
            <div className="relative aspect-[4/3] overflow-hidden bg-mist md:aspect-[16/10]">
              <CarImage
                car={car}
                // A genuine photo shows the model, not necessarily this variant, so it says what it shows.
                alt={heroCredit?.alt ?? (car.images[0] ? carPhotoAlt(car.images[0], `${title} ${variant.name}`) : "")}
                preload
                sizes="(min-width: 1024px) 56vw, 100vw"
                className="object-cover"
                style={{ objectPosition: car.focus ?? "50% 55%" }}
                name={title}
              />
              <span className="absolute left-4 top-4">
                <Badge tone="glass">
                  Variant {pad2(position)} of {pad2(variants.length)}
                </Badge>
              </span>
            </div>
            {heroCredit && <PhotoCreditLine credit={heroCredit} allCredits={`/photo-credits#${car.slug}`} className="mt-3" />}
          </div>

          <div className="min-w-0 lg:col-span-5 lg:pt-2">
            <Eyebrow>{title}</Eyebrow>
            <h1 id="variant-title" className="type-h1 mt-5 text-balance">
              <span className="sr-only">{title} </span>
              {variant.name}
            </h1>
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Variant summary">
              {[variant.fuel, variant.transmission, variant.efficiency, `${car.seats.join(" / ")} seats`].filter(Boolean).map((t) => (
                <li key={t} className="inline-flex h-8 items-center rounded-full border border-line px-3.5 text-[12.5px] font-medium">
                  {t}
                </li>
              ))}
            </ul>
            <VariantBuyPanel slug={car.slug} title={title} variantName={variant.name} price={variant.price} ev={ev} className="mt-8" />
          </div>
        </div>
      </section>

      <DetailSection
        id="price-breakdown"
        index={idx("price-breakdown")}
        eyebrow="On-road price"
        divider={false}
        title="What you'll actually pay."
        description="The ex-showroom price plus registration, insurance and handling for your city. Switch city to compare."
      >
        <OnRoadBreakdown exShowroom={variant.price} ev={ev} variantName={variant.name} />
      </DetailSection>

      {showFeatures && (
      <DetailSection id="key-features" index={idx("key-features")} eyebrow="Key features" title={`What defines the ${variant.name}.`}>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
          {variant.features.length === 0 && (
            <p className="max-w-xl text-[15px] text-muted lg:col-span-8">
              {car.name} equipment by variant hasn&rsquo;t been listed in our catalogue yet — the range-wide highlights are alongside.
            </p>
          )}
          {variant.features.length > 0 && (
          <ol
            className={cn(
              "grid grid-cols-1 gap-px border border-line bg-line lg:col-span-8",
              variant.features.length === 2 && "sm:grid-cols-2",
              variant.features.length >= 3 && "sm:grid-cols-3",
            )}
          >
            {variant.features.map((f, i) => (
              <li key={f} className="flex bg-white">
                <Reveal delay={i * 0.06} className="flex min-h-40 w-full flex-col p-6">
                  <span className="text-[12px] font-medium text-red num">{pad2(i + 1)}</span>
                  <span className="type-h4 mt-auto pt-10">{f}</span>
                </Reveal>
              </li>
            ))}
          </ol>
          )}
          {highlights.length > 0 && (
          <div className="lg:col-span-4">
            <h3 className="type-eyebrow text-muted">Across the {car.name} range</h3>
            <ul className="mt-5 space-y-3">
              {highlights.map((h) => (
                <li key={h} className="flex gap-3 text-[14px]">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-ink/50" />
                  {h}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[12.5px] text-muted">Range highlights may depend on variant. Confirm equipment with your dealer.</p>
          </div>
          )}
        </div>
      </DetailSection>
      )}

      {diff && (
        <DetailSection
          id="step-up"
          index={idx("step-up")}
          eyebrow={diff.mode === "next" ? "Step up" : "Flagship"}
          tone="mist"
          title={
            diff.mode === "next" ? (
              <>
                For {formatPriceShort(diff.delta)} more, <span className="type-editorial font-normal">the {diff.to.name}.</span>
              </>
            ) : (
              <>
                The top of the range — <span className="type-editorial font-normal">{formatPriceShort(diff.delta)}</span> over the {diff.from.name}.
              </>
            )
          }
          description={diff.mode === "next" ? "What you get extra by moving one trim up the ladder." : "What the flagship adds over the trim below it."}
        >
          <div className="grid grid-cols-1 gap-px bg-line md:grid-cols-[1fr_auto_1fr]">
            {[diff.from, diff.to].map((v, i) => {
              const current = v.slug === variant.slug;
              const inner = (
                <>
                  <p className="type-eyebrow text-muted">{current ? "This variant" : diff.mode === "next" ? "Next trim up" : "Previous trim"}</p>
                  <p className="type-h3 mt-4">{v.name}</p>
                  <p className="mt-1 text-[13px] text-muted">{variantLine(v)}</p>
                  <p className="mt-6 text-[22px] font-semibold num">{formatPrice(v.price)}</p>
                  {!current && (
                    <span className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium">
                      View {v.name} <ArrowRight aria-hidden className="size-3.5 text-red transition-transform duration-[250ms] group-hover:translate-x-0.5" />
                    </span>
                  )}
                </>
              );
              return (
                <div key={v.slug} className={cn("flex", i === 1 && "md:order-3")}>
                  {current ? (
                    <div className="w-full bg-white p-6 md:p-8">{inner}</div>
                  ) : (
                    <Link href={`/cars/${car.slug}/${v.slug}`} className="group w-full bg-white p-6 transition-colors duration-[400ms] hover:bg-white/70 md:p-8">
                      {inner}
                    </Link>
                  )}
                </div>
              );
            })}
            <div className="flex flex-col justify-center bg-ink p-6 text-white md:order-2 md:w-[300px] md:p-8 lg:w-[360px]">
              <p className="type-eyebrow text-white/55">{diff.mode === "next" ? "You get extra" : "The flagship adds"}</p>
              <p className="mt-4 font-display text-[clamp(1.75rem,1.4rem+1.2vw,2.5rem)] font-semibold leading-none tracking-[-0.03em] num">
                +{formatPriceShort(diff.delta)}
              </p>
              <ul className="mt-6 space-y-3 text-[14px]">
                {[...diff.adds, ...diff.changes].map((item) => (
                  <li key={item} className="flex gap-3">
                    <Plus aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
                    {item}
                  </li>
                ))}
                {diff.adds.length + diff.changes.length === 0 && <li className="text-white/60">Equipment is broadly the same; check with your dealer.</li>}
              </ul>
            </div>
          </div>
        </DetailSection>
      )}

      <DetailSection
        id="specifications"
        index={idx("specifications")}
        eyebrow="Specifications"
        divider={!diff}
        title="Full specification."
        description={`Variant-specific figures first; the remaining data is shared across the ${car.name} range and shows the full span where it varies.`}
      >
        <div className="mb-14 grid grid-cols-1 gap-x-12 border-t-2 border-ink pt-2 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["Variant", variant.name],
              ["Fuel", variant.fuel],
              ["Transmission", variant.transmission],
              [ev ? "Claimed range" : "Claimed efficiency", variant.efficiency || "—"],
            ] as [string, string][]
          ).map(([label, value]) => (
            <dl key={label}>
              <SpecRow label={label} value={value} />
            </dl>
          ))}
        </div>
        <SpecTables car={car} />
      </DetailSection>

      <DetailSection id="other-variants" index={idx("other-variants")} eyebrow="Other variants" title={`Every ${car.name}, in order of price.`}>
        <nav aria-label={`${car.name} variants`}>
          <ol className="border-t border-line">
            {variants.map((v, i) => {
              const current = v.slug === variant.slug;
              return (
                <li key={v.slug} className="border-b border-line">
                  <Link
                    href={`/cars/${car.slug}/${v.slug}`}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "group grid grid-cols-[32px_1fr_auto] items-center gap-4 py-5 transition-colors duration-[250ms] md:grid-cols-[48px_1.4fr_1fr_160px_40px] md:gap-6",
                      current ? "bg-mist max-md:-mx-5 max-md:px-5 md:px-4" : "hover:bg-mist/60 md:px-4",
                    )}
                  >
                    <span className={cn("text-[12px] font-medium num", current ? "text-red-600" : "text-muted")}>{pad2(i + 1)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium">{v.name}</span>
                      <span className="block truncate text-[12.5px] text-muted md:hidden">{variantLine(v)}</span>
                      {current && <span className="mt-1 block text-[11.5px] font-medium text-red-600">You are viewing this variant</span>}
                    </span>
                    <span className="hidden text-[13px] text-muted md:block">{variantLine(v)}</span>
                    <span className="text-right text-[14px] font-semibold num">{formatPriceShort(v.price)}</span>
                    <ArrowRight
                      aria-hidden
                      className={cn("hidden size-4 justify-self-end transition-transform duration-[250ms] group-hover:translate-x-0.5 md:block", current ? "text-ink/20" : "text-red")}
                    />
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="mt-8">
          <TextLink href={`/compare?cars=${[car.slug, ...competitorsOf(car, cat, 2).map((c) => c.slug)].join(",")}`}>Compare the {car.name} with rivals</TextLink>
        </div>
      </DetailSection>

      {/* Closing CTA band */}
      <section aria-labelledby="variant-cta" className="bg-ink text-white">
        <div className="container-x grid grid-cols-1 gap-10 py-12 md:py-16 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <Eyebrow tone="light">Next step</Eyebrow>
            <h2 id="variant-cta" className="type-h2 mt-5 text-balance">
              See the {variant.name} <span className="type-editorial font-normal">in person.</span>
            </h2>
            <p className="mt-5 max-w-lg text-[15px] text-white/60">
              Book a test drive at a dealer near you, or let verified dealers compete for your business with their best on-road quote.
            </p>
          </div>
          <div className="flex flex-col gap-6 lg:col-span-5 lg:items-end">
            <EnquiryButtons title={title} detail={variant.name} carSlug={car.slug} />
            <TextLink href={`/cars/${car.slug}`} tone="light">
              Back to the {car.name} overview
            </TextLink>
          </div>
        </div>
      </section>

      <BottomActionBar exShowroom={variant.price} ev={ev} subject={title} detail={variant.name} carSlug={car.slug} />
    </div>
  );
}
