import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, UserRound } from "lucide-react";
import { IMG } from "@/data/images";
import { getCatalog } from "@/server/catalog";
import { Button } from "@/components/ui/button";
import { CategoryAd, CtaBand, HeroFacts, LandingHero, QuoteSection, RelatedGuides, Section, Steps, pickGuides } from "@/components/insurance/public/landing";
import { INSURANCE_OG_IMAGE, pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Used Car Insurance: Policy and NCB Transfer",
  description: "Bought a used car? How to transfer the insurance policy to your name, why the seller's no-claim bonus stays with them, and what to do if cover has lapsed.",
  path: "/insurance/used-car",
  images: [INSURANCE_OG_IMAGE],
});

const BEFORE_YOU_BUY = [
  "The policy is current — check the expiry date on the schedule, not just the sticker on the windscreen",
  "The registration, engine and chassis numbers on the policy match the car",
  "Whether the car has had claims — ask the seller, and look for repair invoices",
  "Any loan is closed and the lender's name is removed from the RC and the policy",
  "The fuel type on the policy matches the car, including any fitted CNG kit",
];

export default async function UsedCarInsurancePage() {
  const { content } = await getCatalog();
  const page = content.insurancePage.pages.usedCar;
  const guides = pickGuides(content.insuranceGuides.guides, ["how-ncb-works", "renewing-a-lapsed-policy", "comprehensive-vs-third-party-vs-own-damage"]);

  return (
    <>
      <LandingHero hero={page} image={IMG.classicPorsches} imageFocus="50% 65%" crumb="Used car">
        <HeroFacts
          facts={[
            { value: "14 days", label: "to apply to the insurer after the ownership transfer" },
            { value: "0%", label: "of the seller's NCB comes with the car" },
            { value: "Yours", label: "your own NCB can be applied to the car" },
          ]}
        />
      </LandingHero>
      <CategoryAd />

      {/* Transfer */}
      <Section
        id="transfer"
        eyebrow="Transferring the policy"
        title="Put the policy in your name — quickly."
        layout="aside"
        intro={
          <>
            <p>When a car changes hands, its insurance doesn&apos;t simply carry on in the seller&apos;s name. Under the Motor Vehicles Act the new owner must apply to the insurer within 14 days of the transfer so the policy and certificate can be changed.</p>
            <p>Third-party liability is treated as passing with the car; own-damage cover is only reliable once the insurer has endorsed the transfer — until then, a claim for damage to the car may be refused.</p>
          </>
        }
      >
        <Steps
          steps={[
            { title: "Agree the paperwork with the seller", text: "Signed transfer forms for the RTO, a sale letter or delivery note with the date and time of sale, and the original policy." },
            { title: "Apply for the RC transfer", text: "Ownership changes at the RTO. Keep the acknowledgement — the insurer may ask for it if the new RC isn't ready yet." },
            { title: "Apply to the insurer within 14 days", text: "Send the transfer request with the sale proof, the RC (or RTO application), your ID and a copy of the policy." },
            { title: "Settle the NCB difference", text: "The seller's no-claim bonus doesn't pass to you, so the insurer usually recovers it for the rest of the term — unless you bring a bonus of your own." },
            { title: "Get the endorsement", text: "The insurer issues an endorsement in your name. Keep it with the policy; that's what a claim will be checked against." },
          ]}
        />
      </Section>

      {/* NCB */}
      <Section
        id="ncb"
        tone="ink"
        eyebrow="No-claim bonus"
        title="The bonus belongs to the owner, not the car."
        intro={<p>NCB rewards a person&apos;s claim-free record. That has two consequences when a used car is sold.</p>}
      >
        <div className="grid grid-cols-1 gap-px border border-white/10 bg-white/10 md:grid-cols-2">
          <div className="bg-ink p-6 sm:p-8">
            <UserRound aria-hidden className="size-6 text-white/60" />
            <h3 className="type-h3 mt-5">The buyer</h3>
            <p className="mt-3 text-[14.5px] leading-relaxed text-white/65">
              You don&apos;t inherit the seller&apos;s discount. If you&apos;ve earned your own NCB on a car you sold, bring the NCB retention letter from that insurer and it can be applied here.
            </p>
          </div>
          <div className="bg-ink p-6 sm:p-8">
            <UserRound aria-hidden className="size-6 text-red" />
            <h3 className="type-h3 mt-5">The seller</h3>
            <p className="mt-3 text-[14.5px] leading-relaxed text-white/65">
              Keep your bonus for your next car. Ask your insurer for an NCB retention letter when you sell — insurers typically accept it for a limited period, often up to three years.
            </p>
          </div>
        </div>
        <Link href="/insurance/guides/how-ncb-works" className="group mt-8 inline-flex items-center gap-1.5 text-[14px] font-medium">
          How NCB works
          <ArrowRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover:translate-x-0.5" />
        </Link>
      </Section>

      {/* Lapsed */}
      <Section
        id="lapsed"
        eyebrow="If the policy has lapsed"
        title="An expired policy means an inspection."
        layout="aside"
        intro={<p>Used cars sometimes sit unsold for months with the insurance quietly running out. If that&apos;s the case, you&apos;re buying a new policy rather than transferring one.</p>}
      >
        <div className="border border-line">
          <div className="flex items-start gap-4 border-b border-line bg-red-50 p-5 sm:p-6">
            <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-red" />
            <p className="text-[14.5px] leading-relaxed text-ink">Don&apos;t drive the car home on an expired policy. Third-party cover is a legal requirement from the moment the car is on the road.</p>
          </div>
          <ul className="divide-y divide-line">
            {[
              ["Comprehensive or own-damage cover", "The insurer will inspect the car first — in person or through photos and a video in its app — and note any existing damage."],
              ["Third-party-only cover", "Usually issued without an inspection, because it doesn't cover the car itself."],
              ["When cover starts", "From the date and time the new policy is issued, never backdated."],
            ].map(([t, d]) => (
              <li key={t} className="grid grid-cols-1 gap-1 p-5 sm:grid-cols-[14rem_1fr] sm:gap-6 sm:p-6">
                <p className="text-[14.5px] font-semibold">{t}</p>
                <p className="text-[14.5px] leading-relaxed text-muted">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Before you buy */}
      <Section id="checklist" tone="mist" eyebrow="Before you pay" title="Five insurance checks for any used car." layout="aside">
        <ul className="border-t border-ink">
          {BEFORE_YOU_BUY.map((t) => (
            <li key={t} className="flex gap-4 border-b border-line py-4 text-[15px] leading-relaxed">
              <Check aria-hidden className="mt-1 size-4 shrink-0 text-red" />
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/used-cars" variant="outline">
            Browse used cars
          </Button>
          <Button href="#quote" arrow>
            Insure a used car
          </Button>
        </div>
      </Section>

      <QuoteSection
        title="Need a new policy for a pre-owned car?"
        text="If the existing policy has expired — or you'd rather start afresh at renewal — describe the car and compare indicative premiums from listed providers."
        defaultIntent="new"
        source="insurance-used-car"
        tone="white"
      />
      <RelatedGuides guides={guides} />
      <CtaBand title="Transferring a policy can be confusing." accent="We'll talk you through it." action={{ label: "Compare plans", href: "/insurance/compare" }} topic="other" />
    </>
  );
}
