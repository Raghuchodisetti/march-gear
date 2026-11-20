import type { Metadata } from "next";
import { getCatalog } from "@/server/catalog";
import { PageHeader } from "@/components/ui/page-header";
import { MileageCalculator } from "@/components/tools/mileage-calculator";
import { HowItWorks, RelatedTools, ToolDisclaimer, ToolFaqs, ToolMetaRow, ToolTips } from "@/components/tools/tool-sections";

export const metadata: Metadata = {
  title: "Mileage Calculator",
  description:
    "Work out your car's real-world mileage with the tank-to-tank method, see your cost per km and monthly fuel bill, and compare it against the claimed figure.",
};

export default async function MileagePage() {
  const { iceRealWorldFactor } = (await getCatalog()).content.toolRates;
  return (
    <>
      <PageHeader
        eyebrow="Mileage Calculator"
        crumbs={[{ label: "Tools", href: "/tools" }, { label: "Mileage Calculator" }]}
        title={
          <>
            Your real-world mileage, <span className="type-editorial">not the brochure&apos;s</span>
          </>
        }
        description="Use the tank-to-tank method to find the efficiency you actually get, what every kilometre costs, and how you measure up against the claimed figure."
      >
        <ToolMetaRow items={["Tank-to-tank method", "Cost per km", "Versus claimed", "Illustrative estimate"]} />
      </PageHeader>

      <MileageCalculator />

      <ToolTips
        eyebrow="Get more from every litre"
        title={
          <>
            Small habits, <span className="type-editorial">measurable</span> gains
          </>
        }
        tips={[
          {
            title: "Keep tyres at the right pressure",
            body: "Under-inflated tyres add rolling resistance. Check monthly, when cold, against the placard on the driver's door — it's worth up to 3%.",
          },
          {
            title: "Drive with anticipation",
            body: "Read traffic ahead, lift off early and avoid hard braking. Smooth inputs alone can improve city economy by 10–20%.",
          },
          {
            title: "Hold steady highway speeds",
            body: "Aerodynamic drag climbs steeply past 90 km/h. Cruising at 80–90 instead of 110 typically saves 15% or more on long runs.",
          },
          {
            title: "Lose the dead weight and the idling",
            body: "Clear out the boot, remove empty roof racks and switch off when parked for more than a minute. A clean air filter and timely servicing help too.",
          },
        ]}
      />

      <HowItWorks
        intro="The tank-to-tank method is the most reliable way to measure mileage without special equipment — and it removes the guesswork from fuel-gauge readings."
        steps={[
          { title: "Fill to the brim, reset the trip", body: "Fill until the pump clicks off at the same station and nozzle each time, then zero the trip meter." },
          {
            title: "Drive, refill, divide",
            body: "Drive at least 200 km in your normal pattern. Refill to the brim and divide the distance by the litres it took.",
            formula: "kmpl = distance driven ÷ litres refilled",
          },
          {
            title: "Cost per kilometre",
            body: "Divide the fuel price by your kmpl. Multiply by your monthly distance for the monthly bill.",
            formula: "₹/km = fuel price ÷ kmpl  ·  monthly cost = monthly km ÷ kmpl × fuel price",
          },
          {
            title: "Compare with the claim",
            body: `Claimed figures come from a standardised lab cycle. Real-world results usually land between 75% and 95% of them — our other tools assume about ${Math.round(iceRealWorldFactor * 100)}%.`,
            formula: "achieved = your kmpl ÷ claimed kmpl",
          },
        ]}
      />

      <ToolFaqs
        items={[
          {
            q: "Why is my mileage lower than the claimed figure?",
            a: "Claimed (ARAI) figures are measured on a rolling road with a fixed drive cycle, no air-conditioning load and ideal temperatures. Traffic, AC, short trips, load and driving style all reduce real-world numbers.",
          },
          {
            q: "How many fills should I measure?",
            a: "One tank is a useful snapshot; three consecutive tank-to-tank readings, averaged, give a dependable figure that smooths out pump and driving-pattern variations.",
          },
          {
            q: "Can I use the trip computer's average instead?",
            a: "It's a good guide, but most trip computers read optimistic by 3–8%. The tank-to-tank method measures what actually left your wallet.",
          },
          {
            q: "Does AC really affect mileage?",
            a: "Yes — typically 5–10% in city driving, less on the highway. At speeds above 80 km/h, AC is usually more efficient than driving with the windows down.",
          },
        ]}
      />

      <RelatedTools current="mileage-calculator" slugs={["ev-vs-petrol", "ownership-cost", "emi-calculator"]} />
      <ToolDisclaimer>
        Results are only as accurate as your trip reading. Claimed efficiency figures are indicative demo data and may not match the variant you own.
      </ToolDisclaimer>
    </>
  );
}
