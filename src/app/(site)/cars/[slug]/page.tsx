import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalog } from "@/server/catalog";
import { carFaqs } from "@/data/car-faqs";
import { videosForCar } from "@/data/car-videos";
import { formatPrice } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Carousel } from "@/components/ui/carousel";
import { CarCard } from "@/components/vehicle/car-card";
import { CarDetailProvider } from "@/components/car-detail/context";
import { CarHero } from "@/components/car-detail/hero";
import { SectionNav, type NavSection } from "@/components/car-detail/section-nav";
import { ModelBottomBar } from "@/components/car-detail/bottom-bar";
import { DetailSection } from "@/components/car-detail/section";
import { CarOverview } from "@/components/car-detail/overview";
import { VariantsTable } from "@/components/car-detail/variants";
import { SpecComparison, SpecTables } from "@/components/car-detail/specs";
import { FeatureTabs } from "@/components/car-detail/features";
import { CarSafety } from "@/components/car-detail/safety";
import { CarMileage, CarRange } from "@/components/car-detail/efficiency";
import { CarPerformance } from "@/components/car-detail/performance";
import { CarDesign } from "@/components/car-detail/design";
import { GalleryGrid } from "@/components/car-detail/gallery";
import { CarVideos } from "@/components/car-detail/videos";
import { ExpertReview } from "@/components/car-detail/expert-review";
import { OwnerReviews } from "@/components/car-detail/owner-reviews";
import { CompareRivals } from "@/components/car-detail/compare";
import { CarEmi } from "@/components/car-detail/emi";
import { BOTTOM_BAR_PADDING, competitorsOf, hasDesignContent, hasEfficiency, isEv, similarCars } from "@/components/car-detail/utils";
import { accelText, isFactsOnly, known, topFigure } from "@/lib/specs";
import { DealerStock } from "@/components/car-detail/dealer-stock";
import { getModelStock } from "@/server/partner/inventory";
import { creditsFor } from "@/server/photo-credits";
import { CarOffersPanel } from "@/components/offers/page-sections";
import { fitDescription, fitTitle, pageMetadata } from "@/components/seo/metadata";

export async function generateStaticParams() {
  const { cars } = await getCatalog();
  return cars.map((car) => ({ slug: car.slug }));
}

export async function generateMetadata(props: PageProps<"/cars/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const { getCar, brandName } = await getCatalog();
  const car = getCar(slug);
  if (!car) return { title: "Car not found" };
  const brand = brandName(car.brand);
  const name = `${brand} ${car.name}`;
  // Facts-only models have no review yet, so the title and description don't promise one.
  const factsOnly = isFactsOnly(car);
  return pageMetadata({
    title: fitTitle([factsOnly ? `${name} Price, Specs & Variants` : `${name} Price, Specs & Review`, `${name} Price & Specs`, `${name} Price in India`, name]),
    description: fitDescription(
      `${name} price in India starts at ${formatPrice(car.priceMin)} (${car.priceCity ? `ex-showroom ${car.priceCity}` : "indicative ex-showroom"}).`,
      `Compare ${car.variants.length} ${car.variants.length === 1 ? "variant" : "variants"}, specs, ${isEv(car) ? "range" : "mileage"}, safety${factsOnly ? " and features" : " and reviews"}.`,
      car.tagline,
    ),
    path: `/cars/${car.slug}`,
    images: "segment",
  });
}

