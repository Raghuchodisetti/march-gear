import type { Metadata } from "next";
import Image from "next/image";
import { IMG } from "@/data/images";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { ValuationTool } from "@/components/valuation/valuation-tool";
import { readCarPrefill } from "@/components/valuation/prefill";
import { pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Car Valuation: What Is My Car Worth?",
  description: "Get an indicative market value for your car in under a minute, with a price range by condition, the factors behind it and a ten-year depreciation curve.",
  path: "/tools/car-valuation",
});

const METHOD = [
  {
    n: "01",
    title: "Age and new price",
    body: "We start from the model's indicative ex-showroom price and apply a depreciation curve calibrated to the brand's resale strength.",
  },
  {
    n: "02",
    title: "How it has been used",
    body: "Kilometres are compared with roughly 11,000 a year. Ownership history, fuel type and gearbox nudge the figure up or down.",
  },
  {
    n: "03",
    title: "Where and in what state",
    body: "City demand and the condition you select set the final band. A physical inspection is what turns it into a firm offer.",
  },
];

export default async function CarValuationPage({ searchParams }: PageProps<"/tools/car-valuation">) {
  // ?brand=&model=&year=&km=&fuel=&gearbox=&city= — e.g. from a car in the customer's garage.
  const prefill = readCarPrefill(await searchParams);
  return (
    <>
      <PageHeader
        eyebrow="Tools · Valuation"
        title={
          <>
            What is your car <span className="type-editorial">really</span> worth?
          </>
        }
        description="An indicative market value in under a minute, a range for every condition, and a clear view of how that value will move over the next decade."
        crumbs={[{ label: "Tools", href: "/tools" }, { label: "Car valuation" }]}
      />

      <section className="container-x py-14 md:py-20" aria-label="Valuation calculator">
        <ValuationTool prefill={prefill} />
      </section>

      <section className="border-t border-line py-14 md:py-20" aria-labelledby="method-title">
        <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal>
              <Eyebrow>Method</Eyebrow>
              <h2 id="method-title" className="type-h2 mt-5 text-balance">
                Three things decide the number.
              </h2>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
                Our model is deliberately transparent. Every factor appears in your result, with the effect it had on the price.
              </p>
            </Reveal>
            <div className="relative mt-10 hidden aspect-[4/3] overflow-hidden bg-mist lg:block">
              <Image
                src={IMG.tacho}
                alt="Close-up of an illuminated rev counter in a car's instrument cluster"
                fill
                sizes="(min-width: 1024px) 38vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
          <ol className="lg:col-span-7 lg:pt-16">
            {METHOD.map((m) => (
              <li key={m.n} className="grid grid-cols-[56px_minmax(0,1fr)] gap-4 border-t border-line py-8 last:border-b md:grid-cols-[96px_minmax(0,1fr)] md:py-10">
                <span className="font-display text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-ink/20 [font-stretch:110%] num">{m.n}</span>
                <div>
                  <h3 className="type-h3">{m.title}</h3>
                  <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">{m.body}</p>
                </div>
              </li>
            ))}
            <li className="flex flex-col gap-4 pt-10 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[14px] text-muted">Ready for a firm price, or browsing for the next one?</p>
              <div className="flex flex-wrap gap-3">
                <Button href="/sell-car" arrow>
                  Sell your car
                </Button>
                <Button href="/used-cars" variant="outline">
                  Browse used cars
                </Button>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}
