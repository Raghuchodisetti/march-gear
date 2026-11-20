import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Clock } from "lucide-react";
import type { InsIntent } from "@/db/enums";
import type { InsuranceSearch } from "@/insurance/types";
import { cn } from "@/lib/utils";
import { AdSlot } from "@/components/ads/ad-slot";
import { Eyebrow } from "@/components/ui/section-heading";
import { PageHeader } from "@/components/ui/page-header";
import { InsuranceSearchForm } from "@/components/insurance/search/insurance-search-form";
import { ExpertCallbackButton } from "./callback-forms";
import { GuideImage, guideHref, type GuideSummary } from "./guides";
import type { HelpTopic } from "./lead-options";

/* ──────────────────────────────────────────────────────────────
   Building blocks shared by the insurance category pages
   (/insurance/types, new-car, renewal, used-car, ev, add-ons,
   claims, guides, articles).
   ────────────────────────────────────────────────────────────── */

export interface PageHero {
  eyebrow: string;
  title: string;
  subtitle: string;
}

/** Image-led opener with breadcrumbs. Children sit under the copy (buttons, facts). */
export function LandingHero({ hero, image, imageFocus, crumb, children }: { hero: PageHero; image: string; imageFocus?: string; crumb: string; children?: ReactNode }) {
  return (
    <PageHeader
      image={image}
      imageFocus={imageFocus}
      eyebrow={hero.eyebrow}
      title={hero.title}
      description={hero.subtitle}
      crumbs={[{ label: "Insurance", href: "/insurance" }, { label: crumb }]}
    >
      {children}
    </PageHeader>
  );
}

