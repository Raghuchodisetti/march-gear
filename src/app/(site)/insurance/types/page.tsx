import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Check, Minus } from "lucide-react";
import { INS_PRODUCT_CATEGORIES, type InsProductCategory } from "@/db/enums";
import { CATEGORY_TERMS } from "@/insurance/estimator";
import { INS_PRODUCT_CATEGORY_BLURB, INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { IMG } from "@/data/images";
import { cn } from "@/lib/utils";
import { getCatalog } from "@/server/catalog";
import { getPublicCategoryCounts } from "@/server/insurance/public";
import { Button } from "@/components/ui/button";
import { CategoryAd, CtaBand, LandingHero, PlansListed, QuoteSection, RelatedGuides, Section, pickGuides } from "@/components/insurance/public/landing";
import { INSURANCE_OG_IMAGE, pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Types of Car Insurance Explained",
  description: "Every kind of private car insurance in India explained: comprehensive, third-party, standalone own-damage, bundled new-car, used-car, EV and long-term cover.",
  path: "/insurance/types",
  images: [INSURANCE_OG_IMAGE],
});

const ANCHOR: Record<InsProductCategory, string> = {
  comprehensive: "comprehensive",
  third_party: "third-party",
  own_damage: "own-damage",
  bundled: "bundled",
  new_car: "new-car",
  used_car: "used-car",
  ev: "ev",
  long_term: "long-term",
};

/** Who each category suits, and where to read more. */
const SUITS: Record<InsProductCategory, { suits: string; more?: { label: string; href: string } }> = {
  comprehensive: { suits: "Most cars worth repairing, from year four of a new car onwards.", more: { label: "Comprehensive vs third-party", href: "/insurance/guides/comprehensive-vs-third-party-vs-own-damage" } },
  third_party: { suits: "Older, low-value cars where you'd pay for your own repairs." },
  own_damage: { suits: "Cars that already have a separate, valid third-party policy — typically years two and three of a new car.", more: { label: "How standalone OD works", href: "/insurance/guides/comprehensive-vs-third-party-vs-own-damage" } },
  bundled: { suits: "New cars: the usual way to meet the three-year third-party rule.", more: { label: "New car insurance", href: "/insurance/new-car" } },
  new_car: { suits: "Cars being registered for the first time.", more: { label: "New car insurance", href: "/insurance/new-car" } },
  used_car: { suits: "Pre-owned cars, including moving the existing policy to the new owner.", more: { label: "Used car insurance", href: "/insurance/used-car" } },
  ev: { suits: "Battery-electric cars — look for battery and charger cover.", more: { label: "EV insurance", href: "/insurance/ev" } },
  long_term: { suits: "Owners who'd rather not renew every year and are happy to pay for the whole term up front." },
};

const term = (c: InsProductCategory) => {
  const { odYears, tpYears } = CATEGORY_TERMS[c];
  if (odYears && tpYears) return odYears === tpYears ? `${odYears} yr OD + TP` : `${odYears} yr OD + ${tpYears} yr TP`;
  if (odYears) return `${odYears} yr OD only`;
  return `${tpYears} yr TP only`;
};

type Cell = boolean | string;
/** What's covered, by category (typical terms — every plan sets its own). */
const coverRows = (c: InsProductCategory): Cell[] => {
  const { odYears, tpYears } = CATEGORY_TERMS[c];
  return [odYears > 0, tpYears > 0 ? true : "Separate policy", tpYears > 0 ? true : "With the TP policy", odYears > 0, term(c)];
};
const ROW_LABELS = ["Own damage (your car)", "Third-party liability", "Owner-driver PA cover", "Add-on covers", "Typical term"];

