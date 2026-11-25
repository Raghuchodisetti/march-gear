import type { Metadata } from "next";
import { getCatalog } from "@/server/catalog";
import { calcRates } from "@/components/tools/calc";
import { PageHeader } from "@/components/ui/page-header";
import { EvVsPetrol } from "@/components/tools/ev-vs-petrol";
import { HowItWorks, RelatedTools, ToolDisclaimer, ToolFaqs, ToolMetaRow } from "@/components/tools/tool-sections";
import { pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "EV vs Petrol Cost Calculator: Break-Even Point",
  description: "Compare an electric car with a petrol, diesel or hybrid rival: cumulative running costs year by year, the break-even point, total savings and CO2 avoided.",
  path: "/tools/ev-vs-petrol",
});

export default async function EvVsPetrolPage() {
  const rates = calcRates((await getCatalog()).content.toolRates);
  return (
    <>
      <PageHeader
        eyebrow="EV vs Petrol"
        crumbs={[{ label: "Tools", href: "/tools" }, { label: "EV vs Petrol" }]}
        title={
          <>
            When does electric <span className="type-editorial">pay for itself?</span>
          </>
        }
        description="Electric cars usually cost more to buy and far less to run. Pick an EV and a rival, set your daily driving and energy prices, and find the year the lines cross."
      >
        <ToolMetaRow items={["Break-even point", "Cumulative cost chart", "CO₂ avoided", "Illustrative estimate"]} />
      </PageHeader>

      <EvVsPetrol />

      <HowItWorks
        intro="We compare what each car costs to buy and then to fuel or charge, year by year, using real-world corrections to the brochure figures."
        steps={[
          {
            title: "Real-world EV consumption",
            body: `Claimed ranges are optimistic, so we take the battery size over the claimed range and add ${Math.round((rates.evRealWorldFactor - 1) * 100)}% for highway speeds, AC and charging losses.`,
            formula: `kWh per km = battery kWh ÷ claimed range × ${rates.evRealWorldFactor}`,
          },
          {
            title: "Real-world fuel economy",
            body: `For the combustion car, we assume ${Math.round(rates.iceRealWorldFactor * 100)}% of the claimed kmpl.`,
            formula: `real kmpl = claimed kmpl × ${rates.iceRealWorldFactor}`,
          },
          {
            title: "Cumulative cost",
            body: "Each line starts at the starting ex-showroom price and climbs by a year's running cost. The break-even point is where the EV line drops below.",
            formula: "cost(year) = price + year × daily km × 365 × ₹ per km",
          },
          {
            title: "CO₂ avoided",
            body: "Tailpipe emissions from the fuel burned, minus the emissions from generating the electricity on India's grid.",
            formula: `CO₂ = litres × ${rates.co2PerLitre} kg − kWh × ${rates.co2PerKwh} kg`,
          },
        ]}
      />

      <ToolFaqs
        items={[
          {
            q: "What electricity tariff should I use?",
            a: `Home charging on a residential connection typically costs ₹6–10 per kWh depending on your state and slab — we default to ₹${rates.homeTariff}. Public DC fast charging is usually ₹18–24, so heavy fast-charger use can more than double running costs.`,
          },
          {
            q: "Does this include servicing and insurance?",
            a: "No — this tool isolates purchase price and energy, where the difference is largest. EVs typically also save 30–40% on scheduled servicing. For the full picture, use the ownership cost calculator.",
          },
          {
            q: "Is an EV really cleaner on a coal-heavy grid?",
            a: "In most cases, yes. Even at India's grid average of around 0.8 kg CO₂ per kWh, an efficient EV usually emits less per kilometre than a petrol car — and the gap widens as more renewable power comes online.",
          },
          {
            q: "What about battery replacement?",
            a: "Most EV batteries in India carry an eight-year or 1.6 lakh-kilometre warranty, and real-world degradation has been modest. We don't model a replacement within the ten-year horizon.",
          },
          {
            q: "Why might my break-even be 'beyond' the period?",
            a: "If you drive little, the running-cost saving each year is small relative to the EV's price premium. Increase the daily distance or years and you'll see the lines converge.",
          },
        ]}
      />

      <RelatedTools current="ev-vs-petrol" slugs={["ownership-cost", "mileage-calculator", "emi-calculator"]} />
      <ToolDisclaimer>
        Comparisons use indicative ex-showroom prices and rounded efficiency corrections. They exclude subsidies, road-tax waivers, insurance, servicing
        and resale, which vary by state and model.
      </ToolDisclaimer>
    </>
  );
}
