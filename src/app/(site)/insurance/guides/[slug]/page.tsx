import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock, Info } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { CategoryAd, RelatedGuides } from "@/components/insurance/public/landing";
import { ExpertCallbackButton } from "@/components/insurance/public/callback-forms";
import { GuideToc, type TocItem } from "@/components/insurance/public/guide-toc";
import { INSURANCE_OG_IMAGE, fitDescription, fitTitle, pageMetadata, shareImage } from "@/components/seo/metadata";

const anchor = (text: string, used: Set<string>) => {
  const base =
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section";
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
};

/** Body lines → headings ("## …") and paragraphs, with anchor ids for the table of contents. */
function parseBody(lines: string[]) {
  const used = new Set<string>();
  const blocks: ({ kind: "h"; id: string; text: string } | { kind: "p"; text: string })[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      const text = line.slice(3).trim();
      if (text) blocks.push({ kind: "h", id: anchor(text, used), text });
    } else blocks.push({ kind: "p", text: line });
  }
  const toc: TocItem[] = blocks.filter((b): b is { kind: "h"; id: string; text: string } => b.kind === "h").map(({ id, text }) => ({ id, text }));
  return { blocks, toc };
}

async function load(slug: string) {
  const { content } = await getCatalog();
  const guides = content.insuranceGuides.guides;
  const guide = guides.find((g) => g.slug === slug);
  return { guide, guides };
}

export async function generateStaticParams() {
  const { content } = await getCatalog();
  return content.insuranceGuides.guides.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata(props: PageProps<"/insurance/guides/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const { guide } = await load(slug);
  if (!guide) return { title: "Guide not found" };
  return pageMetadata({
    title: fitTitle([`${guide.title}: Car Insurance Guide`, guide.title]),
    description: fitDescription(guide.summary, "A plain-language car insurance guide from MarchGear."),
    path: `/insurance/guides/${guide.slug}`,
    type: "article",
    article: { section: "Car insurance" },
    images: guide.image ? [shareImage(guide.image, guide.title)] : [INSURANCE_OG_IMAGE],
  });
}

export default async function GuidePage(props: PageProps<"/insurance/guides/[slug]">) {
  const { slug } = await props.params;
  const { guide, guides } = await load(slug);
  if (!guide) notFound();

  const { blocks, toc } = parseBody(guide.body);
  const others = guides.filter((g) => g.slug !== guide.slug);
  const related = [...others.filter((g) => g.topic === guide.topic), ...others.filter((g) => g.topic !== guide.topic)].slice(0, 3);
  const words = guide.body.join(" ").split(/\s+/).filter(Boolean).length;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.summary,
    image: guide.image || undefined,
    wordCount: words,
    publisher: { "@type": "Organization", name: "MarchGear" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article>
        <header className="border-b border-line">
          <div className="container-x pb-10 pt-8 md:pb-14 md:pt-10">
            <Breadcrumbs items={[{ label: "Insurance", href: "/insurance" }, { label: "Guides", href: "/insurance/guides" }, { label: guide.title }]} />
            <div className="mt-10 grid grid-cols-1 gap-10 md:mt-14 lg:grid-cols-12 lg:items-end lg:gap-12">
              <div className="animate-rise lg:col-span-7">
                <p className="flex items-center gap-3 text-[12px] text-muted">
                  <span className="font-semibold uppercase tracking-[0.16em] text-red">{guide.topic}</span>
                  <span className="inline-flex items-center gap-1 num">
                    <Clock aria-hidden className="size-3.5" /> {guide.minutes} min read
                  </span>
                </p>
                <h1 className="type-h1 mt-5 text-balance">{guide.title}</h1>
                <p className="type-lead mt-5 max-w-2xl text-muted">{guide.summary}</p>
              </div>
              {guide.image && (
                <div className="relative aspect-[16/10] overflow-hidden bg-ink lg:col-span-5">
                  <Image src={guide.image} alt="" fill preload sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="container-x grid grid-cols-1 gap-10 py-12 md:py-16 lg:grid-cols-12 lg:gap-12">
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-40">
              <GuideToc items={toc} />
              <div className="mt-8 hidden border-t border-line pt-6 lg:block">
                <p className="text-[13.5px] font-semibold">Ready to compare?</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">Describe your car and see indicative premiums from listed providers.</p>
                <Button href="/insurance#quote" size="sm" variant="dark" arrow className="mt-4">
                  Get started
                </Button>
              </div>
            </div>
          </aside>

          <div className="min-w-0 lg:col-span-7 lg:col-start-5">
            <div className="max-w-[68ch]">
              {blocks.map((b, i) =>
                b.kind === "h" ? (
                  <h2 key={i} id={b.id} className="type-h3 mb-4 mt-12 scroll-mt-36 first:mt-0">
                    {b.text}
                  </h2>
                ) : (
                  <p key={i} className="mb-5 text-[16.5px] leading-[1.75] text-ink/85 text-pretty">
                    {b.text}
                  </p>
                ),
              )}
            </div>

            <div className="mt-12 flex gap-3 border-l-2 border-red bg-mist p-5 text-[13.5px] leading-relaxed text-muted">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-ink" />
              <p>
                A general guide for car owners in India, not advice on a particular policy. Terms differ between insurers — your policy wording decides what&apos;s covered. MarchGear doesn&apos;t issue policies or settle claims.
              </p>
            </div>

            <div className="mt-10 flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/insurance/guides" className="group inline-flex items-center gap-1.5 text-[14px] font-medium">
                <ArrowRight aria-hidden className="size-4 rotate-180 text-red transition-transform duration-[250ms] group-hover:-translate-x-0.5" />
                All guides
              </Link>
              <ExpertCallbackButton topic="other" label="Ask an expert" />
            </div>
          </div>
        </div>
      </article>
      <CategoryAd />
      <RelatedGuides guides={related} title="Related guides" />
    </>
  );
}
