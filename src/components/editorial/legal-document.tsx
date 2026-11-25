import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { SiteContent } from "@/content/registry";
import { cn, slugify } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { TextLink } from "@/components/ui/section-heading";
import { LegalToc } from "./legal-toc";
import { businessFacts, grievanceContact, renderLegalText, type LegalVars } from "./legal-text";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** 2026-11-19 → 19 November 2026 (string-based, hydration-safe) */
function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

type LegalSection = SiteContent["legal"]["privacy"][number];

/** The four policies, linked from each other and from the footer. */
export const POLICIES = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Cookie Policy", href: "/cookies" },
  { label: "Refund & Cancellation Policy", href: "/refund-policy" },
] as const;

/** Each section's #anchor: the one set in the admin, else one made from the heading — unique on the page. */
function withIds(sections: LegalSection[]) {
  const used = new Set<string>();
  return sections.map((s, i) => {
    const base = s.anchor || slugify(s.title) || `section-${i + 1}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return { ...s, id };
  });
}

/**
 * Typeset policy page: header with the last-updated date, an "In short" summary, sticky contents on desktop,
 * numbered and anchored sections, and the company's details. `attachments` are blocks the code renders after the
 * section with that anchor (tables, forms); any whose section was removed in the admin go at the end.
 */
export function LegalDocument({
  eyebrow,
  title,
  intro,
  sections: content,
  updated,
  current,
  site,
  vars,
  plain,
  summary = [],
  attachments = {},
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
  updated: string;
  /** This page's path, from POLICIES. */
  current: (typeof POLICIES)[number]["href"];
  site: SiteContent["site"];
  vars: LegalVars;
  plain: Record<string, string>;
  summary?: string[];
  attachments?: Record<string, ReactNode>;
}) {
  const sections = withIds(content);
  const toc = sections.map(({ id, title }) => ({ id, title }));
  const others = POLICIES.filter((p) => p.href !== current);
  const orphans = Object.entries(attachments).filter(([anchor]) => !sections.some((s) => s.id === anchor));
  const facts = businessFacts(site);
  const grievance = grievanceContact(site);
  const text = (t: string) => renderLegalText(t, vars, plain);
  // "Access: get a summary…" → the short lead-in in bold, for scanning.
  const listItem = (t: string) => {
    const m = t.match(/^([^:[\]{}]{2,48}):\s+([\s\S]+)$/);
    return m ? (
      <>
        <strong className="font-semibold text-ink">{m[1]}:</strong> {text(m[2])}
      </>
    ) : (
      text(t)
    );
  };

  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={intro} crumbs={[{ label: eyebrow }]}>
        <p className="text-[13px]">
          <span className="text-muted">Last updated</span>{" "}
          <time dateTime={updated} className="font-medium num">
            {longDate(updated)}
          </time>
        </p>
      </PageHeader>

      <div className="container-x grid grid-cols-1 gap-12 py-14 md:py-20 lg:grid-cols-12 lg:gap-10">
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-28">
            <LegalToc sections={toc} />
            <nav aria-label="Other policies" className="mt-10 border-t border-line pt-6">
              <p className="type-eyebrow text-muted">Other policies</p>
              <ul className="mt-4 space-y-2.5">
                {others.map((p) => (
                  <li key={p.href}>
                    <TextLink href={p.href}>{p.label}</TextLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        <div className="min-w-0 lg:col-span-8 lg:col-start-5 xl:col-span-7">
          {summary.length > 0 && (
            <section aria-labelledby="in-short" className="border-l-2 border-red bg-mist px-5 py-5 md:px-7 md:py-6">
              <h2 id="in-short" className="type-eyebrow text-ink">
                In short
              </h2>
              <ul className="mt-4 space-y-2.5 text-[14.5px] leading-relaxed text-ink/85">
                {summary.map((point, i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-red" />
                    <span>{text(point)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

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
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="mt-12 scroll-mt-28 border-t border-line pt-10 first-of-type:mt-10 md:mt-14 md:pt-12">
              <p className="type-eyebrow text-muted num">{String(i + 1).padStart(2, "0")}</p>
              <h2 id={`${s.id}-title`} className="type-h3 mt-3">
                {s.title}
              </h2>
              <div className="mt-5 max-w-[68ch] space-y-4 text-[16px] leading-[1.75] text-ink/80">
                {s.paragraphs.map((p, j) => (
                  <p key={j}>{text(p)}</p>
                ))}
              </div>
              {s.list.length > 0 && (
                <ul className="mt-5 max-w-[68ch] space-y-3 text-[16px] leading-[1.7] text-ink/80">
                  {s.list.map((item, j) => (
                    <li key={j} className="flex gap-4">
                      <span aria-hidden className="mt-[0.8em] h-px w-3 shrink-0 bg-red" />
                      <span className="min-w-0">{listItem(item)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {attachments[s.id] && <div className="mt-8">{attachments[s.id]}</div>}
            </section>
          ))}

          {orphans.map(([anchor, node]) => (
            <div key={anchor} className="mt-12 border-t border-line pt-10">
              {node}
            </div>
          ))}

          <section aria-labelledby="company-details" className="mt-16 border border-line bg-white">
            <h2 id="company-details" className="border-b border-line px-5 py-4 text-[15px] font-semibold md:px-7">
              Who to contact
            </h2>
            <dl className="grid grid-cols-1 gap-px bg-line text-[14px] sm:grid-cols-2">
              {[
                ...facts.map((f) => ({ ...f, node: f.value as ReactNode })),
                {
                  label: grievance.named ? "Grievance Officer" : "Grievances",
                  value: grievance.text,
                  node: (
                    <>
                      {site.grievanceOfficer.name && site.grievanceOfficer.email && <span className="block">{site.grievanceOfficer.name}</span>}
                      <a href={`mailto:${grievance.email}`} className="break-words underline decoration-ink/30 underline-offset-4 hover:text-red">
                        {grievance.email}
                      </a>
                      {site.grievanceOfficer.email && site.grievanceOfficer.phone && <span className="block num">{site.grievanceOfficer.phone}</span>}
                      {!grievance.named && <span className="mt-1 block text-[12.5px] text-muted">A Grievance Officer will be named here shortly.</span>}
                    </>
                  ),
                },
                {
                  label: "Customer support",
                  value: site.supportEmail,
                  node: (
                    <>
                      <a href={`mailto:${site.supportEmail}`} className="break-words underline decoration-ink/30 underline-offset-4 hover:text-red">
                        {site.supportEmail}
                      </a>
                      <span className="block text-muted num">
                        {site.phone} · {site.hours}
                      </span>
                    </>
                  ),
                },
                ...(facts.some((f) => f.label === "Registered office") ? [] : [{ label: "Address", value: site.address, node: site.address as ReactNode }]),
              ].map((f, i, all) => (
                <div key={f.label} className={cn("bg-white px-5 py-4 md:px-7", all.length % 2 === 1 && i === all.length - 1 && "sm:col-span-2")}>
                  <dt className="text-[12px] text-muted">{f.label}</dt>
                  <dd className="mt-1 min-w-0 break-words font-medium text-ink">{f.node}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="mt-10 flex flex-col gap-4 border-t border-line pt-8 lg:hidden">
            <p className="type-eyebrow text-muted">Other policies</p>
            <ul className="flex flex-col gap-3">
              {others.map((p) => (
                <li key={p.href}>
                  <TextLink href={p.href}>{p.label}</TextLink>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-10 text-[13px] text-muted">
            Questions about this page?{" "}
            <Link href="/contact" className="font-medium text-ink underline underline-offset-4 hover:text-red">
              Contact our team
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
