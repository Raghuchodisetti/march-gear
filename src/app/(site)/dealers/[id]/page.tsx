import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowUpRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Stars } from "@/components/ui/rating";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { EmptyState } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { CarCard } from "@/components/vehicle/car-card";
import { UsedCarCard } from "@/components/vehicle/used-car-card";
import { EnquiryButton } from "@/components/used/enquiry-button";
import { dealerBrandLabel } from "@/components/dealer/dealer-utils";
import { TabbedPanels, type Panel } from "@/components/dealer/tabbed-panels";
import { DealerReviews, FacilityGrid, NearbyDealers } from "@/components/dealer/dealer-sections";
import { VALUATION_YEAR } from "@/components/valuation/valuation";

export async function generateStaticParams() {
  const { dealers } = await getCatalog();
  return dealers.map((d) => ({ id: d.id }));
}

export async function generateMetadata(props: PageProps<"/dealers/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const { getDealer, brandName } = await getCatalog();
  const dealer = getDealer(id);
  if (!dealer) return { title: "Dealer not found" };
  return {
    title: `${dealer.name}, ${dealer.area} — ${dealer.brand === "multi-brand" ? "pre-owned cars" : `${brandName(dealer.brand)} dealer`} in ${dealer.city}`,
    description: `${dealer.address}. Rated ${dealer.rating.toFixed(1)} from ${dealer.reviewCount.toLocaleString("en-IN")} reviews. ${dealer.hours}.`,
  };
}

