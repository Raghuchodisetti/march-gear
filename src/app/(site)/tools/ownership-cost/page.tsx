import type { Metadata } from "next";
import { getCatalog } from "@/server/catalog";
import { calcRates } from "@/components/tools/calc";
import { PageHeader } from "@/components/ui/page-header";
import { OwnershipCost } from "@/components/tools/ownership-cost";
import { HowItWorks, RelatedTools, ToolDisclaimer, ToolFaqs, ToolMetaRow } from "@/components/tools/tool-sections";

export const metadata: Metadata = {
  title: "Car Ownership Cost Calculator",
  description:
    "See the true cost of owning a car in your city over 3, 5 or 7 years — depreciation, fuel, insurance, servicing, taxes and loan interest, per km and per month.",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function OwnershipCostPage() {
  const rates = calcRates((await getCatalog()).content.toolRates);
  const resale = rates.resaleCurve;
  return (
    <>
      <PageHeader
        eyebrow="Ownership Cost"
        crumbs={[{ label: "Tools", href: "/tools" }, { label: "Ownership Cost" }]}
        title={
          <>
            The price tag is <span className="type-editorial">only the start</span>
          </>
        }
        description="Depreciation, fuel, insurance, servicing, taxes and interest — added up for your city and your driving, so you can compare cars on what they really cost."
      >
        <ToolMetaRow items={["City-specific on-road price", "3, 5 or 7 years", "Per km and per month", "Illustrative estimate"]} />
      </PageHeader>

      <OwnershipCost />

      <HowItWorks
        intro="Total cost of ownership is everything you pay out, minus what you get back when you sell. We model each component separately so you can see what drives it."
        steps={[
          {
            title: "On-road price",
            body: "The starting ex-showroom price plus your city's registration, road tax, handling and first-year insurance. EVs attract much lower road tax in most states.",
            formula: "on-road = ex-showroom × city factor",
          },
          {
            title: "Depreciation",
            body: `We apply a typical resale curve — ${pct(resale[1])} of the ex-showroom value after one year, ${pct(resale[3])} after three, ${pct(resale[5])} after five — a little steeper for luxury cars and EVs.`,
            formula: "depreciation = ex-showroom − resale value",
          },
          {
            title: "Fuel or charging",
            body: "Real-world consumption at indicative fuel prices or a home-charging tariff, multiplied by your annual distance.",
            formula: "energy = km per year × ₹ per km",
          },
          {
            title: "Insurance and servicing",
            body: `Insurance renews at about ${pct(rates.insuranceRate)} of the car's current value. Servicing starts from a segment average and rises ${pct(rates.maintenanceGrowth)} a year; EVs need around ${pct(rates.evMaintenanceFactor)} as much.`,
          },
          {
            title: "Interest",
            body: "If you finance, we add the interest from a reducing-balance loan on the on-road price over the ownership period.",
            formula: "total = depreciation + taxes + energy + insurance + servicing + interest",
          },
        ]}
      />

      <ToolFaqs
        items={[
          {
            q: "Why is depreciation usually the biggest cost?",
            a: "A new car loses a fifth or more of its value in the first year and roughly half in five. It's invisible until you sell — which is why two cars at the same price can cost very differently to own.",
          },
          {
            q: "Why do on-road prices differ so much between cities?",
            a: "Road tax is set by each state and ranges widely, often on a slab tied to the car's price and fuel type. Registration, handling charges and insurance premiums also vary.",
          },
          {
            q: "Is it cheaper to buy outright or finance?",
            a: "Paying cash avoids interest entirely, but finance keeps savings invested and liquid. If your investments reliably earn more after tax than the loan rate, financing can make sense; otherwise, a larger down payment wins.",
          },
          {
            q: "What isn't included?",
            a: "Tyres, batteries, accessories, extended warranties, parking, tolls, fines and accident repairs. Budget an extra 5–10% for these over a typical ownership period.",
          },
        ]}
      />

      <RelatedTools current="ownership-cost" slugs={["ev-vs-petrol", "car-valuation", "car-loan"]} />
      <ToolDisclaimer>
        Costs are modelled from the entry variant&apos;s indicative ex-showroom price, a rounded city on-road factor, segment-average servicing and a
        typical resale curve. Actual costs depend on the variant, usage, insurer, service centre and the market when you sell.
      </ToolDisclaimer>
    </>
  );
}
