import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, X } from "lucide-react";
import { STANDARD_COVER_BY_KEY } from "@/insurance/covers";
import { IMG } from "@/data/images";
import { cn } from "@/lib/utils";
import { getCatalog } from "@/server/catalog";
import { Button } from "@/components/ui/button";
import { CategoryAd, CtaBand, HeroFacts, LandingHero, QuoteSection, RelatedGuides, Section, pickGuides } from "@/components/insurance/public/landing";
import { TP_NOTE, TpRateTable } from "@/components/insurance/public/tp-rates";

export const metadata: Metadata = {
  title: "New car insurance — bundled 1 + 3 year policies explained",
  description:
    "Insuring a new car in India: three years of third-party cover from day one, how bundled policies work in years two and three, invoice cover, and how to compare against the dealer's offer.",
  alternates: { canonical: "/insurance/new-car" },
};

const YEARS = [
  { year: "Year 1", od: "Own damage (in the bundled policy)", tp: true, note: "Bought with the car, before registration." },
  { year: "Year 2", od: "Standalone own damage — any insurer", tp: true, note: "Renew own damage only. Your first chance to switch." },
  { year: "Year 3", od: "Standalone own damage — any insurer", tp: true, note: "Renew own damage again; third party still running." },
  { year: "Year 4+", od: "Comprehensive, renewed yearly", tp: false, note: "Both parts come due together — one ordinary policy." },
];

const EARLY_ADDONS = ["zero_dep", "rti", "engine_protection", "consumables", "key_replacement", "rsa"];