export default async function DealerPage(props: PageProps<"/dealers/[id]">) {
  const { id } = await props.params;
  const { getDealer, dealerProfile, usedCars, carsByBrand, reviewsForDealer, nearbyDealers, getBrand, brandName } = await getCatalog();
  const dealer = getDealer(id);
  if (!dealer) notFound();

  const profile = dealerProfile(dealer.id);
  const used = usedCars.filter((c) => c.seller.dealerId === dealer.id);
  const multiBrand = dealer.brand === "multi-brand";
  const models = multiBrand ? [] : carsByBrand(dealer.brand);
  const reviews = reviewsForDealer(dealer.id);
  const nearby = nearbyDealers(dealer, 3);
  const years = VALUATION_YEAR - dealer.established;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${dealer.name}, ${dealer.address}`)}`;
  const tel = dealer.phone.replace(/\s/g, "");
  const brandPage = getBrand(dealer.brand) ? `/brands/${dealer.brand}` : "/brands";

  const panels: Panel[] = [];
  if (used.length > 0) {
    panels.push({
      value: "used",
      label: "Used cars",
      count: used.length,
      content: (
        <div>
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {used.map((c) => (
              <li key={c.id}>
                <UsedCarCard car={c} sizes="(min-width: 1280px) 24vw, (min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw" />
              </li>
            ))}
          </ul>
          <TextLink href={`/used-cars?city=${encodeURIComponent(dealer.city)}`} className="mt-8">
            All used cars in {dealer.city}
          </TextLink>
        </div>
      ),
    });
  }
  if (models.length > 0) {
    panels.push({
      value: "new",
      label: "New models",
      count: models.length,
      content: (
        <div>
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {models.slice(0, 8).map((m) => (
              <li key={m.slug}>
                <CarCard car={m} sizes="(min-width: 1280px) 24vw, (min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw" />
              </li>
            ))}
          </ul>
          <TextLink href={brandPage} className="mt-8">
            Explore the {brandName(dealer.brand)} range
          </TextLink>
        </div>
      ),
    });
  }

  const contact = [
    {
      icon: MapPin,
      label: "Address",
      body: dealer.address,
      link: { href: mapsUrl, text: "Get directions", external: true },
    },
    { icon: Clock, label: "Opening hours", body: dealer.hours },
    { icon: Phone, label: "Sales & service", body: dealer.phone, link: { href: `tel:${tel}`, text: "Call now" } },
    { icon: Mail, label: "Email", body: dealer.email, link: { href: `mailto:${dealer.email}`, text: "Write to us" } },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <Image src={dealer.image} alt="" fill preload sizes="100vw" className="-z-10 animate-kenburns object-cover opacity-55" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/45 to-ink/15" />
        <div className="container-x pb-12 pt-8 md:pb-16 md:pt-10">
          <Breadcrumbs
            tone="light"
            items={[
              { label: "Dealers", href: "/dealers" },
              { label: dealer.city, href: `/dealers?city=${encodeURIComponent(dealer.city)}` },
              { label: dealer.name },
            ]}
          />
          <div className="mt-24 flex flex-col gap-10 md:mt-40 lg:flex-row lg:items-end lg:justify-between">
            <Reveal className="min-w-0 max-w-4xl">
              <Eyebrow tone="light">{dealerBrandLabel(dealer, brandName)}</Eyebrow>
              <h1 className="type-h1 mt-5 text-balance">{dealer.name}</h1>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px] text-white/70">
                <span className="inline-flex items-center gap-2">
                  <Stars value={dealer.rating} tone="light" />
                  <span className="font-semibold text-white num">{dealer.rating.toFixed(1)}</span>
                  <span className="num">({dealer.reviewCount.toLocaleString("en-IN")} reviews)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden /> {dealer.area}, {dealer.city}
                </span>
                <span className="num">Since {dealer.established}</span>
              </div>
            </Reveal>
            <div className="grid shrink-0 grid-cols-1 gap-3 sm:flex sm:flex-wrap">
              <EnquiryButton kind="callback" subject={`Service visit · ${dealer.name}`} detail={`${dealer.area}, ${dealer.city}`} dealerId={dealer.id} size="lg">
                Book a service visit
              </EnquiryButton>
              <EnquiryButton kind="contact-dealer" subject={dealer.name} detail={`${dealer.area}, ${dealer.city}`} dealerId={dealer.id} variant="outline-light" size="lg">
                Contact dealer
              </EnquiryButton>
            </div>
          </div>
        </div>
      </section>

      {/* Contact bar */}
      <section aria-label="Contact details" className="border-b border-line">
        <div className="container-x py-8 md:py-10">
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {contact.map(({ icon: Icon, label, body, link }) => (
              <div key={label} className="flex min-w-0 gap-3 lg:border-l lg:border-line lg:px-6 lg:first:border-l-0 lg:first:pl-0">
                <Icon className="mt-0.5 size-[18px] shrink-0 text-ink/60" aria-hidden />
                <div className="min-w-0">
                  <dt className="text-[12px] text-muted">{label}</dt>
                  <dd className="mt-1 break-words text-[14px] leading-snug text-ink">{body}</dd>
                  {link && (
                    <dd className="mt-2">
                      <a
                        href={link.href}
                        {...("external" in link && link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="group/cl inline-flex items-center gap-1 text-[13px] font-medium text-ink underline-offset-4 hover:underline"
                      >
                        {link.text}
                        <ArrowUpRight aria-hidden className="size-3.5 text-red transition-transform duration-[250ms] group-hover/cl:-translate-y-0.5 group-hover/cl:translate-x-0.5" />
                        {"external" in link && link.external && <span className="sr-only">(opens Google Maps in a new tab)</span>}
                      </a>
                    </dd>
                  )}
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Showroom */}
      <section aria-labelledby="showroom-title" className="py-14 md:py-20">
        <div className="container-x grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal>
              <Eyebrow>The showroom</Eyebrow>
              <h2 id="showroom-title" className="type-h2 mt-5 text-balance">
                {years} years in {dealer.city}.
              </h2>
              <p className="type-lead mt-6 text-muted">{profile.about}</p>
            </Reveal>
            <dl className="mt-10 grid grid-cols-3 border-t border-ink pt-6">
              {[
                { label: "Established", value: String(dealer.established) },
                { label: "Showroom", value: profile.showroomArea },
                { label: "Service bays", value: profile.serviceBays ? String(profile.serviceBays) : "—" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col-reverse justify-end border-l border-line pl-4 first:border-l-0 first:pl-0">
                  <dt className="mt-1 text-[12px] text-muted">{s.label}</dt>
                  <dd className="text-[1.125rem] font-semibold tracking-[-0.01em] num md:text-[1.375rem]">{s.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-[13px] text-muted">
              <span className="text-ink">Languages spoken:</span> {profile.languages.join(", ")}
            </p>
          </div>

          <div className="space-y-14 lg:col-span-7">
            <div>
              <h3 className="type-eyebrow text-ink">Services</h3>
              <ol className="mt-5 border-t border-line">
                {dealer.services.map((s, i) => (
                  <li key={s} className="flex items-baseline gap-6 border-b border-line py-4">
                    <span className="font-mono text-[12px] text-red num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="type-h4">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="type-eyebrow text-ink">Facilities</h3>
              <div className="mt-5">
                <FacilityGrid items={profile.facilities} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Inventory */}
      <section aria-labelledby="inventory-title" className="border-t border-line py-14 md:py-20">
        <div className="container-x">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Eyebrow>In the showroom</Eyebrow>
              <h2 id="inventory-title" className="type-h2 mt-5">
                Current inventory
              </h2>
            </div>
            <p className="max-w-sm text-[14px] text-muted sm:text-right">Availability changes daily. Contact the showroom to reserve a car.</p>
          </div>
          <div className="mt-10">
            {panels.length > 0 ? (
              <TabbedPanels ariaLabel="Inventory" panels={panels} />
            ) : (
              <EmptyState
                title="No cars listed right now"
                description="This showroom refreshes its stock often. Browse verified cars nearby in the meantime."
                action={
                  <Button href={`/used-cars?city=${encodeURIComponent(dealer.city)}`} arrow>
                    Used cars in {dealer.city}
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </section>

      <DealerReviews dealer={dealer} reviews={reviews} />

      <NearbyDealers items={nearby} city={dealer.city} />
    </>
  );
}
