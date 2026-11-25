import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight, BatteryCharging, Flame, PlugZap, Truck, Wrench, Zap } from "lucide-react";
import { STANDARD_COVER_BY_KEY } from "@/insurance/covers";
import { IMG } from "@/data/images";
import { getCatalog } from "@/server/catalog";
import { getAddOnOffers } from "@/server/insurance/public-content";
import { Button } from "@/components/ui/button";
import { CategoryAd, CtaBand, LandingHero, QuoteSection, RelatedGuides, Section, pickGuides } from "@/components/insurance/public/landing";
import { EvSlabFinder } from "@/components/insurance/public/ev-slab-finder";
import { INSURANCE_OG_IMAGE, pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Electric Car Insurance: Battery & Charger Cover",
  description: "Insuring an electric car in India: third-party premiums by motor kW, battery and charger cover, water-ingress and short-circuit risks, and EV-ready garages.",
  path: "/insurance/ev",
  images: [INSURANCE_OG_IMAGE],
});

const DIFFERENCES = [
  { Icon: Zap, title: "Third party by motor power", text: "No engine capacity, so third-party premiums are set in slabs by the motor's kilowatts — and have generally been set lower than for comparable petrol cars." },
  { Icon: BatteryCharging, title: "The battery holds the value", text: "The traction battery is often the single most expensive part. Accidental damage is covered; water ingress and short circuits may need an add-on." },
  { Icon: PlugZap, title: "Charging equipment", text: "The portable cable usually counts as part of the car. A wall-mounted charger at home may not be covered — ask before assuming." },
  { Icon: Wrench, title: "Specialist repairs", text: "Battery modules and power electronics need trained technicians. Check for cashless garages near you that actually work on EVs." },
  { Icon: Truck, title: "Flatbed towing", text: "Many EVs shouldn't be towed on their wheels. Choose roadside assistance that specifies a flatbed — and help if you run out of charge." },
  { Icon: Flame, title: "Fire", text: "Fire, including self-ignition, is part of own-damage cover — as for any car. EV fires are rare but often end in a total loss." },
];

const EV_ADDON_FIT = [
  { title: "Worth considering", items: ["EV battery protection", "Zero depreciation", "Return to invoice (new EVs)", "Roadside assistance with flatbed towing", "Consumables cover"] },
  { title: "Usually irrelevant for an EV", items: ["Engine protection", "Cover for a fitted CNG or LPG kit"] },
];

export default async function EvInsurancePage() {
  await connection();
  const [{ content }, offers] = await Promise.all([getCatalog(), getAddOnOffers()]);
  const page = content.insurancePage.pages.ev;
  const battery = STANDARD_COVER_BY_KEY.ev_battery;
  const batteryCount = offers.byKey.ev_battery ?? 0;
  const guides = pickGuides(content.insuranceGuides.guides, ["ev-insurance", "zero-depreciation-explained", "how-to-make-a-car-insurance-claim"]);

  return (
    <>
      <LandingHero hero={page} image={IMG.chargeStation} imageFocus="50% 55%" crumb="EV">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button href="#quote" size="lg" arrow>
            Compare EV plans
          </Button>
          <Button href="#tp-rates" size="lg" variant="outline-light">
            Third-party rates by kW
          </Button>
        </div>
      </LandingHero>
      <CategoryAd />

      {/* What differs */}
      <Section id="differences" eyebrow="What's different" title="Same policy types. Different risks." intro={<p>Third-party cover is compulsory and comprehensive cover is sensible, exactly as for a petrol car. These six things are what change.</p>}>
        <div className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {DIFFERENCES.map(({ Icon, title, text }) => (
            <div key={title} className="bg-white p-6 sm:p-7">
              <Icon aria-hidden className="size-5 text-red" />
              <h3 className="type-h4 mt-5 text-[17px]">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* TP by kW */}
      <Section
        id="tp-rates"
        tone="mist"
        eyebrow="Third-party premiums"
        title="Priced by the motor, not the engine."
        intro={<p>These are the electric-car slabs MarchGear&apos;s indicative estimates currently use. They come from our pricing configuration, which staff keep in line with the regulator&apos;s notification.</p>}
      >
        <EvSlabFinder />
      </Section>

      {/* Battery add-on */}
      <section id="battery" aria-labelledby="battery-title" className="scroll-mt-36 bg-ink text-white">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="relative min-h-[300px] lg:min-h-full">
            <Image src={IMG.chargePlug} alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover opacity-80" />
          </div>
          <div className="px-5 py-14 md:px-12 md:py-20 xl:px-16">
            <p className="type-eyebrow flex items-center gap-3 text-white/70">
              <span aria-hidden className="h-px w-6 bg-red" />
              The EV add-on
            </p>
            <h2 id="battery-title" className="type-h2 mt-5 text-balance">
              {battery?.name ?? "EV battery protection"}
            </h2>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/70">{battery?.summary}</p>
            <ul className="mt-8 space-y-3 text-[14.5px] text-white/80">
              <li className="flex gap-3">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-red" />
                Fills the gap for water ingress and electrical short circuits that a standard policy may exclude.
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-red" />
                Doesn&apos;t cover gradual capacity loss with age — that&apos;s the manufacturer&apos;s battery warranty.
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-red" />
                Usually priced as a small percentage of the IDV. Ask how a claim is assessed: module repair or full pack replacement.
              </li>
            </ul>
            <p className="mt-8 text-[13px] text-white/55 num">
              {offers.total > 0
                ? `${batteryCount} of ${offers.total} listed ${offers.total === 1 ? "plan offers" : "plans offer"} EV battery protection.`
                : "No plans are listed yet — the comparison will show which ones offer it."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button href="/insurance/compare?addons=ev_battery" variant="light" arrow>
                Compare plans with battery cover
              </Button>
              <Link href="/insurance/add-ons#ev_battery" className="group inline-flex h-11 items-center gap-1.5 px-2 text-[14px] font-medium text-white">
                All add-ons
                <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Engine protection note */}
      <Section
        id="skip"
        eyebrow="Don't pay for what you can't use"
        title="Engine protection on an EV? Leave it out."
        layout="aside"
        intro={<p>Some bundles include add-ons written for combustion engines. On an electric car there&apos;s no engine to protect from water — check the add-on list before you pay.</p>}
      >
        <div className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2">
          {EV_ADDON_FIT.map(({ title, items }) => (
            <div key={title} className="bg-white p-6">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</p>
              <ul className="mt-4 space-y-2.5 text-[14.5px]">
                {items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <QuoteSection
        title="Compare cover for your electric car."
        text="Choose your EV and variant. The indicative third-party premium is worked out from its motor power; own damage from its IDV and the provider's rates."
        defaultIntent="new"
        initial={{ fuel: "Electric" }}
        source="insurance-ev"
      />
      <RelatedGuides guides={guides} />
      <CtaBand title="Switching to electric?" accent="Insure the battery properly." action={{ label: "Compare EV plans", href: "#quote" }} topic="addons" />
    </>
  );
}
