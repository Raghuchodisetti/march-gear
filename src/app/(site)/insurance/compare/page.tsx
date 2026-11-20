import type { Metadata } from "next";
import { getCatalog } from "@/server/catalog";
import { todayISO } from "@/server/validation";
import { getPublicProducts, getPublicSponsored } from "@/server/insurance/public";
import { parseSearch } from "@/insurance/search";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CompareExperience } from "@/components/insurance/public/market/compare-experience";
import { FILTER_ADDON_KEYS, idParam, listParam, pricingConfig } from "@/components/insurance/public/market/engine";

export const metadata: Metadata = {
  title: "Compare car insurance plans side by side",
  description: "Compare up to four car insurance plans: indicative premium, IDV, own-damage and third-party cover, add-ons, deductibles, cashless garages, exclusions and documents — with differences highlighted.",
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function InsuranceComparePage(props: PageProps<"/insurance/compare">) {
  const sp = await props.searchParams;
  const catalog = await getCatalog();
  const [products, sponsored] = await Promise.all([getPublicProducts(), getPublicSponsored(1)]);
  const refs = listParam(sp.products, undefined, 8).filter((r) => /^PRD-[A-Z0-9]{6}$/.test(r));
  const today = todayISO();

  return (
    <>
      <section className="border-b border-line">
        <div className="container-x pb-10 pt-8 md:pb-14 md:pt-10">
          <Breadcrumbs items={[{ label: "Insurance", href: "/insurance" }, { label: "Compare plans" }]} />
          <div className="mt-10 max-w-3xl md:mt-14">
            <p className="type-eyebrow inline-flex items-center gap-3 text-ink">
              <span aria-hidden className="h-px w-6 bg-red" />
              Compare plans
            </p>
            <h1 className="type-h1 mt-5 text-balance">
              Side by side, <span className="type-editorial font-normal">cover by cover.</span>
            </h1>
            <p className="type-lead mt-5 max-w-2xl text-muted">
              Line up to four plans — indicative premium, IDV, what&apos;s covered, add-ons, deductibles, garages and the fine print — with every difference marked.
            </p>
          </div>
        </div>
      </section>
      <CompareExperience
        products={products}
        initialRefs={refs}
        initialSearch={parseSearch(sp)}
        initialAddOns={listParam(sp.addons, FILTER_ADDON_KEYS)}
        config={pricingConfig(catalog.content.insurancePricing)}
        sponsored={sponsored[0] ?? null}
        maxRequests={catalog.content.insuranceSettings.maxQuoteRequests}
        today={today}
        attribution={{ source: /^[a-z0-9_-]{2,40}$/.test(first(sp.src)) ? first(sp.src) : "compare", campaignId: idParam(sp.campaign), adId: idParam(sp.ad) }}
      />
    </>
  );
}
