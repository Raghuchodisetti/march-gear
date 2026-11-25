import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Download, FileText, RefreshCw } from "lucide-react";
import { getGuide, listGuides } from "@/server/guides";
import { formatMB, guideHref, guidePdfHref, headingIds, istDay, readMinutes } from "@/lib/guides";
import { formatDate } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Eyebrow } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { GuideToc, type TocItem } from "@/components/insurance/public/guide-toc";
import { GuideContent } from "@/components/guides/guide-content";
import { GuideCard, type BrowserGuide } from "@/components/guides/guides-browser";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl } from "@/components/seo/site";
import { fitDescription, fitTitle, pageMetadata } from "@/components/seo/metadata";

export async function generateStaticParams() {
  return (await listGuides()).map((g) => ({ slug: g.slug }));
}

export async function generateMetadata(props: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const guide = await getGuide(slug);
  if (!guide) return { title: "Guide not found" };
  return pageMetadata({
    title: fitTitle([`${guide.title}: ${guide.subject} Guide`, guide.title]),
    description: fitDescription(guide.summary, `A ${guide.subject.toLowerCase()} guide from MarchGear.`),
    path: guideHref(guide.slug),
    type: "article",
    article: { section: guide.subject, modifiedTime: guide.updatedAt, publishedTime: guide.createdAt },
  });
}

export default async function GuidePage(props: PageProps<"/guides/[slug]">) {
  const { slug } = await props.params;
  const guide = await getGuide(slug);
  if (!guide) notFound();

  const ids = headingIds(guide.content);
  // The contents list: the sections, or — when there are only a couple — their sub-sections too.
  const h2s = guide.content.filter((b) => b.type === "h2").length;
  const toc: TocItem[] = guide.content
    .flatMap((b, i) => ((b.type === "h2" || (h2s < 3 && b.type === "h3")) && ids[i] ? [{ id: ids[i]!, text: b.text }] : []))
    .slice(0, 24);
  const minutes = readMinutes(guide.words);
  // An automatic summary is the start of one of the opening paragraphs — don't print the same words twice.
  const opening = guide.content.slice(0, 6).flatMap((b) => (b.type === "p" ? [b.text] : []));
  const lead = guide.summary && !opening.some((t) => t.startsWith(guide.summary.replace(/…$/, ""))) ? guide.summary : null;

  const others = (await listGuides()).filter((g) => g.slug !== guide.slug);
  const related: BrowserGuide[] = [...others.filter((g) => g.subjectSlug === guide.subjectSlug), ...others.filter((g) => g.subjectSlug !== guide.subjectSlug)].slice(0, 3).map((g) => ({
    slug: g.slug,
    href: guideHref(g.slug),
    subject: g.subject,
    subjectSlug: g.subjectSlug,
    title: g.title,
    summary: g.summary,
    minutes: readMinutes(g.words),
    updated: formatDate(istDay(g.updatedAt)),
    pdfPages: g.pdfPages,
  }));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: guide.title,
          description: guide.summary || undefined,
          articleSection: guide.subject,
          wordCount: guide.words,
          datePublished: guide.createdAt,
          dateModified: guide.updatedAt,
          mainEntityOfPage: absoluteUrl(guideHref(guide.slug)),
          publisher: { "@type": "Organization", name: "MarchGear" },
        }}
      />
      <article>
        <header className="relative isolate overflow-hidden bg-ink text-white">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />
          <div aria-hidden className="absolute -right-48 -top-48 -z-10 size-[600px] rounded-full bg-[radial-gradient(circle,rgba(227,30,36,0.32),transparent_65%)]" />
          <div className="container-x pb-12 pt-8 md:pb-16 md:pt-10">
            <Breadcrumbs items={[{ label: "Guides", href: "/guides" }, { label: guide.title }]} tone="light" />
            <div className="mt-12 max-w-4xl animate-rise md:mt-16">
              <Eyebrow tone="light">{guide.subject}</Eyebrow>
              <h1 className="type-h1 mt-5 text-balance break-words">{guide.title}</h1>
              {lead && <p className="type-lead mt-5 max-w-2xl text-white/65">{lead}</p>}
            </div>
            <div className="mt-10 flex flex-col gap-5 border-t border-white/12 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/70 num">
                <li className="inline-flex items-center gap-1.5">
                  <Clock aria-hidden className="size-4 text-white/45" /> {minutes} min read
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <RefreshCw aria-hidden className="size-4 text-white/45" /> Updated {formatDate(istDay(guide.updatedAt))}
                </li>
                {guide.pdfPages ? (
                  <li className="inline-flex items-center gap-1.5">
                    <FileText aria-hidden className="size-4 text-white/45" /> {guide.pdfPages}-page guide
                  </li>
                ) : null}
              </ul>
              {guide.pdf && (
                <Button href={guidePdfHref(guide.slug)} target="_blank" rel="noopener" variant="light" size="sm" icon={<Download className="size-4" aria-hidden />} prefetch={false}>
                  Download PDF · {formatMB(guide.pdf.size)}
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="container-x grid grid-cols-1 gap-10 py-12 md:py-16 lg:grid-cols-12 lg:gap-12">
          {toc.length >= 2 && (
            <aside className="lg:col-span-3">
              <div className="lg:sticky lg:top-40">
                <GuideToc items={toc} />
              </div>
            </aside>
          )}

          <div className={toc.length >= 2 ? "min-w-0 lg:col-span-8 lg:col-start-5" : "min-w-0 lg:col-span-8 lg:col-start-3"}>
            <GuideContent blocks={guide.content} ids={ids} />

            {guide.pdf && (
              <div className="mt-12 flex items-start gap-3 rounded-[4px] border border-line p-5 text-[13.5px] leading-relaxed text-muted">
                <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-ink" />
                <p>
                  This page is the text of the original PDF. Pictures, diagrams and the original layout are in the{" "}
                  <a href={guidePdfHref(guide.slug)} target="_blank" rel="noopener" className="font-medium text-ink underline underline-offset-2 hover:text-red">
                    PDF version
                  </a>
                  .
                </p>
              </div>
            )}

            <div className="mt-10 border-t border-line pt-8">
              <Link href="/guides" className="group inline-flex items-center gap-2 text-[14px] font-medium">
                <ArrowLeft aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover:-translate-x-0.5" />
                All guides
              </Link>
            </div>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="more-guides" className="border-t border-line bg-mist/60">
          <div className="container-x py-12 md:py-16">
            <div className="flex items-end justify-between gap-6">
              <h2 id="more-guides" className="type-h2">
                More guides
              </h2>
              <Link href="/guides" className="hidden text-[14px] font-medium underline-offset-4 hover:underline sm:inline">
                See all
              </Link>
            </div>
            <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {related.map((g) => (
                <li key={g.slug}>
                  <GuideCard g={g} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
