import type { Metadata } from "next";
import { connection } from "next/server";
import { getCatalog } from "@/server/catalog";
import { getActiveCampaigns, getPublicCategoryCounts, getPublicProviders } from "@/server/insurance/public";
import { getAddOnOffers } from "@/server/insurance/public-content";
import { AdSlot } from "@/components/ads/ad-slot";
import { InsuranceHomeHero } from "@/components/insurance/public/home-hero";
import { CampaignStrip } from "@/components/insurance/public/campaigns";
import {
  AddOnsSection,
  BuyRenewSection,
  ClaimsSection,
  CompareSection,
  CoverTypesSection,
  ProvidersSection,
  StagesSection,
} from "@/components/insurance/public/home-sections";
import { FaqSection, GuidesSection } from "@/components/insurance/public/guides";

export const metadata: Metadata = {
  title: "Car insurance — compare plans, buy or renew",
  description:
    "Compare car insurance plans from listed insurers and registered intermediaries: cover, add-ons, IDV and indicative premiums. Buy a new policy or renew yours, then request quotations from the providers you choose.",
  alternates: { canonical: "/insurance" },
};

export default async function InsurancePage() {
  // Providers, campaigns and plan counts change as staff approve them — render per request.
  await connection();
  const [{ content }, providers, campaigns, counts, offers] = await Promise.all([
    getCatalog(),
    getPublicProviders(),
    getActiveCampaigns(),
    getPublicCategoryCounts(),
    getAddOnOffers(),
  ]);
  const page = content.insurancePage;
  const plans = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <>
      {/* 1–2 · Hero with the search form (buy new / renew) */}
      <InsuranceHomeHero copy={page.hero} stats={{ providers: providers.length, plans }} />
      <AdSlot placement="insurance_home_banner" />
      <CampaignStrip campaigns={campaigns} />

      {/* 3–4 */}
      <BuyRenewSection buy={page.buy} renew={page.renew} />
      {/* 5 */}
      <CompareSection intro={page.compare} />
      {/* 6 */}
      <ProvidersSection intro={page.providers} providers={providers} />
      {/* 7–9 */}
      <CoverTypesSection intro={page.coverTypes} />
      {/* 10–12 */}
      <StagesSection intro={page.stages} />
      {/* 13 */}
      <AddOnsSection intro={page.addOns} offers={offers} />
      {/* 14 */}
      <ClaimsSection intro={page.claims} />
      {/* 15 */}
      <GuidesSection intro={page.guides} guides={content.insuranceGuides.guides} />
      {/* 16 */}
      <FaqSection title={page.faqTitle} faqs={page.faqs} />
      {/* 17 · the compliance band (layout) and the site footer follow */}
    </>
  );
}