/** A row of facts on the dark hero. */
export function HeroFacts({ facts }: { facts: { value: string; label: string }[] }) {
  return (
    <dl className={cn("grid max-w-4xl grid-cols-2 gap-px bg-white/10", facts.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3")}>
      {facts.map((f) => (
        <div key={f.label} className="bg-ink/60 px-4 py-4 backdrop-blur-sm">
          <dt className="sr-only">{f.label}</dt>
          <dd className="font-display text-xl font-semibold tracking-[-0.02em] num md:text-2xl">{f.value}</dd>
          <dd className="mt-0.5 text-[12.5px] leading-snug text-white/60">{f.label}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The category banner ad slot (renders nothing when no campaign is live). */
export function CategoryAd() {
  return <AdSlot placement="insurance_category_banner" />;
}

/** A standard section with an eyebrow + title on the left (or top) and content. */
export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  tone = "white",
  layout = "stack",
  className,
}: {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  tone?: "white" | "mist" | "ink";
  layout?: "stack" | "aside";
  className?: string;
}) {
  const dark = tone === "ink";
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn("scroll-mt-36 py-14 md:py-20", tone === "mist" && "bg-mist", dark && "bg-ink text-white", tone === "white" && "border-t border-line first-of-type:border-t-0", className)}
    >
      <div className={cn("container-x", layout === "aside" && "grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16")}>
        <div className={cn(layout === "aside" ? "lg:col-span-4" : "max-w-3xl")}>
          <div className={cn(layout === "aside" && "lg:sticky lg:top-40")}>
            <Eyebrow tone={dark ? "light" : "dark"}>{eyebrow}</Eyebrow>
            <h2 id={titleId} className="type-h2 mt-5 text-balance">
              {title}
            </h2>
            {intro && <div className={cn("mt-5 space-y-4 text-[15px] leading-relaxed", dark ? "text-white/65" : "text-muted")}>{intro}</div>}
          </div>
        </div>
        <div className={cn(layout === "aside" ? "min-w-0 lg:col-span-8" : "mt-12")}>{children}</div>
      </div>
    </section>
  );
}

/** The search form in a section of its own (anchor #quote). */
export function QuoteSection({
  title,
  text,
  defaultIntent,
  initial,
  source,
  tone = "mist",
}: {
  title: ReactNode;
  text: string;
  defaultIntent?: InsIntent;
  initial?: Partial<InsuranceSearch>;
  source: string;
  tone?: "mist" | "white";
}) {
  return (
    <section id="quote" aria-labelledby="quote-title" className={cn("scroll-mt-32 py-14 md:py-20", tone === "mist" ? "bg-mist" : "border-t border-line")}>
      <div className="container-x">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div className="max-w-2xl">
            <Eyebrow>Indicative premiums</Eyebrow>
            <h2 id="quote-title" className="type-h2 mt-5 text-balance">
              {title}
            </h2>
          </div>
          <p className="max-w-md text-[15px] leading-relaxed text-muted lg:text-right">{text}</p>
        </div>
        <div className="mt-10">
          <InsuranceSearchForm variant="panel" defaultIntent={defaultIntent} initial={initial} source={source} />
        </div>
      </div>
    </section>
  );
}

/** Closing band: a strong line, the main action and a callback. */
export function CtaBand({ title, accent, action, topic = "new" }: { title: string; accent?: string; action: { label: string; href: string }; topic?: HelpTopic }) {
  return (
    <section className="bg-ink py-16 text-white md:py-20">
      <div className="container-x flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <p className="type-h2 max-w-2xl text-balance">
          {title} {accent && <span className="type-editorial font-normal text-white/85">{accent}</span>}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={action.href}
            className="group inline-flex h-13 items-center justify-center gap-2 rounded-[3px] bg-red px-7 text-[15px] font-medium text-white transition-colors duration-[250ms] hover:bg-red-600"
          >
            {action.label}
            <ArrowUpRight aria-hidden className="size-4 transition-transform duration-[250ms] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
          <ExpertCallbackButton topic={topic} variant="outline-light" />
        </div>
      </div>
    </section>
  );
}

/** Up to three guides as compact image cards. */
export function RelatedGuides({ guides, title = "Read next" }: { guides: GuideSummary[]; title?: string }) {
  if (!guides.length) return null;
  return (
    <section aria-labelledby="related-guides-title" className="border-t border-line py-14 md:py-20">
      <div className="container-x">
        <div className="flex items-end justify-between gap-6">
          <h2 id="related-guides-title" className="type-h3">
            {title}
          </h2>
          <Link href="/insurance/guides" className="text-[13.5px] font-medium underline-offset-4 hover:text-red hover:underline">
            All guides
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
          {guides.slice(0, 3).map((g) => (
            <Link key={g.slug} href={guideHref(g.slug)} className="group">
              <GuideImage guide={g} sizes="(min-width: 768px) 30vw, 100vw" className="aspect-[16/10]" />
              <p className="mt-4 flex items-center gap-3 text-[11.5px] text-muted">
                <span className="font-semibold uppercase tracking-[0.14em] text-red">{g.topic}</span>
                <span className="inline-flex items-center gap-1 num">
                  <Clock aria-hidden className="size-3" /> {g.minutes} min
                </span>
              </p>
              <h3 className="mt-2 text-[17px] font-semibold leading-snug transition-colors duration-[250ms] group-hover:text-red">{g.title}</h3>
              <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-muted">{g.summary}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Picks guides by slug (in that order), skipping any that were removed in the admin. */
export function pickGuides(all: GuideSummary[], slugs: string[]) {
  return slugs.map((s) => all.find((g) => g.slug === s)).filter((g): g is GuideSummary => Boolean(g));
}

/** A small "N plans listed" note that links to the comparison. */
export function PlansListed({ count, className }: { count: number; className?: string }) {
  return (
    <Link href="/insurance/compare" className={cn("inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink underline-offset-4 hover:text-red hover:underline", className)}>
      <span className={cn("size-1.5 rounded-full", count ? "bg-red" : "bg-muted/50")} />
      {count ? `${count} listed ${count === 1 ? "plan" : "plans"}` : "No listed plans yet"}
    </Link>
  );
}

/** Numbered steps in a vertical rule. */
export function Steps({ steps, tone = "dark" }: { steps: { title: string; text: ReactNode }[]; tone?: "dark" | "light" }) {
  return (
    <ol className={cn("border-t", tone === "dark" ? "border-ink" : "border-white/30")}>
      {steps.map((s, i) => (
        <li key={s.title} className={cn("grid grid-cols-[3rem_1fr] gap-4 border-b py-6", tone === "dark" ? "border-line" : "border-white/10")}>
          <span className="font-display text-[26px] font-semibold leading-none tracking-[-0.04em] text-red num">{String(i + 1).padStart(2, "0")}</span>
          <span>
            <span className="block text-[16px] font-semibold">{s.title}</span>
            <span className={cn("mt-1.5 block text-[14.5px] leading-relaxed", tone === "dark" ? "text-muted" : "text-white/65")}>{s.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
