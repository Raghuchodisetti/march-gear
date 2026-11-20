import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { formatDate, formatINR, formatKm, formatPrice } from "@/lib/format";
import { Badge, DemoNote, VerifiedBadge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Carousel } from "@/components/ui/carousel";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { ImageGallery } from "@/components/vehicle/image-gallery";
import { UsedCarCard } from "@/components/vehicle/used-car-card";
import { usedEmi, usedTitle } from "@/components/vehicle/card-utils";
import { UsedPurchaseActions, UsedShareSave } from "@/components/used/detail-actions";
import { SellerCard } from "@/components/used/seller-card";
import { fairPriceBand } from "@/components/used/inspection";
import {
  AssuranceList,
  EmiLink,
  Highlights,
  InspectionReportPanel,
  KeyFacts,
  PriceAnalysis,
} from "@/components/used/detail-sections";
import { TrackView } from "@/components/portal/track";
import { getUsedMirrorRef } from "@/server/partner/inventory";

export async function generateStaticParams() {
  const { usedCars } = await getCatalog();
  return usedCars.map((car) => ({ id: car.id }));
}

export async function generateMetadata(props: PageProps<"/used-cars/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const { getUsedCar, brandName } = await getCatalog();
  const car = getUsedCar(id);
  if (!car) return { title: "Used car not found" };
  return {
    title: `${usedTitle(car, brandName)} ${car.variant} in ${car.city}`,
    description: `${formatKm(car.km)}, ${car.fuel}, ${car.transmission}, ${car.owners === 1 ? "first owner" : `${car.owners} owners`}. Asking ${formatPrice(car.price)} (indicative) with inspection report and fair-price analysis.`,
  };
}

export default async function UsedCarPage(props: PageProps<"/used-cars/[id]">) {
  const { id } = await props.params;
  const { getUsedCar, usedCars, brandName } = await getCatalog();
  const car = getUsedCar(id);
  if (!car) notFound();

  const title = usedTitle(car, brandName);
  const band = fairPriceBand(car);
  const ownerLabel = car.owners === 1 ? "1st owner" : `${car.owners} owners`;
  // A dealer-portal listing (mirrored as pv-<id>) counts its views for the dealer's analytics.
  const partnerRef = car.id.startsWith("pv-") ? await getUsedMirrorRef(car.id) : null;

  const similar = usedCars
    .filter((c) => c.id !== car.id)
    .map((c) => ({ c, score: (c.bodyType === car.bodyType ? 0 : 0.6) + Math.abs(Math.log(c.price / car.price)) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 8)
    .map((x) => x.c);

  return (
    <div className="pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0">
      {partnerRef && <TrackView partnerId={partnerRef.partnerId} kind="vehicle_view" refId={partnerRef.vehicleId} />}
      <section className="container-x pt-8 md:pt-10">
        <Breadcrumbs
          items={[
            { label: "Used Cars", href: "/used-cars" },
            { label: car.city, href: `/used-cars?city=${encodeURIComponent(car.city)}` },
            { label: title },
          ]}
        />
        <header className="mt-8 flex flex-col gap-6 md:mt-12 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 max-w-4xl">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
              {car.verified ? <VerifiedBadge tone="outline" /> : <Badge tone="mist">Seller listed</Badge>}
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden /> {car.city}
              </span>
              <span>Listed {formatDate(car.postedOn)}</span>
            </div>
            <h1 className="type-h1 mt-5 text-balance">{title}</h1>
            <p className="type-lead mt-3 text-muted">
              {car.variant}
              <span className="mx-2 text-line" aria-hidden>
                /
              </span>
              <span className="num">
                {formatKm(car.km)} · {car.fuel} · {car.transmission} · {ownerLabel}
              </span>
            </p>
          </div>
          <UsedShareSave id={car.id} title={title} />
        </header>
      </section>

      <section className="container-x mt-8 md:mt-12">
        <div className="grid grid-cols-1 gap-y-12 lg:grid-cols-12 lg:gap-x-12 xl:gap-x-16">
          <div className="min-w-0 lg:col-span-8">
            <ImageGallery images={car.images} alt={title} focus={car.focus} priority aspect="aspect-[4/3] md:aspect-[16/10]" />
          </div>

          <aside aria-label="Price and actions" className="min-w-0 lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1">
            <div className="lg:sticky lg:top-[96px]">
              <div className="border border-ink p-6 md:p-7">
                <p className="type-eyebrow text-muted">Asking price</p>
                <p className="mt-4 text-[2.5rem] font-semibold leading-none tracking-[-0.03em]">{formatPrice(car.price)}</p>
                <DemoNote className="mt-2 block">Indicative · excludes RC transfer & insurance</DemoNote>
                <div className="mt-6 flex items-center justify-between gap-4 border-y border-line py-4">
                  <div>
                    <p className="text-[12px] text-muted">EMI from</p>
                    <p className="mt-0.5 text-[15px] font-medium num">{formatINR(usedEmi(car.price))}/mo</p>
                    <p className="text-[11px] text-muted">20% down · 9.5% · 5 years</p>
                  </div>
                  <EmiLink />
                </div>
                <UsedPurchaseActions
                  car={{ id: car.id, price: car.price, city: car.city, variant: car.variant, seller: car.seller }}
                  title={title}
                  fairLow={band.low}
                  fairHigh={band.high}
                />
                <AssuranceList verified={car.verified} className="mt-6 border-t border-line pt-6" />
              </div>
              <SellerCard car={car} className="mt-5" />
            </div>
          </aside>

          <div className="min-w-0 space-y-16 md:space-y-20 lg:col-span-8">
            <KeyFacts car={car} />
            <Highlights items={car.highlights} />
            <InspectionReportPanel car={car} title={title} />
            <PriceAnalysis car={car} />
          </div>
        </div>
      </section>

      {similar.length > 0 && (
        <section aria-labelledby="similar-title" className="mt-20 border-t border-line py-20 md:mt-28 md:py-28">
          <div className="container-x">
            <Carousel
              label="similar used cars"
              itemClassName="w-[82%] sm:w-[46%] lg:w-[31%] xl:w-[23.5%]"
              headerSlot={
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:pr-8">
                  <div>
                    <Eyebrow>Keep looking</Eyebrow>
                    <h2 id="similar-title" className="type-h2 mt-5">
                      Similar used cars
                    </h2>
                  </div>
                  <TextLink href={`/used-cars?body=${encodeURIComponent(car.bodyType)}`}>All used {car.bodyType === "SUV" || car.bodyType === "MUV" ? `${car.bodyType}s` : `${car.bodyType.toLowerCase()}s`}</TextLink>
                </div>
              }
            >
              {similar.map((c) => (
                <UsedCarCard key={c.id} car={c} sizes="(min-width: 1280px) 24vw, (min-width: 1024px) 31vw, (min-width: 640px) 46vw, 82vw" />
              ))}
            </Carousel>
          </div>
        </section>
      )}
    </div>
  );
}
