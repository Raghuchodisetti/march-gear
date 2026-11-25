import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { STANDARD_ADDONS } from "@/insurance/covers";
import { IMG } from "@/data/images";
import { cn } from "@/lib/utils";
import { getCatalog } from "@/server/catalog";
import { getAddOnOffers } from "@/server/insurance/public-content";
import { Button } from "@/components/ui/button";
import { ADDON_DETAILS, eligibilityText, pricingText } from "@/components/insurance/public/addon-details";
import { CategoryAd, CtaBand, HeroFacts, LandingHero, QuoteSection, RelatedGuides, pickGuides } from "@/components/insurance/public/landing";
import { INSURANCE_OG_IMAGE, pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Car Insurance Add-ons: Zero Dep, RTI & More",
  description: "Car insurance add-ons explained: zero depreciation, engine protection, return to invoice and more — what each pays for, who qualifies and how it's priced.",
  path: "/insurance/add-ons",
  images: [INSURANCE_OG_IMAGE],
});

const compareHref = (key: string) => `/insurance/compare?addons=${encodeURIComponent(key)}`;

export default async function AddOnsPage() {
  await connection();
  const [{ content }, offers] = await Promise.all([getCatalog(), getAddOnOffers()]);
  const page = content.insurancePage.pages.addOns;
  const guides = pickGuides(content.insuranceGuides.guides, ["zero-depreciation-explained", "insuring-a-new-car", "ev-insurance"]);
  const count = (key: string) => offers.byKey[key] ?? 0;
  const planText = (key: string) => (offers.total ? `${count(key)} of ${offers.total} listed plans` : "No listed plans yet");

  return (
    <>
      <LandingHero hero={page} image={IMG.detailSculpted} imageFocus="50% 50%" crumb="Add-ons">
        <HeroFacts
          facts={[
            { value: String(STANDARD_ADDONS.length), label: "common add-on covers, explained" },
            { value: offers.total ? String(offers.total) : "—", label: offers.total ? "listed plans compared below" : "plans listed yet — insurers are onboarding" },
            { value: "Yearly", label: "add-ons are chosen at each renewal" },
          ]}
        />
      </LandingHero>
      <CategoryAd />

      {/* Overview table */}
      <section aria-labelledby="addons-table-title" className="py-14 md:py-20">
        <div className="container-x">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <h2 id="addons-table-title" className="type-h2 max-w-2xl text-balance">
              At a glance.
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-muted">Typical eligibility and pricing — each provider sets its own limits and rates, shown on its product page.</p>
          </div>
          {/* Phones: a compact list */}
          <ul className="mt-10 border-t border-ink md:hidden">
            {STANDARD_ADDONS.map((a) => (
              <li key={a.key} className="border-b border-line py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <a href={`#${a.key}`} className="text-[15.5px] font-semibold hover:text-red">
                    {a.name}
                  </a>
                  <Link href={compareHref(a.key)} className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium">
                    Compare
                    <ArrowUpRight aria-hidden className="size-3.5 text-red" />
                  </Link>
                </div>
                <p className="mt-1.5 text-[13px] text-muted">{eligibilityText(a)}</p>
                <p className="mt-1 text-[12.5px] text-ink/70 num">{planText(a.key)}</p>
              </li>
            ))}
          </ul>
          <div className="relative mt-10 hidden overflow-x-auto border border-line md:block">
            <table className="w-full min-w-[820px] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-ink text-[12px] text-muted">
                  <th scope="col" className="px-5 py-3.5 font-medium">
                    Add-on
                  </th>
                  <th scope="col" className="px-5 py-3.5 font-medium">
                    Typical eligibility
                  </th>
                  <th scope="col" className="px-5 py-3.5 font-medium">
                    How it&apos;s priced
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right font-medium">
                    Offered by
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    <span className="sr-only">Compare</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {STANDARD_ADDONS.map((a) => (
                  <tr key={a.key} className="border-b border-line last:border-b-0 hover:bg-mist/50">
                    <th scope="row" className="px-5 py-4 font-semibold">
                      <a href={`#${a.key}`} className="hover:text-red">
                        {a.name}
                      </a>
                    </th>
                    <td className="px-5 py-4 text-muted">{eligibilityText(a)}</td>
                    <td className="max-w-[18rem] px-5 py-4 text-muted">{pricingText(a)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right num">{planText(a.key)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <Link href={compareHref(a.key)} className="inline-flex items-center gap-1 text-[13px] font-medium hover:text-red">
                        Compare
                        <ArrowUpRight aria-hidden className="size-3.5 text-red" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Each add-on */}
      <section aria-labelledby="addons-detail-title" className="bg-mist py-14 md:py-20">
        <div className="container-x">
          <h2 id="addons-detail-title" className="type-h2 max-w-2xl text-balance">
            Each add&#8209;on, <span className="type-editorial font-normal text-ink/80">in plain words.</span>
          </h2>
          <div className="mt-12 space-y-px border border-line bg-line">
            {STANDARD_ADDONS.map((a, i) => {
              const d = ADDON_DETAILS[a.key];
              return (
                <article key={a.key} id={a.key} className="grid scroll-mt-36 grid-cols-1 gap-8 bg-white p-6 sm:p-8 lg:grid-cols-12 lg:gap-10 xl:p-10">
                  <div className="lg:col-span-4">
                    <span className="font-display text-[13px] font-semibold text-muted num">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="type-h3 mt-2">{a.name}</h3>
                    <p className="mt-3 text-[14.5px] leading-relaxed text-ink/80">{a.summary}</p>
                    <dl className="mt-5 space-y-2 text-[13px]">
                      <div className="flex gap-2">
                        <dt className="text-muted">Eligibility:</dt>
                        <dd>{eligibilityText(a)}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-muted">Listed:</dt>
                        <dd className="num">{planText(a.key)}</dd>
                      </div>
                    </dl>
                    <Link href={compareHref(a.key)} className="group mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-medium">
                      Compare plans with {a.name.toLowerCase()}
                      <ArrowRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                  {d && (
                    <dl className="grid grid-cols-1 gap-px self-start border border-line bg-line sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
                      {[
                        ["What it pays for", d.pays],
                        ["Watch for", d.watch],
                        ["Worth it if", d.worth],
                      ].map(([t, v], j) => (
                        <div key={t} className={cn("bg-white p-5", j === 2 && "sm:col-span-2 lg:col-span-1")}>
                          <dt className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", j === 1 ? "text-red" : "text-muted")}>{t}</dt>
                          <dd className="mt-2.5 text-[14px] leading-relaxed text-ink/85">{v}</dd>
                        </div>
                      ))}
                      <div className="bg-white p-5 sm:col-span-2 lg:col-span-3">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">How it&apos;s priced</dt>
                        <dd className="mt-2 text-[14px] leading-relaxed text-ink/85">{pricingText(a)}</dd>
                      </div>
                    </dl>
                  )}
                </article>
              );
            })}
          </div>
          <p className="mt-6 max-w-3xl text-[12.5px] leading-relaxed text-muted">
            General explanations, not any insurer&apos;s terms. The add-on&apos;s own wording decides what it pays — ask the provider for it before you buy.
          </p>
          <Button href="/insurance/compare" className="mt-8" arrow>
            Compare plans and their add-ons
          </Button>
        </div>
      </section>

      <QuoteSection
        title="See which add-ons your car qualifies for."
        text="Add-ons depend on the car's age and fuel. Describe yours and we'll show the plans — and add-ons — that accept it, with indicative premiums."
        source="insurance-add-ons"
        tone="white"
      />
      <RelatedGuides guides={guides} />
      <CtaBand title="Not sure which add-ons you need?" accent="Ask before you pay." action={{ label: "Compare plans", href: "/insurance/compare" }} topic="addons" />
    </>
  );
}
