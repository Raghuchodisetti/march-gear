import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, Check, Minus, PhoneCall, Siren } from "lucide-react";
import type { InsProductCategory } from "@/db/enums";
import { INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { STANDARD_ADDONS } from "@/insurance/covers";
import { IMG } from "@/data/images";
import { cn } from "@/lib/utils";
import type { PublicProvider } from "@/server/insurance/public";
import { Button } from "@/components/ui/button";
import { Eyebrow, SectionHeading, TextLink } from "@/components/ui/section-heading";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { ProviderMark } from "./provider-mark";

/* ──────────────────────────────────────────────────────────────
   Sections of the /insurance homepage, top to bottom. Each one
   has its own layout on purpose — no two read as the same grid.
   ────────────────────────────────────────────────────────────── */

export interface Intro {
  eyebrow: string;
  title: string;
  text: string;
}
interface Step {
  title: string;
  text: string;
}

const NCB_LADDER = [
  { years: "1 yr", pct: 20 },
  { years: "2 yrs", pct: 25 },
  { years: "3 yrs", pct: 35 },
  { years: "4 yrs", pct: 45 },
  { years: "5+ yrs", pct: 50 },
];

/* 3 + 4 · Buy and renew, side by side ─────────────────────── */

export function BuyRenewSection({ buy, renew }: { buy: Intro & { steps: Step[] }; renew: Intro & { steps: Step[] } }) {
  return (
    <section aria-label="Buy or renew car insurance" className="py-14 md:py-20">
      <div className="container-x">
        <div className="grid grid-cols-1 gap-px border border-line bg-line lg:grid-cols-2">
          {/* Buy */}
          <article id="buy" className="flex scroll-mt-36 flex-col bg-white p-6 sm:p-10 xl:p-12">
            <Eyebrow>{buy.eyebrow}</Eyebrow>
            <h2 className="type-h2 mt-5 max-w-xl text-balance">{buy.title}</h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">{buy.text}</p>
            <ol className="mt-10 space-y-0 border-t border-line">
              {buy.steps.map((s, i) => (
                <li key={i} className="grid grid-cols-[3rem_1fr] gap-4 border-b border-line py-5">
                  <span className="font-display text-[28px] font-semibold leading-none tracking-[-0.04em] text-red num">{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    <span className="block text-[15.5px] font-semibold">{s.title}</span>
                    <span className="mt-1 block text-[14px] leading-relaxed text-muted">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-4 pt-10">
              <Button href="/insurance/new-car#quote" variant="dark" size="lg" arrow>
                Insure a new car
              </Button>
              <TextLink href="/insurance#quote">Or start from the form above</TextLink>
            </div>
          </article>

          {/* Renew */}
          <article id="renew" className="relative isolate flex scroll-mt-36 flex-col overflow-hidden bg-ink p-6 text-white sm:p-10 xl:p-12">
            <Image src={IMG.porscheSunset} alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="-z-20 object-cover opacity-25" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-ink via-ink/90 to-ink/70" />
            <Eyebrow tone="light">{renew.eyebrow}</Eyebrow>
            <h2 className="type-h2 mt-5 max-w-xl text-balance">{renew.title}</h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">{renew.text}</p>

            {/* NCB ladder */}
            <figure className="mt-10" aria-label="No-claim bonus by consecutive claim-free years">
              <div className="flex h-36 items-end gap-2 sm:gap-3">
                {NCB_LADDER.map((r, i) => (
                  <div key={r.years} className="flex flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-[13px] font-semibold num">{r.pct}%</span>
                    <span className={cn("w-full", i === NCB_LADDER.length - 1 ? "bg-red" : "bg-white/20")} style={{ height: `${(r.pct / 50) * 100}px` }} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2 border-t border-white/15 pt-2 sm:gap-3">
                {NCB_LADDER.map((r) => (
                  <span key={r.years} className="flex-1 text-center text-[11.5px] text-white/50">
                    {r.years}
                  </span>
                ))}
              </div>
              <figcaption className="mt-3 text-[12px] text-white/45">Typical no-claim bonus on the own-damage premium, by consecutive claim-free years.</figcaption>
            </figure>

            <ul className="mt-8 space-y-3">
              {renew.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[14px] leading-relaxed">
                  <Check aria-hidden className="mt-1 size-4 shrink-0 text-red" />
                  <span>
                    <span className="font-semibold">{s.title}.</span> <span className="text-white/65">{s.text}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-4 pt-10">
              <Button href="/insurance/renewal#quote" variant="light" size="lg" arrow>
                Renew my policy
              </Button>
              <TextLink href="/insurance/guides/how-ncb-works" tone="light">
                How NCB works
              </TextLink>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

/* 5 · Compare — the anatomy of a plan ───────────────────────── */

const COMPARE_ROWS = [
  { label: "Indicative premium", text: "Our estimate from the provider's rates — always labelled, never a quote." },
  { label: "IDV", text: "What you'd receive on theft or total loss. A low IDV makes a cheap premium." },
  { label: "Own-damage cover", text: "Accident, fire, theft, flood and other damage to your own car." },
  { label: "Third-party cover", text: "Your legal liability to others, including the property-damage limit." },
  { label: "Deductibles", text: "The compulsory amount you pay on every claim, plus any voluntary one." },
  { label: "Add-on covers", text: "Which add-ons are included, which are optional, and their age limits." },
  { label: "Cashless garages", text: "The provider's network — what matters is the garages near you." },
  { label: "Policy term", text: "Years of own-damage and third-party cover, e.g. 1 + 3 for new cars." },
  { label: "Exclusions", text: "What the plan won't pay for, in the provider's own words." },
  { label: "Documents", text: "Brochure and policy wording, where the provider has published them." },
];

export function CompareSection({ intro }: { intro: Intro }) {
  return (
    <section aria-labelledby="ins-compare-title" className="bg-mist py-14 md:py-20">
      <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <Eyebrow>{intro.eyebrow}</Eyebrow>
          <h2 id="ins-compare-title" className="type-h2 mt-5 text-balance">
            {intro.title}
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">{intro.text}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/insurance/compare" size="lg" arrow>
              Compare plans
            </Button>
            <Button href="/insurance/types" variant="outline" size="lg">
              Policy types explained
            </Button>
          </div>
          <div className="relative mt-12 hidden aspect-[4/3] overflow-hidden bg-ink lg:block">
            <Image src={IMG.lotRow} alt="" fill sizes="(min-width: 1024px) 40vw, 0px" className="object-cover" />
          </div>
        </div>
        <Reveal className="lg:col-span-7">
          <div className="border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-7">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">What a fair comparison lines up</p>
              <p className="text-[12px] text-muted num">10 rows</p>
            </div>
            <dl>
              {COMPARE_ROWS.map((r, i) => (
                <div key={r.label} className={cn("grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-[13rem_1fr] sm:gap-6 sm:px-7", i > 0 && "border-t border-line")}>
                  <dt className="flex items-center gap-3 text-[14.5px] font-semibold">
                    <span className="w-5 text-[11px] font-medium text-muted num">{String(i + 1).padStart(2, "0")}</span>
                    {r.label}
                  </dt>
                  <dd className="pl-8 text-[14px] leading-relaxed text-muted sm:pl-0">
                    {i === 0 && <span className="mr-2 rounded-[2px] bg-red-50 px-1.5 py-0.5 align-[1px] text-[10px] font-semibold uppercase tracking-[0.1em] text-red-600">Indicative</span>}
                    {r.text}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* 6 · Popular providers ────────────────────────────────────── */

export function ProvidersSection({ intro, providers }: { intro: Intro; providers: PublicProvider[] }) {
  const shown = providers.slice(0, 8);
  return (
    <section aria-labelledby="ins-providers-title" className="py-14 md:py-20">
      <div className="container-x">
        <SectionHeading
          eyebrow={intro.eyebrow}
          title={<span id="ins-providers-title">{intro.title}</span>}
          description={intro.text}
          action={providers.length ? { label: "All providers", href: "/insurance/providers" } : undefined}
        />
        {shown.length ? (
          <RevealGroup className="no-scrollbar -mx-5 mt-12 flex snap-x snap-mandatory scroll-px-5 overflow-x-auto px-5 pt-px sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pl-px sm:pr-0 lg:grid-cols-4">
            {shown.map((p) => (
              <RevealItem key={p.id} className="-ml-px w-[78%] shrink-0 snap-start border border-line bg-white first:ml-0 sm:-mt-px sm:w-auto sm:first:-ml-px">
                <Link href={`/insurance/providers/${p.slug}`} className="group flex h-full flex-col p-6 transition-colors duration-[250ms] hover:bg-mist/60">
                  <ProviderMark name={p.shortName || p.name} logo={p.logo} className="size-14" />
                  <h3 className="type-h4 mt-5">{p.name}</h3>
                  <p className="mt-1 text-[13px] text-muted num">
                    {p.productCount} {p.productCount === 1 ? "plan" : "plans"}
                    {p.garageCount ? ` · ${p.garageCount.toLocaleString("en-IN")} cashless garages` : ""}
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {p.categories.slice(0, 3).map((c: InsProductCategory) => (
                      <li key={c} className="rounded-[2px] bg-mist px-2 py-1 text-[11.5px] text-ink/80">
                        {INS_PRODUCT_CATEGORY_LABEL[c]}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-auto inline-flex items-center gap-1 pt-6 text-[13px] font-medium">
                    View provider
                    <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </RevealItem>
            ))}
            {shown.length < 8 && (
              <RevealItem className="-ml-px w-[78%] shrink-0 snap-start border border-line bg-mist sm:-mt-px sm:w-auto">
                <Link href="/insurance-vendor" className="group flex h-full min-h-56 flex-col p-6">
                  <span className="inline-flex size-14 items-center justify-center border border-dashed border-ink/20">
                    <Building2 aria-hidden className="size-5 text-muted" />
                  </span>
                  <h3 className="type-h4 mt-5">Insurer or intermediary?</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">Apply to list your approved products and receive quote requests from car owners.</p>
                  <span className="mt-auto inline-flex items-center gap-1 pt-6 text-[13px] font-medium">
                    List your products
                    <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </RevealItem>
            )}
          </RevealGroup>
        ) : (
          <ProvidersEmpty />
        )}
      </div>
    </section>
  );
}

/** Shown until the first insurer's products are approved and published. */
export function ProvidersEmpty({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("grid grid-cols-1 border border-line lg:grid-cols-12", compact ? "mt-8" : "mt-12")}>
      <div className="p-6 sm:p-10 lg:col-span-7">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
          <Building2 aria-hidden className="size-5" />
        </span>
        <h3 className="type-h3 mt-6">Insurers are being onboarded</h3>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted">
          We review every insurer and registered intermediary before their products go live. Approved providers will appear here — in the meantime, our guides explain what to look for, and you can still describe your car to see how comparison works.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/insurance/guides" variant="outline">
            Read the guides
          </Button>
          <Button href="/insurance-vendor" variant="ghost" arrow>
            Are you an insurer? List your products
          </Button>
        </div>
      </div>
      <div aria-hidden className="grid grid-cols-3 gap-px border-t border-line bg-line lg:col-span-5 lg:border-l lg:border-t-0">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex aspect-square items-center justify-center bg-white">
            <span className={cn("size-10 rounded-full border border-dashed border-line", i === 1 && "border-red/40")} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* 7–9 · Comprehensive, third-party, own-damage ─────────────── */

const COVER_TYPES: {
  id: string;
  name: string;
  tag: string;
  text: string;
  rows: [string, boolean | string][];
  suits: string;
  href: string;
}[] = [
  {
    id: "comprehensive",
    name: "Comprehensive",
    tag: "Most chosen",
    text: "Own damage and third-party liability in one policy, with owner-driver accident cover and room for add-ons.",
    rows: [
      ["Damage to your car", true],
      ["Liability to others", true],
      ["Owner-driver PA cover", true],
      ["Add-on covers", true],
    ],
    suits: "Almost every car worth repairing.",
    href: "/insurance/types#comprehensive",
  },
  {
    id: "third-party",
    name: "Third-party",
    tag: "Legal minimum",
    text: "Pays for injury, death or property damage you cause to others. Nothing towards your own car.",
    rows: [
      ["Damage to your car", false],
      ["Liability to others", true],
      ["Owner-driver PA cover", true],
      ["Add-on covers", false],
    ],
    suits: "Older, low-value cars you'd repair yourself.",
    href: "/insurance/types#third-party",
  },
  {
    id: "own-damage",
    name: "Standalone own-damage",
    tag: "Needs valid TP",
    text: "Covers only your car, for cars that already have a separate third-party policy — like years 2–3 of a new car.",
    rows: [
      ["Damage to your car", true],
      ["Liability to others", "Separate policy"],
      ["Owner-driver PA cover", "With the TP policy"],
      ["Add-on covers", true],
    ],
    suits: "New cars after year one of a bundled policy.",
    href: "/insurance/types#own-damage",
  },
];

export function CoverTypesSection({ intro }: { intro: Intro }) {
  return (
    <section aria-labelledby="ins-types-title" className="border-t border-line py-14 md:py-20">
      <div className="container-x">
        <SectionHeading eyebrow={intro.eyebrow} title={<span id="ins-types-title">{intro.title}</span>} description={intro.text} action={{ label: "All 8 policy types", href: "/insurance/types" }} />
        <div className="mt-12 grid grid-cols-1 border-y border-ink md:grid-cols-3">
          {COVER_TYPES.map((t, i) => (
            <article key={t.id} id={t.id} className={cn("flex scroll-mt-36 flex-col py-8 md:px-8 md:py-10", i > 0 && "border-t border-line md:border-l md:border-t-0", i === 0 && "md:pl-0", i === 2 && "md:pr-0")}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-display text-[44px] font-semibold leading-none tracking-[-0.05em] text-ink/15 num">{String(i + 1).padStart(2, "0")}</span>
                <span className={cn("rounded-[2px] px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em]", i === 0 ? "bg-ink text-white" : "bg-mist text-ink")}>{t.tag}</span>
              </div>
              <h3 className="type-h3 mt-6">{t.name}</h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{t.text}</p>
              <ul className="mt-6 divide-y divide-line border-y border-line">
                {t.rows.map(([label, v]) => (
                  <li key={label} className="flex items-center justify-between gap-4 py-2.5 text-[13.5px]">
                    <span>{label}</span>
                    {v === true ? (
                      <Check aria-label="Included" className="size-4 text-red" strokeWidth={2.5} />
                    ) : v === false ? (
                      <Minus aria-label="Not included" className="size-4 text-muted" />
                    ) : (
                      <span className="text-[12.5px] text-muted">{v}</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[13.5px]">
                <span className="text-muted">Suits: </span>
                {t.suits}
              </p>
              <Link href={t.href} className="group mt-auto inline-flex items-center gap-1.5 pt-6 text-[13.5px] font-medium">
                How {t.name.toLowerCase()} cover works
                <ArrowRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover:translate-x-0.5" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* 10–12 · New car, used car, EV ─────────────────────────────── */

const STAGES = [
  {
    id: "new-car",
    name: "New car",
    fact: "1-year own damage + 3-year third party",
    text: "Bundled cover from day one, the add-ons that matter most early, and how to compare against the dealer's offer.",
    image: IMG.showroomGallery,
    href: "/insurance/new-car",
  },
  {
    id: "used-car",
    name: "Used car",
    fact: "Transfer the policy to your name",
    text: "Moving the policy across, why the seller's no-claim bonus doesn't come with the car, and inspections for lapsed cover.",
    image: IMG.classicPorsches,
    href: "/insurance/used-car",
  },
  {
    id: "ev",
    name: "Electric car",
    fact: "Third party priced by motor kW",
    text: "The battery's share of the value, water-ingress and short-circuit cover, charging equipment and EV-capable garages.",
    image: IMG.chargeStation,
    href: "/insurance/ev",
  },
];

export function StagesSection({ intro }: { intro: Intro }) {
  return (
    <section aria-labelledby="ins-stages-title" className="bg-ink py-14 text-white md:py-20">
      <div className="container-x">
        <SectionHeading tone="light" eyebrow={intro.eyebrow} title={<span id="ins-stages-title">{intro.title}</span>} description={intro.text} />
        <RevealGroup className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3" gap={0.1}>
          {STAGES.map((s, i) => (
            <RevealItem key={s.id}>
              <Link href={s.href} id={s.id} className="group relative isolate flex aspect-[4/5] scroll-mt-36 flex-col justify-end overflow-hidden bg-ink-2 p-6 sm:aspect-[16/11] md:aspect-[3/4] lg:p-8">
                <Image src={s.image} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="-z-20 object-cover transition-transform duration-[900ms] ease-[var(--ease-premium)] group-hover:scale-[1.05]" />
                <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/60 to-ink/10" />
                <span className="absolute left-6 top-6 font-display text-[13px] font-semibold text-white/60 num lg:left-8 lg:top-8">{String(i + 1).padStart(2, "0")}</span>
                <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-white/60">{s.fact}</p>
                <h3 className="type-h2 mt-3">{s.name}</h3>
                <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/70">{s.text}</p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-medium">
                  {s.name} insurance
                  <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

/* 13 · Add-ons ─────────────────────────────────────────────── */

export function AddOnsSection({ intro, offers }: { intro: Intro; offers: { total: number; byKey: Record<string, number> } }) {
  return (
    <section aria-labelledby="ins-addons-title" className="py-14 md:py-20">
      <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-40">
            <Eyebrow>{intro.eyebrow}</Eyebrow>
            <h2 id="ins-addons-title" className="type-h2 mt-5 text-balance">
              {intro.title}
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-muted">{intro.text}</p>
            <div className="relative mt-8 hidden aspect-[4/3] overflow-hidden bg-ink lg:block">
              <Image src={IMG.headlightRed} alt="" fill sizes="(min-width: 1024px) 30vw, 0px" className="object-cover" />
            </div>
            <Button href="/insurance/add-ons" variant="dark" size="lg" arrow className="mt-8">
              Every add-on explained
            </Button>
          </div>
        </div>
        <div className="lg:col-span-8">
          <ul className="grid grid-cols-1 border-t border-ink sm:grid-cols-2 sm:gap-x-10">
            {STANDARD_ADDONS.map((a) => {
              const n = offers.byKey[a.key] ?? 0;
              return (
                <li key={a.key} className="border-b border-line">
                  <Link href={`/insurance/add-ons#${a.key}`} className="group block py-5">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-[15.5px] font-semibold transition-colors duration-[250ms] group-hover:text-red">{a.name}</span>
                      <ArrowUpRight aria-hidden className="size-4 shrink-0 text-muted transition-all duration-[250ms] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-red" />
                    </span>
                    <span className="mt-1.5 block text-[13.5px] leading-relaxed text-muted">{a.summary}</span>
                    <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink/70">
                      {a.typicalMaxAge ? <span>Typically cars up to {a.typicalMaxAge} years</span> : <span>Most cars</span>}
                      {a.fuels?.length === 1 && <span>{a.fuels[0]} only</span>}
                      {offers.total > 0 && (
                        <span className="num">
                          {n} of {offers.total} listed plans
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* 14 · Claim assistance ────────────────────────────────────── */

const CLAIM_STEPS = [
  { title: "At the spot", text: "Safety first, call 112 if anyone is hurt. Photograph everything; collect the other driver's details." },
  { title: "Inform your insurer", text: "Call the claims number on your policy straight away and note the claim number." },
  { title: "Survey and repair", text: "A surveyor assesses the damage. Cashless at a network garage, or pay and claim back." },
  { title: "Settlement", text: "The insurer pays the garage or you, less deductibles and anything the policy excludes." },
];

export function ClaimsSection({ intro }: { intro: Intro }) {
  return (
    <section aria-labelledby="ins-claims-title" className="bg-mist py-14 md:py-20">
      <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-stretch lg:gap-0">
        <div className="relative isolate flex min-h-[340px] flex-col justify-end overflow-hidden bg-ink p-6 text-white sm:p-10 lg:col-span-5">
          <Image src={IMG.darkGarage} alt="" fill sizes="(min-width: 1024px) 40vw, 100vw" className="-z-20 object-cover opacity-70" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/50 to-transparent" />
          <Siren aria-hidden className="size-6 text-red" />
          <p className="type-h3 mt-4 max-w-sm text-balance">
            MarchGear doesn&apos;t process claims. <span className="type-editorial font-normal text-white/85">Your insurer does.</span>
          </p>
          <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-white/65">We explain the process and, if you&apos;d like, call you to talk it through — free.</p>
        </div>
        <div className="bg-white p-6 sm:p-10 lg:col-span-7 xl:p-12">
          <Eyebrow>{intro.eyebrow}</Eyebrow>
          <h2 id="ins-claims-title" className="type-h2 mt-5 text-balance">
            {intro.title}
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">{intro.text}</p>
          <ol className="relative mt-10 space-y-7 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-px before:bg-line">
            {CLAIM_STEPS.map((s, i) => (
              <li key={s.title} className="relative grid grid-cols-[24px_1fr] gap-5">
                <span className={cn("relative z-10 inline-flex size-6 items-center justify-center rounded-full text-[11px] font-semibold num", i === 0 ? "bg-red text-white" : "bg-ink text-white")}>{i + 1}</span>
                <span>
                  <span className="block text-[15px] font-semibold">{s.title}</span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-muted">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button href="/insurance/claims#callback" size="lg" icon={<PhoneCall className="size-4" aria-hidden />}>
              Claim help & callback
            </Button>
            <TextLink href="/insurance/guides/how-to-make-a-car-insurance-claim">Read the claims guide</TextLink>
          </div>
        </div>
      </div>
    </section>
  );
}
