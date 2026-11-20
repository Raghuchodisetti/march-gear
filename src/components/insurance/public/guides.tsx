import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { Accordion } from "@/components/ui/accordion";
import type { Intro } from "./home-sections";
import { ExpertCallbackButton } from "./callback-forms";

export interface GuideSummary {
  slug: string;
  title: string;
  summary: string;
  topic: string;
  minutes: number;
  image: string;
}

export const guideHref = (slug: string) => `/insurance/guides/${slug}`;

/** A guide's image, or a quiet typographic panel when it has none. */
export function GuideImage({ guide, sizes, className, priority }: { guide: GuideSummary; sizes: string; className?: string; priority?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden bg-ink", className)}>
      {guide.image ? (
        <Image src={guide.image} alt="" fill sizes={sizes} preload={priority} className="object-cover transition-transform duration-[900ms] ease-[var(--ease-premium)] group-hover:scale-[1.04]" />
      ) : (
        <div aria-hidden className="absolute inset-0 flex items-end bg-ink p-5">
          <BookOpen className="size-8 text-white/20" />
        </div>
      )}
    </div>
  );
}

/* 15 · Guides — one featured, the rest as an index ─────────── */

export function GuidesSection({ intro, guides }: { intro: Intro; guides: GuideSummary[] }) {
  if (!guides.length) return null;
  const [lead, ...rest] = guides;
  return (
    <section aria-labelledby="ins-guides-title" className="border-t border-line py-14 md:py-20">
      <div className="container-x">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Eyebrow>{intro.eyebrow}</Eyebrow>
            <h2 id="ins-guides-title" className="type-h2 mt-5 text-balance">
              {intro.title}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">{intro.text}</p>
          </div>
          <TextLink href="/insurance/guides">All {guides.length} guides</TextLink>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          <Link href={guideHref(lead.slug)} className="group lg:col-span-6">
            <GuideImage guide={lead} sizes="(min-width: 1024px) 45vw, 100vw" className="aspect-[16/10]" />
            <p className="mt-6 flex items-center gap-3 text-[12px] text-muted">
              <span className="font-semibold uppercase tracking-[0.14em] text-red">{lead.topic}</span>
              <span className="inline-flex items-center gap-1">
                <Clock aria-hidden className="size-3.5" /> {lead.minutes} min read
              </span>
            </p>
            <h3 className="type-h2 mt-3 max-w-xl text-balance transition-colors duration-[250ms] group-hover:text-red">{lead.title}</h3>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">{lead.summary}</p>
          </Link>
          <ol className="border-t border-ink lg:col-span-6">
            {rest.slice(0, 6).map((g, i) => (
              <li key={g.slug} className="border-b border-line">
                <Link href={guideHref(g.slug)} className="group grid grid-cols-[2.25rem_1fr_auto] items-baseline gap-3 py-5">
                  <span className="text-[12px] font-medium text-muted num">{String(i + 2).padStart(2, "0")}</span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{g.topic}</span>
                    <span className="mt-1.5 block text-[16px] font-semibold leading-snug transition-colors duration-[250ms] group-hover:text-red">{g.title}</span>
                  </span>
                  <span className="flex items-center gap-2 text-[12px] text-muted num">
                    {g.minutes} min
                    <ArrowUpRight aria-hidden className="size-4 text-ink transition-transform duration-[250ms] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* 16 · FAQs (with FAQPage structured data) ─────────────────── */

export function FaqSection({ title, faqs, idPrefix = "ins-faq" }: { title: string; faqs: { q: string; a: string }[]; idPrefix?: string }) {
  if (!faqs.length) return null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <section aria-labelledby={`${idPrefix}-title`} className="bg-mist py-14 md:py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="container-x grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-40">
            <Eyebrow>FAQ</Eyebrow>
            <h2 id={`${idPrefix}-title`} className="type-h2 mt-5 text-balance">
              {title}
            </h2>
            <div className="mt-8 border-t border-line pt-6">
              <p className="text-[15px] font-semibold">Still unsure?</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">Ask for a free callback. We&apos;ll explain your options in plain language — we don&apos;t sell policies.</p>
              <ExpertCallbackButton className="mt-5" variant="dark" />
            </div>
          </div>
        </div>
        <div className="lg:col-span-8">
          <Accordion items={faqs.map((f, i) => ({ id: `${idPrefix}-${i}`, title: f.q, content: f.a }))} defaultOpen={[`${idPrefix}-0`]} />
        </div>
      </div>
    </section>
  );
}
