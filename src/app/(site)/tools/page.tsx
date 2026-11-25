import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, GitCompareArrows, MapPin } from "lucide-react";
import { tools, type Tool } from "@/data/tools";
import { getCatalog } from "@/server/catalog";
import { IMG } from "@/data/images";
import { calculateEmi } from "@/lib/finance";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { calcRates, evVsIce, formatYears, loanEligibility, ownershipCost, splitPrice } from "@/components/tools/calc";
import { pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Car Calculators: EMI, Loan, Mileage & More",
  description: "Six calculators for Indian car buyers: EMI, loan eligibility, real-world mileage, EV vs petrol break-even, car valuation and the true cost of ownership.",
  path: "/tools",
});

const CATEGORY: Record<string, string> = {
  "emi-calculator": "Finance",
  "car-loan": "Finance",
  "mileage-calculator": "Running costs",
  "ev-vs-petrol": "Electric",
  "car-valuation": "Selling",
  "ownership-cost": "Running costs",
};

const tool = (slug: string) => tools.find((t) => t.slug === slug) ?? tools[0];

/* Worked examples, computed with the same models the tools use. */
const emiSample = calculateEmi(1_200_000 * 0.8, 9.25, 60);

function Meta({ t, tone = "dark" }: { t: Tool; tone?: "dark" | "light" }) {
  const index = tools.indexOf(t) + 1;
  return (
    <p className={cn("flex items-center gap-3 font-mono text-[11.5px]", tone === "dark" ? "text-muted" : "text-white/50")}>
      <span>
        {String(index).padStart(2, "0")} / {String(tools.length).padStart(2, "0")}
      </span>
      <span aria-hidden className={cn("h-px w-5", tone === "dark" ? "bg-line" : "bg-white/20")} />
      <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em]">{CATEGORY[t.slug]}</span>
    </p>
  );
}

function Sample({ label, value, unit, caption, tone = "dark" }: { label: string; value: ReactNode; unit?: string; caption: string; tone?: "dark" | "light" }) {
  const light = tone === "light";
  return (
    <div>
      <p className={cn("type-eyebrow", light ? "text-white/50" : "text-muted")}>{label}</p>
      <p className="num mt-3 flex flex-wrap items-baseline gap-x-2 font-display text-[clamp(2.25rem,1.8rem+1.6vw,3.25rem)] font-semibold leading-none tracking-[-0.04em]">
        {value}
        {unit && <span className={cn("font-sans text-[13px] font-medium tracking-normal", light ? "text-white/55" : "text-muted")}>{unit}</span>}
      </p>
      <p className={cn("mt-2 text-[12.5px]", light ? "text-white/50" : "text-muted")}>{caption}</p>
    </div>
  );
}

function Go({ children = "Open tool", tone = "dark" }: { children?: ReactNode; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13.5px] font-medium", tone === "dark" ? "text-ink" : "text-white")}>
      {children}
      <ArrowRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover/tool:translate-x-0.5" />
    </span>
  );
}

const zoom = "object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/tool:scale-[1.04]";
const cardBase = "group/tool relative flex border border-line bg-white transition-[border-color] duration-[400ms] ease-[var(--ease-premium)] hover:border-ink/30";