export default async function InsuranceTypesPage() {
  await connection();
  const [{ content }, counts] = await Promise.all([getCatalog(), getPublicCategoryCounts()]);
  const page = content.insurancePage.pages.types;
  const guides = pickGuides(content.insuranceGuides.guides, ["comprehensive-vs-third-party-vs-own-damage", "what-is-idv", "insuring-a-new-car"]);

  return (
    <>
      <LandingHero hero={page} image={IMG.aerialLot} imageFocus="50% 50%" crumb="Types">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button href="#whats-covered" size="lg" arrow>
            What each one covers
          </Button>
          <Button href="#quote" size="lg" variant="outline-light">
            Find plans for my car
          </Button>
        </div>
      </LandingHero>
      <CategoryAd />

      {/* All eight categories */}
      <section aria-labelledby="types-all-title" className="py-14 md:py-20">
        <div className="container-x">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <h2 id="types-all-title" className="type-h2 max-w-2xl text-balance">
              Eight policy types. <span className="type-editorial font-normal text-ink/80">One car.</span>
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-muted">
              Insurers file their products under these categories. Terms shown are typical — each plan sets its own, so check the product page before you choose.
            </p>
          </div>
          <ol className="mt-12 grid grid-cols-1 border-t border-ink md:grid-cols-2 md:gap-x-12">
            {INS_PRODUCT_CATEGORIES.map((c, i) => (
              <li key={c} id={ANCHOR[c]} className="scroll-mt-36 border-b border-line py-7">
                <div className="flex items-start gap-5">
                  <span className="w-8 shrink-0 pt-1 font-display text-[15px] font-semibold text-muted num">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                      <h3 className="type-h3">{INS_PRODUCT_CATEGORY_LABEL[c]}</h3>
                      <span className="rounded-[2px] bg-mist px-2 py-1 text-[11.5px] font-medium text-ink/80 num">{term(c)}</span>
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink/85">{INS_PRODUCT_CATEGORY_BLURB[c]}</p>
                    <p className="mt-2 text-[14px] leading-relaxed text-muted">
                      <span className="font-medium text-ink">Suits: </span>
                      {SUITS[c].suits}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                      <PlansListed count={counts[c] ?? 0} />
                      {SUITS[c].more && (
                        <Link href={SUITS[c].more.href} className="group inline-flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-ink">
                          {SUITS[c].more.label}
                          <ArrowRight aria-hidden className="size-3.5 transition-transform duration-[250ms] group-hover:translate-x-0.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What's covered */}
      <Section
        id="whats-covered"
        tone="mist"
        eyebrow="What's covered"
        title="Side by side, by policy type."
        intro={<p>The usual shape of each policy type. Individual plans can differ — add-ons, limits and terms are on each product page.</p>}
      >
        <div className="relative overflow-x-auto border border-line bg-white">
          <table className="w-full min-w-[960px] border-collapse text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-ink">
                <th scope="col" className="sticky left-0 z-10 w-48 bg-white px-5 py-4 text-[12px] font-medium text-muted">
                  Cover
                </th>
                {INS_PRODUCT_CATEGORIES.map((c) => (
                  <th key={c} scope="col" className="px-4 py-4 align-bottom text-[13px] font-semibold leading-snug">
                    <a href={`#${ANCHOR[c]}`} className="hover:text-red">
                      {INS_PRODUCT_CATEGORY_LABEL[c]}
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROW_LABELS.map((label, r) => (
                <tr key={label} className="border-b border-line last:border-b-0">
                  <th scope="row" className="sticky left-0 z-10 bg-white px-5 py-3.5 font-medium">
                    {label}
                  </th>
                  {INS_PRODUCT_CATEGORIES.map((c) => {
                    const v = coverRows(c)[r];
                    return (
                      <td key={c} className={cn("px-4 py-3.5", r === 4 && "num text-[12.5px]")}>
                        {v === true ? (
                          <Check aria-label="Included" className="size-4 text-red" strokeWidth={2.5} />
                        ) : v === false ? (
                          <Minus aria-label="Not included" className="size-4 text-muted" />
                        ) : (
                          <span className="text-muted">{v}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
          OD = own damage, TP = third-party liability, PA = compulsory personal accident cover for the owner-driver (you may be able to opt out if you already hold qualifying cover). Third-party property damage is covered up to a limit; injury and death liability is generally unlimited.
        </p>
      </Section>

      {/* How to choose */}
      <Section id="choose" eyebrow="How to choose" title="Four questions settle it." layout="aside" intro={<p>Work down the list. The first “yes” usually tells you which policy type to compare.</p>}>
        <ol className="border-t border-ink">
          {[
            { q: "Is the car brand new, not yet registered?", a: "You need three years of third-party cover from day one — compare bundled (1 + 3) and new-car policies.", href: "/insurance/new-car", cta: "New car insurance" },
            { q: "Does it already have a separate third-party policy that's still running?", a: "Buy a standalone own-damage policy for the car itself, from any insurer.", href: "#own-damage", cta: "Standalone own-damage" },
            { q: "Is it electric?", a: "Compare EV policies and look for battery protection — third-party rates are set by motor power.", href: "/insurance/ev", cta: "EV insurance" },
            { q: "Is it old enough that you'd pay for repairs yourself?", a: "Third-party cover meets the law. For anything else, a comprehensive policy is the right base.", href: "#third-party", cta: "Third-party vs comprehensive" },
          ].map((s, i) => (
            <li key={s.q} className="grid grid-cols-[2.5rem_1fr] gap-4 border-b border-line py-6 sm:grid-cols-[3rem_1fr_auto] sm:items-center">
              <span className="font-display text-[22px] font-semibold text-red num">{i + 1}</span>
              <div>
                <p className="text-[16px] font-semibold">{s.q}</p>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{s.a}</p>
              </div>
              <Link href={s.href} className="col-start-2 inline-flex items-center gap-1.5 text-[13px] font-medium hover:text-red sm:col-start-3 sm:justify-self-end">
                {s.cta}
                <ArrowRight aria-hidden className="size-3.5 text-red" />
              </Link>
            </li>
          ))}
        </ol>
      </Section>

      <QuoteSection
        title="See the plans that fit your car."
        text="Choose your car and situation. We'll show listed plans with indicative premiums — then you decide which providers to ask for a quote."
        source="insurance-types"
      />
      <RelatedGuides guides={guides} />
      <CtaBand title="Not sure which type you need?" accent="Ask us — it's free." action={{ label: "Compare plans", href: "/insurance/compare" }} topic="compare" />
    </>
  );
}
