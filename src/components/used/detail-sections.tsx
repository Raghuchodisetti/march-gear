import Link from "next/link";
import { ArrowUpRight, Calendar, CalendarCheck, Car, Cog, FileText, Fuel, Gauge, Palette, ShieldCheck, Users } from "lucide-react";
import type { UsedCar } from "@/types";
import { getCatalog } from "@/server/catalog";
import { formatDate, formatKm, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge, DemoNote } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spec } from "@/components/ui/page-header";
import { ScoreBar } from "@/components/ui/rating";
import { Eyebrow } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { VALUATION_YEAR } from "@/components/valuation/valuation";
import { deriveInspection, fairPriceBand } from "./inspection";
import { EnquiryButton } from "./enquiry-button";

const ownersLabel = (n: number) => (n === 1 ? "1st owner" : n === 2 ? "2nd owner" : `${n} owners`);

/* ── Key facts ────────────────────────────────────────────────── */

export function KeyFacts({ car }: { car: UsedCar }) {
  const facts = [
    { icon: <Calendar />, label: "Model year", value: car.year },
    { icon: <Gauge />, label: "Kilometres", value: formatKm(car.km) },
    { icon: <Fuel />, label: "Fuel", value: car.fuel },
    { icon: <Cog />, label: "Transmission", value: car.transmission },
    { icon: <Users />, label: "Ownership", value: ownersLabel(car.owners) },
    { icon: <FileText />, label: "Registration", value: `${car.registration} RTO` },
    { icon: <ShieldCheck />, label: "Insurance", value: car.insurance },
    { icon: <Palette />, label: "Colour", value: car.color },
    { icon: <Car />, label: "Body type", value: car.bodyType },
    { icon: <CalendarCheck />, label: "Listed on", value: formatDate(car.postedOn) },
  ];
  return (
    <section aria-labelledby="facts-title">
      <h2 id="facts-title" className="type-h3">
        Key facts
      </h2>
      <dl className="mt-7 grid grid-cols-2 border-l border-t border-line md:grid-cols-5">
        {facts.map((f) => (
          <div key={f.label} className="border-b border-r border-line p-4 md:p-5">
            <Spec icon={f.icon} label={f.label} value={f.value} className="flex-col gap-2.5 [&_p:last-child]:text-[14px] [&_p:last-child]:leading-snug" />
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ── Highlights ───────────────────────────────────────────────── */

export function Highlights({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="highlights-title" className="grid grid-cols-1 gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10">
      <h2 id="highlights-title" className="type-h3">
        Why this <span className="type-editorial">one</span>
      </h2>
      <ol className="border-t border-ink">
        {items.map((h, i) => (
          <li key={h} className="flex items-baseline gap-6 border-b border-line py-5">
            <span className="font-mono text-[12px] text-red num">{String(i + 1).padStart(2, "0")}</span>
            <p className="type-h4">{h}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ── Inspection report ────────────────────────────────────────── */

export function InspectionReportPanel({ car, title }: { car: UsedCar; title: string }) {
  const report = deriveInspection(car);
  return (
    <section aria-labelledby="inspection-title" className="bg-ink p-6 text-white md:p-10">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,230px)_minmax(0,1fr)] md:gap-12">
        <div>
          <Eyebrow tone="light">{car.verified ? "Inspection report" : "Condition summary"}</Eyebrow>
          <h2 id="inspection-title" className="sr-only">
            Inspection report
          </h2>
          <p className="mt-7 flex items-baseline gap-1 font-display font-semibold leading-none tracking-[-0.04em] [font-stretch:110%]">
            <span className="text-[5.25rem] num">{report.overall.toFixed(1)}</span>
            <span className="text-[1.375rem] text-white/40">/10</span>
          </p>
          <p className="type-h4 mt-4">{report.grade}</p>
          <p className="mt-1 text-[13px] text-white/55 num">
            {report.checksPassed} of {report.checksTotal} checks passed
          </p>
          <div className="mt-6 h-[3px] w-full bg-white/15" aria-hidden>
            <div className="h-full bg-red" style={{ width: `${(report.checksPassed / report.checksTotal) * 100}%` }} />
          </div>
          {car.verified ? (
            <p className="mt-6 text-[12.5px] leading-relaxed text-white/50">
              Inspected by a March Gear engineer before listing on {formatDate(car.postedOn)}. Full report shared at your test drive.
            </p>
          ) : (
            <div className="mt-6">
              <p className="text-[12.5px] leading-relaxed text-white/55">
                Seller-declared condition from a basic 50-point check. We recommend a full 200-point inspection before you buy.
              </p>
              <EnquiryButton kind="inspection" subject={title} detail={car.city} usedCarId={car.id} variant="outline-light" size="sm" className="mt-4">
                Book an inspection
              </EnquiryButton>
            </div>
          )}
        </div>
        <ul className="grid grid-cols-1 gap-x-10 gap-y-7 self-start sm:grid-cols-2">
          {report.categories.map((c) => (
            <li key={c.label}>
              <ScoreBar label={c.label} value={c.score} tone="light" />
              <p className="mt-2 text-[12.5px] leading-snug text-white/50">{c.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── Price analysis ───────────────────────────────────────────── */

export async function PriceAnalysis({ car }: { car: UsedCar }) {
  const { getCar, brandName } = await getCatalog();
  const band = fairPriceBand(car);
  const span = band.high - band.low;
  const min = band.low - span * 0.6;
  const max = band.high + span * 0.6;
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
  const at = (v: number) => `${pct(v)}%`;
  const pricePct = pct(car.price);
  const age = Math.max(1, VALUATION_YEAR - car.year);
  const newModel = car.modelSlug ? getCar(car.modelSlug) : undefined;

  const cells = car.newPrice
    ? [
        { label: "Original ex-showroom", value: formatPrice(car.newPrice), note: "When new · indicative" },
        { label: "You save vs new", value: formatPrice(car.newPrice - car.price), note: `${car.year} model, ${formatKm(car.km)}` },
        {
          label: "Depreciation",
          value: `${Math.round((1 - car.price / car.newPrice) * 100)}%`,
          note: `Over ${age} ${age === 1 ? "year" : "years"} · ${Math.round((1 - car.price / car.newPrice) * 100 / age)}% a year`,
        },
      ]
    : [];

  return (
    <section aria-labelledby="price-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="price-title" className="type-h3">
          Price analysis
        </h2>
        <Badge tone={band.verdict === "Great price" ? "ink" : "outline"}>{band.verdict}</Badge>
      </div>

      {cells.length > 0 && (
        <dl className="mt-7 grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-3">
          {cells.map((c) => (
            <div key={c.label} className="bg-white p-5 md:p-6">
              <dt className="text-[12.5px] text-muted">{c.label}</dt>
              <dd className="mt-2 text-[1.625rem] font-semibold leading-none tracking-[-0.02em] num">{c.value}</dd>
              <dd className="mt-2 text-[12px] text-muted">{c.note}</dd>
            </div>
          ))}
        </dl>
      )}

      <Reveal className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="text-[14px] font-medium text-ink">Market range for similar cars</p>
          <p className="text-[13px] text-muted num">
            Fair: {formatPrice(band.low)} – {formatPrice(band.high)}
          </p>
        </div>
        <div className="relative mt-12 h-10" role="img" aria-label={`Asking price ${formatPrice(car.price)} against a fair range of ${formatPrice(band.low)} to ${formatPrice(band.high)}: ${band.verdict}`}>
          <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-line" />
          <div
            className="absolute top-1/2 h-[3px] -translate-y-1/2 bg-ink"
            style={{ left: at(band.low), width: `calc(${at(band.high)} - ${at(band.low)})` }}
          />
          {[band.low, band.high].map((v) => (
            <span key={v} className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-ink" style={{ left: at(v) }} />
          ))}
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: at(car.price) }}>
            {/* Near either end, anchor the label to the marker's inner side so it never leaves the screen. */}
            <span
              className={cn(
                "absolute bottom-full mb-3 whitespace-nowrap bg-ink px-2 py-1 text-[11.5px] font-medium text-white num",
                pricePct < 25 ? "-left-2" : pricePct > 75 ? "-right-2" : "left-1/2 -translate-x-1/2",
              )}
            >
              This car · {formatPrice(car.price)}
            </span>
            <span className="block size-3.5 rounded-full border-2 border-white bg-red shadow-soft" />
          </div>
        </div>
        <div className="mt-1 grid grid-cols-3 text-[11.5px] text-muted">
          <span>Below market</span>
          <span className="text-center text-ink">Fair</span>
          <span className="text-right">Above market</span>
        </div>
        <DemoNote className="mt-4 block">Indicative band from recent listings of similar age and kilometres. Demo data.</DemoNote>
      </Reveal>

      {newModel && (
        <div className="mt-10 flex flex-col gap-5 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="type-eyebrow text-muted">Thinking new instead?</p>
            <p className="mt-2 text-[15px] text-ink">
              The {brandName(newModel.brand)} {newModel.name} starts at{" "}
              <span className="font-semibold num">{formatPrice(newModel.priceMin)}</span> ex-showroom.
            </p>
          </div>
          <Button href={`/cars/${newModel.slug}`} variant="outline" arrow className="self-start sm:self-auto">
            See the new {newModel.name}
          </Button>
        </div>
      )}
    </section>
  );
}

/* ── Assurance list for the purchase panel ────────────────────── */

export function AssuranceList({ verified, className }: { verified: boolean; className?: string }) {
  const items = verified
    ? ["200-point inspection passed", "7-day no-questions return", "1-year engine & gearbox warranty"]
    : ["Seller-declared condition", "Free inspection on request", "RC & loan checks before you pay"];
  return (
    <ul className={cn("space-y-2.5 text-[13px] text-ink/80", className)}>
      {items.map((t) => (
        <li key={t} className="flex items-center gap-2.5">
          <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", verified ? "bg-red" : "bg-ink/30")} />
          {t}
        </li>
      ))}
    </ul>
  );
}

export function EmiLink({ className }: { className?: string }) {
  return (
    <Link href="/tools/emi-calculator" className={cn("group/emi inline-flex items-center gap-1 text-[13px] font-medium text-ink", className)}>
      Customise
      <ArrowUpRight aria-hidden className="size-3.5 text-red transition-transform duration-[250ms] group-hover/emi:-translate-y-0.5 group-hover/emi:translate-x-0.5" />
    </Link>
  );
}