export default async function ToolsPage() {
  const { getCar, cars, getCity, onRoadPrice, content } = await getCatalog();
  const rates = calcRates(content.toolRates);
  const car = (slug: string) => getCar(slug) ?? cars[0];
  const loanSample = splitPrice(loanEligibility({ income: 100_000, existingEmis: 0, employment: "salaried", ratePct: 9.25, years: 5, rates }).eligible);
  const evSample = evVsIce({ ev: car("tata-nexon-ev"), ice: car("hyundai-creta"), dailyKm: 40, years: 5, tariff: rates.homeTariff, fuelPrice: rates.fuelPrice.Petrol, rates });
  // Worked in Mumbai, or the default city if Mumbai is removed from site content.
  const sampleCity = getCity("mumbai");
  const ownSample = ownershipCost({
    car: car("hyundai-creta"),
    citySlug: sampleCity.slug,
    kmPerYear: 12_000,
    years: 5,
    finance: { enabled: false, downPct: 20, ratePct: 9.25 },
    rates,
    onRoadPrice,
  });

  const emi = tool("emi-calculator");
  const loan = tool("car-loan");
  const mileage = tool("mileage-calculator");
  const ev = tool("ev-vs-petrol");
  const valuation = tool("car-valuation");
  const own = tool("ownership-cost");

  return (
    <>
      <PageHeader
        image={IMG.tacho}
        imageFocus="50% 45%"
        eyebrow="Tools"
        crumbs={[{ label: "Tools" }]}
        title={
          <>
            Do the maths <span className="type-editorial">before</span> the showroom.
          </>
        }
        description="Six precision calculators for every stage of ownership — from what you can borrow to what the car really costs you each kilometre."
      >
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-white/60">
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-1 rounded-full bg-red" /> Live, as you type
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-1 rounded-full bg-white/40" /> Runs on your device
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-1 rounded-full bg-white/40" /> No sign-up needed
          </li>
        </ul>
      </PageHeader>

      <section aria-label="All tools" className="py-14 md:py-20">
        <div className="container-x">
          {/* 01 — Featured */}
          <Reveal>
            <Link href={emi.href} className={cn(cardBase, "grid grid-cols-1 lg:grid-cols-12")}>
              <div className="relative aspect-[16/10] overflow-hidden bg-mist lg:col-span-7 lg:aspect-auto lg:min-h-[540px]">
                <Image src={emi.image} alt="" fill sizes="(min-width: 1024px) 58vw, 100vw" className={zoom} />
                <Badge tone="glass" className="absolute left-4 top-4">
                  Most used
                </Badge>
              </div>
              <div className="flex flex-col p-6 md:p-10 lg:col-span-5 lg:p-12">
                <Meta t={emi} />
                <h2 className="type-h2 mt-6">{emi.name}</h2>
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
                  {emi.description} Includes quick picks for popular cars and a year-by-year amortisation schedule.
                </p>
                <div className="mt-10 border-t border-line pt-8 lg:mt-auto">
                  <Sample label="Worked example" value={formatINR(emiSample)} unit="/ month" caption="₹12 Lakh car · 20% down · 9.25% · 5 years" />
                  <span className={buttonClasses({ variant: "dark", className: "mt-8 w-full sm:w-auto" })}>
                    Open calculator
                    <ArrowRight aria-hidden className="size-4 transition-transform duration-[250ms] group-hover/tool:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          </Reveal>

          {/* 02 + 04 */}
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
            <Reveal className="lg:col-span-5">
              <Link href={loan.href} className={cn(cardBase, "h-full min-h-[400px] flex-col p-6 md:p-10")}>
                <div className="flex items-start justify-between gap-6">
                  <Meta t={loan} />
                  <loan.icon aria-hidden className="size-5 text-ink" strokeWidth={1.6} />
                </div>
                <h2 className="type-h3 mt-8">{loan.name}</h2>
                <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted">{loan.description}</p>
                <div className="mt-auto pt-10">
                  <Sample label="Worked example" value={loanSample[0]} unit={loanSample[1]} caption="Eligible loan on ₹1 Lakh monthly take-home, salaried" />
                  <div className="mt-8">
                    <Go />
                  </div>
                </div>
              </Link>
            </Reveal>

            <Reveal className="lg:col-span-7" delay={0.08}>
              <Link href={ev.href} className={cn(cardBase, "grid h-full grid-cols-1 border-ink bg-ink text-white hover:border-ink md:grid-cols-2")}>
                <div className="flex flex-col p-6 md:p-10">
                  <Meta t={ev} tone="light" />
                  <h2 className="type-h3 mt-8">{ev.name}</h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-white/60">{ev.description}</p>
                  <div className="mt-auto pt-10">
                    <Sample
                      tone="light"
                      label="Worked example"
                      value={evSample.status === "breakeven" || evSample.status === "ev-always" ? formatYears(evSample.breakEven ?? 0) : "5+ yrs"}
                      unit="to break even"
                      caption="Nexon EV vs Creta petrol · 40 km a day"
                    />
                    <div className="mt-8">
                      <Go tone="light" />
                    </div>
                  </div>
                </div>
                <div className="relative min-h-[240px] overflow-hidden bg-ink-2 md:min-h-0">
                  <Image src={ev.image} alt="" fill sizes="(min-width: 1024px) 30vw, (min-width: 768px) 50vw, 100vw" className={cn(zoom, "opacity-85")} />
                </div>
              </Link>
            </Reveal>
          </div>

          {/* 06 + 03 + 05 */}
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
            <Reveal className="lg:col-span-7">
              <Link href={own.href} className={cn(cardBase, "h-full flex-col")}>
                <div className="relative aspect-[21/9] overflow-hidden bg-mist">
                  <Image src={own.image} alt="" fill sizes="(min-width: 1024px) 58vw, 100vw" className={zoom} />
                </div>
                <div className="grid flex-1 grid-cols-1 gap-8 p-6 md:grid-cols-[1.2fr_1fr] md:p-10">
                  <div>
                    <Meta t={own} />
                    <h2 className="type-h3 mt-6">{own.name}</h2>
                    <p className="mt-3 text-[15px] leading-relaxed text-muted">{own.description}</p>
                    <div className="mt-8">
                      <Go />
                    </div>
                  </div>
                  <div className="md:border-l md:border-line md:pl-8">
                    <Sample label="Worked example" value={`₹${ownSample.perKm.toFixed(1)}`} unit="per km" caption={`Hyundai Creta in ${sampleCity.name} · 12,000 km a year · 5 years`} />
                  </div>
                </div>
              </Link>
            </Reveal>

            <div className="flex flex-col gap-5 lg:col-span-5">
              {[
                { t: mileage, sample: "17.2 kmpl", caption: "412 km on a 24-litre fill" },
                { t: valuation, sample: "Under a minute", caption: "Make, model, year, kilometres — done" },
              ].map(({ t, sample, caption }, i) => (
                <Reveal key={t.slug} delay={0.06 * (i + 1)} className="flex-1">
                  <Link href={t.href} className={cn(cardBase, "grid h-full grid-cols-[112px_1fr] sm:grid-cols-[180px_1fr]")}>
                    <div className="relative min-h-[180px] overflow-hidden bg-mist">
                      <Image src={t.image} alt="" fill sizes="180px" className={zoom} />
                    </div>
                    <div className="flex min-w-0 flex-col p-5 md:p-7">
                      <Meta t={t} />
                      <h2 className="type-h4 mt-5">{t.name}</h2>
                      <p className="mt-2 text-[14px] leading-relaxed text-muted">{t.short}</p>
                      <div className="mt-auto pt-5">
                        <p className="text-[15px] font-semibold num">{sample}</p>
                        <p className="mt-0.5 text-[12px] text-muted">{caption}</p>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="shortcuts-heading" className="bg-ink py-20 text-white md:py-28">
        <div className="container-x">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <Eyebrow tone="light">Shortcuts</Eyebrow>
              <h2 id="shortcuts-heading" className="type-h2 mt-5 text-balance">
                When the numbers point to a <span className="type-editorial">shortlist</span>
              </h2>
            </div>
            <p className="max-w-md text-[15px] leading-relaxed text-white/60 lg:col-span-5 lg:col-start-8 lg:self-end">
              Take what the calculators told you and put it to work — line the finalists up spec for spec, then find someone who can hand you the keys.
            </p>
          </div>

          <ul className="mt-14 grid grid-cols-1 border-y border-white/15 md:grid-cols-2 md:divide-x md:divide-white/15">
            {[
              { href: "/compare", icon: GitCompareArrows, title: "Compare cars side by side", body: "Up to four models — price, specs, safety and features in one sheet." },
              { href: "/dealers", icon: MapPin, title: "Find a dealer near you", body: "Authorised showrooms and certified pre-owned partners across 16 cities." },
            ].map((s) => (
              <li key={s.href} className="border-b border-white/15 last:border-b-0 md:border-b-0 md:px-10 md:first:pl-0 md:last:pr-0">
                <Link href={s.href} className="group/sc flex h-full flex-col gap-6 py-10">
                  <s.icon aria-hidden className="size-6 text-white/80" strokeWidth={1.5} />
                  <span className="flex items-center justify-between gap-6">
                    <span className="type-h3">{s.title}</span>
                    <ArrowUpRight
                      aria-hidden
                      className="size-5 shrink-0 text-red transition-transform duration-[250ms] group-hover/sc:-translate-y-0.5 group-hover/sc:translate-x-0.5"
                    />
                  </span>
                  <span className="max-w-md text-[15px] leading-relaxed text-white/55">{s.body}</span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-10 text-[12px] text-white/50">
            All results are illustrative estimates from indicative demo data and simplified assumptions — not quotes, offers of credit or financial advice.
          </p>
        </div>
      </section>
    </>
  );
}
