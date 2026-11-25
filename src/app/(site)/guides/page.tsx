import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { listGuides } from "@/server/guides";
import { guideHref, istDay, readMinutes } from "@/lib/guides";
import { formatDate } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Eyebrow } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { GuidesBrowser, type BrowserGuide } from "@/components/guides/guides-browser";
import { pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Car Guides",
  description: "Practical car guides from MarchGear, grouped by subject — each topic on a page of its own.",
  path: "/guides",
});

export default async function GuidesPage() {
  const guides = await listGuides();
  // Newest first.
  const items: BrowserGuide[] = [...guides]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((g) => ({
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
  const subjects = new Set(guides.map((g) => g.subjectSlug)).size;
  const minutes = items.reduce((n, g) => n + g.minutes, 0);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div aria-hidden className="absolute -right-40 -top-40 -z-10 size-[560px] rounded-full bg-[radial-gradient(circle,rgba(227,30,36,0.35),transparent_65%)]" />
        <div className="container-x pb-10 pt-8 md:pb-12 md:pt-10">
          <Breadcrumbs items={[{ label: "Guides" }]} tone="light" />
          <div className="mt-10 max-w-3xl animate-rise md:mt-12">
            <Eyebrow tone="light">Guides</Eyebrow>
            <h1 className="type-h1 mt-5 text-balance">
              Car know-how, <span className="type-editorial font-normal text-white/90">one topic at a time.</span>
            </h1>
            <p className="type-lead mt-5 max-w-2xl text-white/65">Practical guides on buying, running and looking after a car in India — each topic on a page of its own.</p>
          </div>
          {guides.length > 0 && (
            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/12 pt-5 md:mt-10">
              {[
                ["Guides", guides.length.toLocaleString("en-IN")],
                ["Subjects", subjects.toLocaleString("en-IN")],
                ["Reading", `${minutes.toLocaleString("en-IN")} min`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[12px] text-white/50">{label}</dt>
                  <dd className="mt-1 text-[22px] font-semibold num">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <div className="container-x py-10 md:py-14">
        {items.length === 0 ? (
          <div className="flex flex-col items-center rounded-[4px] border border-dashed border-line px-6 py-20 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-mist">
              <BookOpen aria-hidden className="size-6" />
            </span>
            <h2 className="type-h3 mt-5">Guides are on the way</h2>
            <p className="mt-2 max-w-md text-[15px] text-muted">We&apos;re writing the first ones now. In the meantime, our news and reviews cover what&apos;s new in the market.</p>
            <Button href="/news" variant="outline" arrow className="mt-7">
              News & reviews
            </Button>
          </div>
        ) : (
          <GuidesBrowser guides={items} />
        )}
      </div>
    </>
  );
}
