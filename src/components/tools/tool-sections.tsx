import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Info } from "lucide-react";
import { tools, type Tool } from "@/data/tools";
import { Accordion } from "@/components/ui/accordion";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

/* Server-rendered sections that close every tool page, in a fixed order:
   method → questions → related tools → disclaimer. */

export interface MethodStep {
  title: string;
  body: ReactNode;
  formula?: string;
}

export function HowItWorks({ intro, steps, title = "How it's calculated" }: { intro: ReactNode; steps: MethodStep[]; title?: string }) {
  return (
    <section aria-labelledby="method-heading" className="border-t border-line py-14 md:py-20">
      <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
        <Reveal className="lg:col-span-4">
          <Eyebrow>Method</Eyebrow>
          <h2 id="method-heading" className="type-h2 mt-5 text-balance">
            {title}
          </h2>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-muted">{intro}</p>
        </Reveal>
        <ol className="lg:col-span-8">
          {steps.map((step, i) => (
            <li key={step.title} className="grid grid-cols-1 gap-3 border-t border-line py-7 first:border-t-0 first:pt-0 md:grid-cols-[72px_1fr] md:gap-6 lg:first:border-t lg:first:pt-7">
              <span className="font-mono text-[12px] text-muted">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <h3 className="type-h4">{step.title}</h3>
                <div className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{step.body}</div>
                {step.formula && (
                  <pre tabIndex={0} aria-label="Formula" className="no-scrollbar mt-4 overflow-x-auto border-l-2 border-red bg-mist px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink">
                    {step.formula}
                  </pre>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ToolFaqs({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <section aria-labelledby="faq-heading" className="bg-mist py-14 md:py-20">
      <div className="container-x grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Eyebrow>FAQ</Eyebrow>
          <h2 id="faq-heading" className="type-h2 mt-5 text-balance">
            Questions, <span className="type-editorial">answered</span>
          </h2>
        </div>
        <div className="lg:col-span-8">
          <Accordion items={items.map((item, i) => ({ id: `faq-${i}`, title: item.q, content: item.a }))} defaultOpen={["faq-0"]} />
        </div>
      </div>
    </section>
  );
}

export function RelatedTools({ current, slugs, children }: { current: string; slugs: string[]; children?: ReactNode }) {
  const related = slugs.map((s) => tools.find((t) => t.slug === s)).filter((t): t is Tool => t !== undefined && t.slug !== current);
  return (
    <section aria-labelledby="related-heading" className="py-14 md:py-16">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>Keep exploring</Eyebrow>
            <h2 id="related-heading" className="type-h3 mt-4">
              Related tools
            </h2>
          </div>
          <TextLink href="/tools">All tools</TextLink>
        </div>
        <ul className="mt-10 grid grid-cols-1 border-y border-line md:grid-cols-3 md:divide-x md:divide-line">
          {related.map((tool) => {
            const Icon = tool.icon;
            return (
              <li key={tool.slug} className="border-b border-line last:border-b-0 md:border-b-0 md:px-7 md:first:pl-0 md:last:pr-0">
                <Link href={tool.href} className="group/rt flex h-full flex-col gap-4 py-7">
                  <Icon aria-hidden className="size-5 text-ink" strokeWidth={1.6} />
                  <span className="flex items-center justify-between gap-4">
                    <span className="type-h4">{tool.name}</span>
                    <ArrowUpRight
                      aria-hidden
                      className="size-4 shrink-0 text-red transition-transform duration-[250ms] group-hover/rt:-translate-y-0.5 group-hover/rt:translate-x-0.5"
                    />
                  </span>
                  <span className="text-[14px] leading-relaxed text-muted">{tool.description}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        {children}
      </div>
    </section>
  );
}

/** Quiet facts under a tool's page title: "Reducing balance · Live results · Illustrative". */
export function ToolMetaRow({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted">
      {items.map((item, i) => (
        <li key={item} className="flex items-center gap-2">
          <span aria-hidden className={cn("size-1 rounded-full", i === 0 ? "bg-red" : "bg-ink/25")} />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Numbered advice grid used beneath an instrument. */
export function ToolTips({ eyebrow, title, tips }: { eyebrow: string; title: ReactNode; tips: { title: string; body: ReactNode }[] }) {
  return (
    <section aria-labelledby="tips-heading" className="border-t border-line py-14 md:py-20">
      <div className="container-x">
        <div className="max-w-2xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 id="tips-heading" className="type-h2 mt-5 text-balance">
            {title}
          </h2>
        </div>
        <ol className="mt-14 grid grid-cols-1 gap-px border border-line bg-line md:grid-cols-2">
          {tips.map((tip, i) => (
            <li key={tip.title} className="bg-white p-6 md:p-10">
              <span className="font-display text-[44px] font-semibold leading-none tracking-[-0.04em] text-ink/15 num">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="type-h4 mt-6">{tip.title}</h3>
              <div className="mt-2.5 max-w-lg text-[15px] leading-relaxed text-muted">{tip.body}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ToolDisclaimer({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn("container-x pb-14 md:pb-20", className)}>
      <aside aria-label="Disclaimer" className="flex gap-4 border border-line p-5 md:items-center md:p-6">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted md:mt-0" />
        <p className="text-[13px] leading-relaxed text-muted">
          <strong className="font-medium text-ink">Illustrative estimate.</strong>{" "}
          {children ??
            "Figures are modelled from indicative demo prices and simplified, rounded assumptions. They are not a quote, an offer of credit or financial advice — confirm with your lender, insurer or dealer before you decide."}
        </p>
      </aside>
    </div>
  );
}