export default async function CarPage(props: PageProps<"/cars/[slug]">) {
  const { slug } = await props.params;
  const cat = await getCatalog();
  const car = cat.getCar(slug);
  if (!car) notFound();

  const brand = cat.brandName(car.brand);
  const ev = isEv(car);
  const review = cat.getExpertReview(car.slug);
  const author = review ? cat.getAuthor(review.authorId) : undefined;
  const owners = cat.ownerReviewsFor(car.slug);
  const similar = similarCars(car, cat);
  const rivals = competitorsOf(car, cat, 3);
  const videos = videosForCar(car, cat);
  const faqs = carFaqs(car, cat);
  const tested = car.safetyAgency !== "Not tested";
  // Partner dealers' published stock of this model (dealer portal), and the licence credits of its photos.
  const [stock, credits] = await Promise.all([getModelStock(car.slug), creditsFor(car.images)]);

  // Sections appear only when there's something to show: facts-only models may have no photos, published
  // mileage or performance figures yet, and no expert review.
  const show = {
    features: car.features.some((g) => g.items.length > 0),
    efficiency: ev ? Boolean(car.ev) : hasEfficiency(car),
    design: hasDesignContent(car),
    gallery: car.images.length > 0,
    videos: videos.length > 0,
  };
  const power = topFigure(car.power);
  const torque = topFigure(car.torque, ["Nm", "kgm"]);
  const accel = accelText(car.acceleration);
  const adas = car.features.some((g) => g.items.some((i) => /ADAS/i.test(i)));
  const safetyKit = [
    car.features.some((g) => g.items.some((i) => /stability|\bESC\b|\bESP\b|\bVSM\b|\bVDC\b/i.test(i))) && "electronic stability control",
    car.features.some((g) => g.items.some((i) => /ISOFIX/i.test(i))) && "ISOFIX mounts",
  ].filter((x): x is string => Boolean(x));
  const safetyDescription = [
    known(car.airbags) ? `Up to ${car.airbags} airbags` : "",
    safetyKit.length ? (known(car.airbags) ? `, ${safetyKit.join(" and ")}` : `${safetyKit.join(" and ")[0].toUpperCase()}${safetyKit.join(" and ").slice(1)}`) : "",
    adas ? `${known(car.airbags) || safetyKit.length ? ", with " : "Available with "}${isFactsOnly(car) ? "ADAS driver assistance" : "Level 2 ADAS on higher variants"}` : "",
  ].join("");

  const sections: NavSection[] = [
    { id: "overview", label: "Overview" },
    { id: "variants", label: "Variants & prices" },
    { id: "specifications", label: "Specifications" },
    ...(show.features ? [{ id: "features", label: "Features" }] : []),
    { id: "safety", label: "Safety" },
    ...(show.efficiency ? [ev ? { id: "range", label: "Range" } : { id: "mileage", label: "Mileage" }] : []),
    { id: "performance", label: "Engine & performance" },
    ...(show.design ? [{ id: "design", label: "Interior & exterior" }] : []),
    ...(show.gallery ? [{ id: "gallery", label: "Gallery" }] : []),
    ...(show.videos ? [{ id: "videos", label: "Videos" }] : []),
    { id: "reviews", label: "Reviews" },
    { id: "similar", label: "Similar cars" },
    ...(rivals.length ? [{ id: "compare", label: "Compare" }] : []),
    { id: "emi", label: "EMI" },
    { id: "faqs", label: "FAQs" },
  ];
  const n = (id: string) => String(sections.findIndex((s) => s.id === id) + 1).padStart(2, "0");

  return (
    <CarDetailProvider car={car} brand={brand} credits={credits}>
      <div className={BOTTOM_BAR_PADDING}>
        <div className="container-x pt-6 md:pt-8">
          <Breadcrumbs
            items={[
              { label: "New Cars", href: "/new-cars" },
              { label: brand, href: `/brands/${car.brand}` },
              { label: car.name },
            ]}
          />
        </div>

        <CarHero expertScore={review?.score ?? car.expertScore} />
        <SectionNav sections={sections} />

        <CarOverview car={car} index={n("overview")} brand={brand} />
        <CarOffersPanel car={car} carName={car.name} />

        <DetailSection
          id="variants"
          index={n("variants")}
          eyebrow="Variants & prices"
          title={`${car.variants.length} variants, from ${formatPrice(car.priceMin)}.`}
          description="Ex-showroom and indicative on-road prices for your city. Open any variant for its full price breakdown and specification."
        >
          <VariantsTable />
        </DetailSection>

        <DealerStock items={stock.items} dealers={stock.dealers} carName={`${brand} ${car.name}`} carSlug={car.slug} />

        <DetailSection
          id="specifications"
          index={n("specifications")}
          eyebrow="Specifications"
          title="The numbers that matter."
          description={`Technical data for the ${car.name} range. Where figures vary by variant, the full span is shown.`}
        >
          <SpecTables car={car} />
          <SpecComparison car={car} />
        </DetailSection>

        {show.features && (
        <DetailSection
          id="features"
          index={n("features")}
          eyebrow="Features"
          tone="mist"
          title={
            <>
              Equipment, <span className="type-editorial font-normal">group by group.</span>
            </>
          }
          description={`${car.features.reduce((sum, g) => sum + g.items.length, 0)} listed features across ${car.features.length} categories.`}
        >
          <FeatureTabs />
        </DetailSection>
        )}

        <DetailSection
          id="safety"
          index={n("safety")}
          eyebrow="Safety"
          divider={false}
          title={tested ? `${car.safetyRating}-star ${car.safetyAgency} rating.` : "Safety, by specification."}
          description={safetyDescription ? `${safetyDescription}.` : undefined}
        >
          <CarSafety car={car} />
        </DetailSection>

        {!show.efficiency ? null : ev ? (
          <DetailSection
            id="range"
            index={n("range")}
            eyebrow="Range & charging"
            title={`Up to ${car.ev?.rangeKm ?? car.efficiencyValue} km on a charge.`}
            description="Claimed range alongside a real-world estimate for mixed Indian driving, with battery and charging times."
          >
            <CarRange car={car} />
          </DetailSection>
        ) : (
          <DetailSection
            id="mileage"
            index={n("mileage")}
            eyebrow="Mileage"
            title={`${car.efficiency}, claimed.`}
            description="Claimed fuel efficiency by variant, with indicative real-world figures and running costs."
          >
            <CarMileage car={car} />
          </DetailSection>
        )}

        <DetailSection
          id="performance"
          index={n("performance")}
          eyebrow="Engine & performance"
          tone="dark"
          divider={false}
          size="large"
          title={power && torque ? `Up to ${power.text} and ${torque.text}.` : power ? `Up to ${power.text}.` : torque ? `Up to ${torque.text}.` : `${car.engine}.`}
          description={[
            `${car.engine} · ${car.transmissions.join(", ")}.`,
            accel && known(car.topSpeed) ? `0–100 km/h in ${accel} and a top speed of ${car.topSpeed} km/h.` : accel ? `0–100 km/h in ${accel}.` : known(car.topSpeed) ? `Top speed ${car.topSpeed} km/h.` : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <CarPerformance car={car} />
        </DetailSection>

        {show.design && (
        <DetailSection
          id="design"
          index={n("design")}
          eyebrow="Interior & exterior"
          divider={false}
          size="large"
          title={
            <>
              Designed <span className="type-editorial font-normal">inside and out.</span>
            </>
          }
        >
          <CarDesign />
        </DetailSection>
        )}

        {show.gallery && (
        <DetailSection id="gallery" index={n("gallery")} eyebrow="Gallery" title="In pictures." description="Select any photograph to view it full screen.">
          <GalleryGrid />
        </DetailSection>
        )}

        {show.videos && (
        <DetailSection
          id="videos"
          index={n("videos")}
          eyebrow="Videos"
          tone="dark"
          divider={false}
          title={`Watch the ${car.name}.`}
          description="Walkarounds, drive films and ownership explainers from the March Gear studio."
        >
          <CarVideos videos={videos} />
        </DetailSection>
        )}

        <DetailSection
          id="reviews"
          index={n("reviews")}
          eyebrow="Reviews"
          divider={false}
          title={review && author ? "What experts and owners say." : "What owners say."}
          description={
            review && author
              ? "An independent road test verdict, followed by ratings and reviews from people who live with the car."
              : `Ratings and reviews from people who own the ${car.name}, checked by MarchGear before they're published. We haven't road-tested it yet.`
          }
        >
          {review && author && <ExpertReview car={car} review={review} author={author} />}
          <OwnerReviews initial={owners} standalone={!(review && author)} />
        </DetailSection>

        <DetailSection
          id="similar"
          index={n("similar")}
          eyebrow="Similar cars"
          tone="mist"
          title="Also worth considering."
          description={`Direct rivals first, then other ${car.bodyType === "MUV" ? "MUVs" : `${car.bodyType.toLowerCase()}s`} close in price.`}
        >
          <Carousel label="similar cars" itemClassName="w-[82%] sm:w-[46%] lg:w-[31%] xl:w-[23.6%]" controls="bottom">
            {similar.map((c) => (
              <CarCard key={c.slug} car={c} sizes="(min-width: 1280px) 24vw, (min-width: 1024px) 31vw, (min-width: 640px) 46vw, 82vw" />
            ))}
          </Carousel>
        </DetailSection>

        {rivals.length > 0 && (
          <DetailSection
            id="compare"
            index={n("compare")}
            eyebrow="Compare"
            divider={false}
            title={`${car.name} against its rivals.`}
            description="Key figures side by side. Open the full comparison for every specification and feature."
          >
            <CompareRivals car={car} />
          </DetailSection>
        )}

        <DetailSection
          id="emi"
          index={n("emi")}
          eyebrow="EMI"
          title="Plan your finance."
          description="Adjust the down payment, rate and tenure. The price follows the variant and city selected above."
        >
          <CarEmi />
        </DetailSection>

        <DetailSection id="faqs" index={n("faqs")} eyebrow="FAQs" title="Frequently asked questions.">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="max-w-xs text-[15px] leading-relaxed text-muted">
                Answers generated from our specification data for the {brand} {car.name}. Need something else?
              </p>
              <Button href="/contact" variant="outline" className="mt-6" arrow>
                Ask our experts
              </Button>
            </div>
            <div className="min-w-0 lg:col-span-8">
              <Accordion items={faqs.map((f) => ({ id: f.id, title: f.question, content: f.answer }))} defaultOpen={[faqs[0]?.id]} />
            </div>
          </div>
        </DetailSection>
      </div>
      <ModelBottomBar />
    </CarDetailProvider>
  );
}
