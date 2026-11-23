import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { getSessionUser } from "@/server/auth";
import { todayISO } from "@/server/validation";
import { getActiveCampaigns, getPublicProducts, getPublicSponsored } from "@/server/insurance/public";
import { getCustomerRequests } from "@/server/insurance/market";
import { INS_PRODUCT_CATEGORIES } from "@/db/enums";
import { parseSearch } from "@/insurance/search";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { InsuranceSearchForm } from "@/components/insurance/search/insurance-search-form";
import { QuotesExperience } from "@/components/insurance/public/market/quotes-experience";
import { CustomerRequests } from "@/components/insurance/public/market/customer-requests";
import { FILTER_ADDON_KEYS, idParam, listParam, pricingConfig, resolveVehicle, type SortKey } from "@/components/insurance/public/market/engine";

export const metadata: Metadata = {
  title: "Car insurance quotes — compare indicative premiums",
  description: "Indicative premiums, IDV, cover and add-ons from listed insurers for your car. Compare plans side by side and ask several insurers for a quote in one go.",
};

const SORTS: SortKey[] = ["premium", "idv", "garages"];
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function InsuranceQuotesPage(props: PageProps<"/insurance/quotes">) {
  const sp = await props.searchParams;
  const search = parseSearch(sp);
  const catalog = await getCatalog();
  const config = pricingConfig(catalog.content.insurancePricing);
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));
  const vehicle = resolveVehicle(search, catalog, config, today);
  const user = await getSessionUser("customer");
  const requests = user ? await getCustomerRequests(user.id) : null;

  const source = /^[a-z0-9_-]{2,40}$/.test(first(sp.src)) ? first(sp.src) : "quotes";
  const campaignId = idParam(sp.campaign);
  const adId = idParam(sp.ad);
  const providers = listParam(sp.provider);
  const categories = listParam(sp.type, INS_PRODUCT_CATEGORIES) as (typeof INS_PRODUCT_CATEGORIES)[number][];
  const addOns = listParam(sp.addons, FILTER_ADDON_KEYS);
  const sort = (SORTS as string[]).includes(first(sp.sort)) ? (first(sp.sort) as SortKey) : "premium";

  // What the search form should carry through to the results.
  const extraParams: Record<string, string> = {};
  if (campaignId) extraParams.campaign = String(campaignId);
  if (adId) extraParams.ad = String(adId);
  if (providers.length) extraParams.provider = providers.join(",");
  if (addOns.length) extraParams.addons = addOns.join(",");

  const requestsSection = (bordered: boolean) =>
    requests && (
      <div className="container-x pb-16 md:pb-24">
        <CustomerRequests requests={requests} today={today} className={bordered ? "border-t border-line pt-12 md:pt-16" : "pt-12 md:pt-16"} />
      </div>
    );

  if (!vehicle || vehicle.tooOld) {
    const unknownCar = Boolean(search.model) && !vehicle;
    return (
      <>
        <section className="border-b border-line">
          <div className="container-x pb-12 pt-8 md:pb-16 md:pt-10">
            <Breadcrumbs items={[{ label: "Insurance", href: "/insurance" }, { label: "Quotes" }]} />
            <div className="mt-10 grid grid-cols-1 gap-10 md:mt-14 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-5">
                <p className="type-eyebrow inline-flex items-center gap-3 text-ink">
                  <span aria-hidden className="h-px w-6 bg-red" />
                  Car insurance quotes
                </p>
                <h1 className="type-h1 mt-5 text-balance">
                  Tell us about <span className="type-editorial font-normal">your car.</span>
                </h1>
                <p className="type-lead mt-5 max-w-md text-muted">
                  We&apos;ll show indicative premiums, IDV, cover and add-ons from listed insurers — then you choose who to ask for a quote.
                </p>
                {(unknownCar || vehicle?.tooOld) && (
                  <p className="mt-8 flex max-w-md gap-3 border-l-2 border-red bg-red-50 px-4 py-3 text-[13.5px] text-ink">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-red" aria-hidden />
                    {vehicle?.tooOld
                      ? `We estimate premiums for cars up to ${config.maxVehicleAgeYears} years old. For older cars, ask an insurer directly.`
                      : "We couldn't find that car in our catalogue. Choose it again below."}
                  </p>
                )}
              </div>
              <div className="lg:col-span-7">
                <InsuranceSearchForm variant="panel" defaultIntent={search.intent} initial={search} source={source} extraParams={extraParams} />
              </div>
            </div>
          </div>
        </section>
        {requestsSection(false)}
      </>
    );
  }

  const [products, sponsored, campaigns] = await Promise.all([getPublicProducts(), getPublicSponsored(2), campaignId ? getActiveCampaigns(50) : Promise.resolve([])]);
  const campaign = campaigns.find((c) => c.id === campaignId) ?? null;

  return (
    <>
      <QuotesExperience
        key={`${new URLSearchParams(Object.entries(search).map(([k, v]) => [k, String(v ?? "")])).toString()}`}
        products={products}
        vehicle={vehicle}
        config={config}
        sponsored={sponsored}
        maxRequests={catalog.content.insuranceSettings.maxQuoteRequests}
        initial={{ providers, categories, addOns, sort }}
        attribution={{ source, campaignId, adId }}
        thisYear={thisYear}
        campaign={campaign}
        editForm={<InsuranceSearchForm variant="compact" defaultIntent={search.intent} initial={search} source={source} extraParams={extraParams} />}
      />
      {requestsSection(true)}
    </>
  );
}