export default async function NewCarInsurancePage() {
  const { content } = await getCatalog();
  const page = content.insurancePage.pages.newCar;
  const pricing = content.insurancePricing;
  const guides = pickGuides(content.insuranceGuides.guides, ["insuring-a-new-car", "zero-depreciation-explained", "what-is-idv"]);
  const firstDep = pricing.depreciation[0];

  return (
    <>
      <LandingHero hero={page} image={IMG.showroomCoupe} imageFocus="50% 60%" crumb="New car">
        <HeroFacts
          facts={[
            { value: "3 years", label: "of third-party cover, required from day one" },
            { value: "1 year", label: "of own-damage cover, renewed every year" },
            { value: firstDep ? `${firstDep.pct}%` : "5%", label: "typical IDV depreciation in the first six months" },
            { value: "Your choice", label: "of insurer — the dealer's policy is optional" },
          ]}
        />
      </LandingHero>
      <CategoryAd />

      <QuoteSection
        title="Get indicative premiums before delivery day."
        text="Tick “New car / no registration number yet”, choose the exact variant and where it will be registered. Compare, then ask providers for a quote."
        defaultIntent="new"
        initial={{ intent: "new", policy: "new_vehicle" }}
        source="insurance-new-car"
        tone="white"
      />

      {/* Bundled policy timeline */}
      <Section
        id="bundled"
        tone="mist"
        eyebrow="How a bundled policy works"
        title="One purchase, three years of third party, an own-damage renewal every year."
        intro={<p>Most new cars are insured with a bundled policy: one year of own-damage cover plus three years of third-party cover. Some insurers also offer multi-year own-damage terms.</p>}
      >
        <div className="grid grid-cols-1 border border-line bg-white md:grid-cols-4">
          {YEARS.map((y, i) => (
            <div key={y.year} className={cn("flex flex-col p-6", i > 0 && "border-t border-line md:border-l md:border-t-0")}>
              <p className="font-display text-[22px] font-semibold tracking-[-0.02em]">{y.year}</p>
              <div className="mt-5 space-y-2">
                <div className="flex h-9 items-center bg-ink px-3 text-[12px] font-medium text-white">{y.od}</div>
                <div
                  className={cn(
                    "flex h-9 items-center px-3 text-[12px] font-medium",
                    y.tp ? "bg-red text-white" : "border border-dashed border-line text-muted",
                    // The three-year term reads as one continuous band on desktop.
                    y.tp && i === 0 && "md:-mr-[25px]",
                    y.tp && i === 1 && "md:-ml-[24px] md:-mr-[25px] md:pl-[36px]",
                    y.tp && i === 2 && "md:-ml-[24px] md:pl-[36px]",
                  )}
                >
                  {y.tp ? (i === 0 ? "Third party · 3-year term begins" : i === 2 ? "Third party · final year" : "Third party continues") : "Included in comprehensive"}
                </div>
              </div>
              <p className="mt-5 text-[13.5px] leading-relaxed text-muted">{y.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-2">
            <span className="size-3 bg-ink" /> Own-damage cover
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-3 bg-red" /> Third-party cover (three-year term)
          </span>
        </p>
      </Section>

      {/* Invoice cover */}
      <Section
        id="invoice-cover"
        eyebrow="Return to invoice"
        title="The gap between what you paid and what you're insured for."
        layout="aside"
        intro={
          <>
            <p>A new car&apos;s IDV starts from the ex-showroom price, less a small depreciation. Road tax, registration and the premium itself aren&apos;t part of it — so if the car is stolen or written off, a standard policy pays noticeably less than you spent.</p>
            <p>Return-to-invoice cover pays that difference on theft or total loss, typically up to the invoice value including road tax and registration. It&apos;s usually offered only for the first few years.</p>
          </>
        }
      >
        <figure className="border border-line p-6 sm:p-8">
          <figcaption className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Illustration — not to scale</figcaption>
          <div className="mt-8 space-y-6">
            <div>
              <p className="text-[13.5px] font-semibold">What you paid (on-road)</p>
              <div className="mt-2 flex h-11 text-[12px] font-medium">
                <span className="flex flex-[78] items-center bg-ink px-3 text-white">Ex-showroom price</span>
                <span className="flex flex-[14] items-center justify-center bg-ink-3 px-2 text-center text-white/80">Road tax &amp; registration</span>
                <span className="flex flex-[8] items-center justify-center bg-muted px-1 text-white">Ins.</span>
              </div>
            </div>
            <div>
              <p className="text-[13.5px] font-semibold">What a standard policy pays on total loss</p>
              <div className="mt-2 flex h-11 text-[12px] font-medium">
                <span className="flex flex-[74] items-center bg-mist px-3 ring-1 ring-inset ring-line">IDV (ex-showroom less depreciation)</span>
                <span className="flex flex-[26] items-center justify-center border border-dashed border-red bg-red-50 px-2 text-center text-red">The gap RTI covers</span>
              </div>
            </div>
          </div>
          <p className="mt-6 text-[12.5px] leading-relaxed text-muted">The actual split depends on the car, the state&apos;s road tax and the insurer&apos;s terms. Deductibles still apply.</p>
        </figure>
      </Section>

      {/* Add-ons that matter early */}
      <Section id="add-ons" tone="mist" eyebrow="Add-ons for a new car" title="Decide on add-ons now — many have age limits.">
        <ul className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {EARLY_ADDONS.map((k) => STANDARD_COVER_BY_KEY[k])
            .filter(Boolean)
            .map((a) => (
              <li key={a.key} className="bg-white">
                <Link href={`/insurance/add-ons#${a.key}`} className="group flex h-full flex-col p-6">
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-[16px] font-semibold group-hover:text-red">{a.name}</span>
                    <ArrowUpRight aria-hidden className="size-4 shrink-0 text-muted transition-colors group-hover:text-red" />
                  </span>
                  <span className="mt-2 text-[14px] leading-relaxed text-muted">{a.summary}</span>
                  <span className="mt-auto pt-4 text-[12px] text-ink/70">{a.typicalMaxAge ? `Typically for cars up to ${a.typicalMaxAge} years old` : "Usually available at any age"}</span>
                </Link>
              </li>
            ))}
        </ul>
      </Section>

      {/* Dealer vs your own */}
      <Section
        id="dealer"
        eyebrow="Dealer or your own insurer?"
        title="You don't have to take the dealer's policy."
        layout="aside"
        intro={<p>The dealer&apos;s offer can be convenient — but you&apos;re free to arrange cover yourself. Compare on equal terms, and start a few days before delivery so the policy is ready for registration.</p>}
      >
        <div className="grid grid-cols-1 gap-px border border-line bg-line md:grid-cols-2">
          <div className="bg-white p-6 sm:p-8">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Compare like with like</p>
            <ul className="mt-5 space-y-3 text-[14.5px]">
              {["The same IDV", "The same add-ons, included or optional", "The same compulsory and voluntary deductibles", "The same term — 1 + 3 or multi-year own damage", "Cashless garages near you"].map((t) => (
                <li key={t} className="flex gap-3">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-red" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white p-6 sm:p-8">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Watch out for</p>
            <ul className="mt-5 space-y-3 text-[14.5px]">
              {["A lower premium that comes from a lower IDV", "Zero depreciation quietly left out", "The wrong variant, engine or chassis number", "A missing hypothecation if the car is financed", "No NCB applied when you're bringing one from an old car"].map((t) => (
                <li key={t} className="flex gap-3">
                  <X aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="#quote" arrow>
            Compare before delivery
          </Button>
          <Button href="/insurance/guides/insuring-a-new-car" variant="outline">
            Read the new-car guide
          </Button>
        </div>
      </Section>

      {/* Three-year third-party rates */}
      <Section
        id="tp-rates"
        tone="mist"
        eyebrow="Third-party premiums"
        title="Three-year third-party rates."
        layout="aside"
        intro={
          <>
            <p>Third-party premiums are notified by the regulator and are the same whichever insurer you choose. For a new car you pay three years up front.</p>
            <p className="text-[13px]">{TP_NOTE}</p>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <TpRateTable slabs={pricing.tpPrivateCar} unit="cc" caption="Petrol, diesel, CNG and hybrid cars" />
          <TpRateTable slabs={pricing.tpElectric} unit="kW" caption="Electric cars" />
        </div>
      </Section>

      <RelatedGuides guides={guides} />
      <CtaBand title="Taking delivery soon?" accent="Insure it on your terms." action={{ label: "Get new-car quotes", href: "#quote" }} topic="new" />
    </>
  );
}
