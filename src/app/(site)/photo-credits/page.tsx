import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { creditsFor } from "@/server/photo-credits";
import { changeLabel, photoAngle, sourceName, type PhotoCredit } from "@/lib/photo-credits";
import { MEDIA_THUMB_WIDTH } from "@/components/admin/media-shared";
import { PageHeader } from "@/components/ui/page-header";
import { pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Photo Credits",
  description: "The photographers and licences behind the car photos on MarchGear: every photo with its author, licence, source and what we changed.",
  path: "/photo-credits",
});

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;
const link = "underline decoration-ink/20 underline-offset-[3px] transition-colors hover:text-red hover:decoration-red";

type ModelGroup = { slug: string; name: string; photos: PhotoCredit[]; cover: boolean };
type BrandGroup = { slug: string; name: string; models: ModelGroup[]; cover: PhotoCredit | null };

/** The card rendition of an imported photo (see src/lib/image-loader.ts); other uploads have just the one file. */
const thumbOf = (url: string) => (photoAngle(url) ? `${url}?w=${MEDIA_THUMB_WIDTH}` : url);

/** Every /media/<id>/<name> URL inside a value (content blocks, article bodies…). */
const mediaUrlsIn = (value: unknown) => [...JSON.stringify(value ?? null).matchAll(/\/media\/\d{1,10}\/[^"'\s)\\?#]+/g)].map((m) => m[0]);

export default async function PhotoCreditsPage() {
  const cat = await getCatalog();
  const { brands, cars, upcoming, usedCars, dealers, articles, content } = cat;

  // One lookup for every photo the public pages can show.
  const elsewhereUrls = [...new Set([...upcoming.map((u) => u.image), ...usedCars.flatMap((u) => u.images), ...dealers.map((d) => d.image), ...mediaUrlsIn(articles), ...mediaUrlsIn(content)])];
  const credits = await creditsFor([...cars.flatMap((c) => c.images), ...brands.map((b) => b.heroImage), ...elsewhereUrls]);

  const listed = new Set<string>();
  const groups: BrandGroup[] = brands
    .map((b) => {
      const models = cars
        .filter((c) => c.brand === b.slug)
        .map((c) => ({ slug: c.slug, name: c.name, photos: c.images.flatMap((u) => (credits[u] ? [credits[u]] : [])), cover: c.images.includes(b.heroImage) }))
        .filter((m) => m.photos.length > 0)
        .sort((x, y) => x.name.localeCompare(y.name, "en"));
      for (const m of models) for (const p of m.photos) listed.add(p.url);
      // A cover that isn't one of the listed model photos (e.g. its model was unpublished) is listed with the brand.
      const cover = credits[b.heroImage] && !listed.has(b.heroImage) ? credits[b.heroImage] : null;
      if (cover) listed.add(cover.url);
      return { slug: b.slug, name: b.name, models, cover };
    })
    .filter((g) => g.models.length > 0 || g.cover);
  const elsewhere = elsewhereUrls.flatMap((u) => (credits[u] && !listed.has(u) ? [credits[u]] : []));

  const all = [...new Map([...groups.flatMap((g) => [...g.models.flatMap((m) => m.photos), ...(g.cover ? [g.cover] : [])]), ...elsewhere].map((p) => [p.url, p])).values()];
  const licences = [...all.reduce((m, p) => m.set(p.license, (m.get(p.license) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const photographers = new Set(all.map((p) => p.author.toLowerCase())).size;
  const modelCount = groups.reduce((n, g) => n + g.models.length, 0);
  const email = content.site.email;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Photo credits" }]}
        eyebrow="Photo credits"
        title={
          <>
            The photographers <span className="type-editorial font-normal">behind our pictures.</span>
          </>
        }
        description="Our car photos are genuine photos of each model, shared on Wikimedia Commons by their authors under free licences. Here is every one we use, with its author, licence and source. We resize them and convert them to WebP; nothing else is changed."
      >
        {all.length > 0 && (
          <dl className="grid max-w-3xl grid-cols-2 border-t border-line sm:grid-cols-4">
            {[
              ["Photos", all.length.toLocaleString("en-IN")],
              ["Models", modelCount.toLocaleString("en-IN")],
              ["Photographers", photographers.toLocaleString("en-IN")],
              ["Licences", licences.length.toLocaleString("en-IN")],
            ].map(([label, value], i) => (
              <div key={label} className={i % 2 === 1 ? "border-l border-line pl-5 pt-5" : i > 1 ? "pt-5 sm:border-l sm:border-line sm:pl-5" : "pt-5"}>
                <dt className="text-[12px] text-muted">{label}</dt>
                <dd className="mt-1.5 text-[22px] font-semibold num">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </PageHeader>

      <div className="container-x grid grid-cols-1 gap-10 py-12 md:py-16 lg:grid-cols-12 lg:gap-12">
        <aside className="min-w-0 lg:col-span-3">
          <div className="lg:sticky lg:top-24">
            {groups.length > 0 && (
              <nav aria-label="Brands">
                <p className="type-eyebrow text-muted">Brands</p>
                <ul className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:max-h-[52vh] lg:flex-col lg:gap-0 lg:overflow-y-auto lg:px-0">
                  {groups.map((g) => (
                    <li key={g.slug} className="shrink-0">
                      <a
                        href={`#brand-${g.slug}`}
                        className="flex items-center justify-between gap-3 rounded-[3px] border border-line px-3 py-1.5 text-[13px] transition-colors hover:border-ink lg:rounded-none lg:border-0 lg:border-b lg:px-0 lg:py-2 lg:hover:text-red"
                      >
                        <span className="whitespace-nowrap">{g.name}</span>
                        <span className="text-[12px] text-muted num">{g.models.reduce((n, m) => n + m.photos.length, 0) + (g.cover ? 1 : 0)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            {licences.length > 0 && (
              <div className="mt-8 hidden lg:block">
                <p className="type-eyebrow text-muted">Licences</p>
                <ul className="mt-4 space-y-1.5 text-[13px]">
                  {licences.map(([name, n]) => (
                    <li key={name} className="flex justify-between gap-3">
                      <span>{name}</span>
                      <span className="text-muted num">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 space-y-16 lg:col-span-9">
          {groups.length === 0 && elsewhere.length === 0 && (
            <p className="border border-line bg-mist/50 px-6 py-10 text-center text-[14px] text-muted">No third-party photos are in use yet. Models without photos show a placeholder.</p>
          )}

          {groups.map((g) => (
            <section key={g.slug} id={`brand-${g.slug}`} aria-labelledby={`brand-${g.slug}-title`} className="scroll-mt-24">
              <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-ink pb-4">
                <h2 id={`brand-${g.slug}-title`} className="type-h3">
                  <Link href={`/brands/${g.slug}`} className="hover:text-red">
                    {g.name}
                  </Link>
                </h2>
                <p className="text-[13px] text-muted num">
                  {g.models.length} {g.models.length === 1 ? "model" : "models"} · {g.models.reduce((n, m) => n + m.photos.length, 0) + (g.cover ? 1 : 0)} photos
                </p>
              </header>
              {g.models.map((m) => (
                <div key={m.slug} id={m.slug} className="grid scroll-mt-24 grid-cols-1 gap-4 border-b border-line py-7 md:grid-cols-[180px_minmax(0,1fr)] md:gap-8">
                  <div>
                    <Link href={`/cars/${m.slug}`} className="group inline-flex items-start gap-1 text-[15px] font-semibold hover:text-red">
                      {g.name} {m.name}
                      <ArrowUpRight aria-hidden className="mt-0.5 size-3.5 shrink-0 text-red opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                    <p className="mt-1 text-[12.5px] text-muted">
                      {m.photos.length} {m.photos.length === 1 ? "photo" : "photos"}
                      {m.cover && " · the first is also the brand's cover"}
                    </p>
                  </div>
                  <CreditGrid photos={m.photos} />
                </div>
              ))}
              {g.cover && (
                <div className="grid grid-cols-1 gap-4 border-b border-line py-7 md:grid-cols-[180px_minmax(0,1fr)] md:gap-8">
                  <p className="text-[15px] font-semibold">Brand cover</p>
                  <CreditGrid photos={[g.cover]} />
                </div>
              )}
            </section>
          ))}

          {elsewhere.length > 0 && (
            <section aria-labelledby="elsewhere-title">
              <header className="border-b border-ink pb-4">
                <h2 id="elsewhere-title" className="type-h3">
                  Elsewhere on the site
                </h2>
              </header>
              <div className="py-7">
                <CreditGrid photos={elsewhere} />
              </div>
            </section>
          )}

          <section aria-labelledby="about-title" className="grid grid-cols-1 gap-8 border-t border-line pt-10 md:grid-cols-2">
            <div>
              <h2 id="about-title" className="text-[15px] font-semibold">
                About these licences
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-muted">
                CC BY and CC BY-SA photos may be used by anyone, including commercially, as long as the author and licence are credited and changes are indicated. CC BY-SA also asks that
                adapted versions are shared under the same licence: our resized copies are available under the photo&apos;s own licence. CC0 and public-domain photos carry no conditions;
                we credit them anyway. Each licence name links to its full terms.
              </p>
            </div>
            <div>
              <h2 className="text-[15px] font-semibold">Other photography</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-muted">
                Some other pictures (news stories, banners and a few models still waiting for genuine photos) are stock photography from Unsplash, used under the Unsplash Licence,
                which doesn&apos;t require credit. Spotted a wrong photo, or a credit that&apos;s missing something?{" "}
                <a href={`mailto:${email}?subject=${encodeURIComponent("Photo credits")}`} className={link}>
                  Email {email}
                </a>
                .
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

/**
 * Thumbnails with their credits. Hundreds of them, so the markup is kept lean: a plain lazy <img> of the card
 * rendition (no srcset in the HTML or the RSC payload) and link styles set once on the list.
 */
function CreditGrid({ photos }: { photos: PhotoCredit[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 text-[12px] leading-snug text-muted sm:grid-cols-3 xl:grid-cols-4 [&_a]:underline [&_a]:decoration-ink/20 [&_a]:underline-offset-[3px] [&_a:hover]:text-red [&_a:hover]:decoration-red">
      {photos.map((p) => {
        const change = changeLabel(p.note);
        return (
          <li key={p.url} className="min-w-0">
            <div className="relative aspect-[4/3] overflow-hidden bg-mist">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbOf(p.url)} alt={p.alt ?? ""} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
            </div>
            <p className="mt-2.5 break-words font-medium text-ink">
              {p.authorUrl ? (
                <a href={p.authorUrl} {...ext}>
                  {p.author}
                </a>
              ) : (
                p.author
              )}
            </p>
            <p className="mt-0.5">
              {p.licenseUrl ? (
                <a href={p.licenseUrl} target="_blank" rel="license noopener noreferrer">
                  {p.license}
                </a>
              ) : (
                p.license
              )}
              {change && ` · ${change}`}
            </p>
            <p className="mt-0.5">
              <a href={p.sourceUrl} {...ext}>
                {sourceName(p.sourceUrl)}
              </a>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
