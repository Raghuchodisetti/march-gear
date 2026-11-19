import { ChevronDown, Info } from "lucide-react";
import type { LegalSection } from "@/data/editorial-legal";
import { PageHeader } from "@/components/ui/page-header";
import { TextLink } from "@/components/ui/section-heading";
import { Badge } from "@/components/ui/badge";
import { LegalToc } from "./legal-toc";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** 2026-11-19 → 19 November 2026 (string-based, hydration-safe) */
function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Typeset legal page: header, sticky contents on desktop, anchored sections. */
export function LegalDocument({
  eyebrow,
  title,
  intro,
  sections,
  updated,
  sibling,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
  updated: string;
  sibling: { label: string; href: string };
}) {
  const toc = sections.map(({ id, title }) => ({ id, title }));

  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={intro} crumbs={[{ label: eyebrow }]}>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[13px]">
          <p>
            <span className="text-muted">Last updated</span>{" "}
            <time dateTime={updated} className="font-medium num">
              {longDate(updated)}
            </time>
          </p>
          <Badge tone="mist">Sample text · Demo</Badge>
        </div>
      </PageHeader>

      <div className="container-x grid grid-cols-1 gap-12 py-14 md:py-20 lg:grid-cols-12 lg:gap-10">
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-28">
            <LegalToc sections={toc} />
            <div className="mt-10 border-t border-line pt-6">
              <TextLink href={sibling.href}>{sibling.label}</TextLink>
            </div>
          </div>
        </aside>

        <div className="min-w-0 lg:col-span-8 lg:col-start-5 xl:col-span-7">
          <div className="flex gap-3 border-l-2 border-red bg-mist px-5 py-4 text-[13.5px] leading-relaxed text-ink/80">
            <Info className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
            <p>
              This page contains <strong className="font-semibold text-ink">sample text written for a demonstration product</strong>. It is not legal
              advice, has not been reviewed by counsel and does not describe a real service.
            </p>
          </div>

          <details className="group/toc mt-8 border-y border-line lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[14px] font-medium [&::-webkit-details-marker]:hidden">
              On this page
              <ChevronDown className="size-4 transition-transform duration-[400ms] group-open/toc:rotate-180" aria-hidden />
            </summary>
            <ol className="pb-4">
              {toc.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex gap-3 py-2 text-[14px] text-muted hover:text-ink">
                    <span className="w-5 shrink-0 text-[12px] num">{String(i + 1).padStart(2, "0")}</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </details>

          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="mt-12 border-t border-line pt-10 first-of-type:mt-10 md:mt-14 md:pt-12">
              <p className="type-eyebrow text-muted num">{String(i + 1).padStart(2, "0")}</p>
              <h2 id={`${s.id}-title`} className="type-h3 mt-3">
                {s.title}
              </h2>
              <div className="mt-5 max-w-[68ch] space-y-4 text-[16px] leading-[1.75] text-ink/80">
                {s.paragraphs.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </div>
              {s.list && (
                <ul className="mt-5 max-w-[68ch] space-y-3 text-[16px] leading-[1.7] text-ink/80">
                  {s.list.map((item, j) => (
                    <li key={j} className="flex gap-4">
                      <span aria-hidden className="mt-[0.8em] h-px w-3 shrink-0 bg-red" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div className="mt-16 flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[14px] text-muted">Questions about this page?</p>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <TextLink href="/contact">Contact our team</TextLink>
              <span className="lg:hidden">
                <TextLink href={sibling.href}>{sibling.label}</TextLink>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
