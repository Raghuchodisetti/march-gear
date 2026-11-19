import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { articles, getAuthor } from "@/data/news";
import { formatDate } from "@/lib/format";
import { topicLabel } from "@/components/editorial/primitives";
import { cn } from "@/lib/utils";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";

export function AutomotiveStories() {
  const written = articles.filter((a) => a.category !== "Video");
  const videos = articles.filter((a) => a.category === "Video");
  const lead = written.find((a) => a.category === "First Drive") ?? written[0];
  const side = written.filter((a) => a.slug !== lead.slug && ["Industry", "Expert Review", "News"].includes(a.category)).slice(0, 3);
  const author = getAuthor(lead.authorId);

  return (
    <section aria-labelledby="stories-title" className="py-20 md:py-28">
      <div className="container-x">
        <div className="flex flex-col gap-6 border-b border-ink pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow>Automotive stories</Eyebrow>
            <h2 id="stories-title" className="type-h1 mt-5">
              Stories that <span className="type-editorial">drive</span> us.
            </h2>
          </div>
          <nav aria-label="Story categories" className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
            {(["News", "Expert Review", "First Drive", "Industry", "Video"] as const).map((c) => (
              <Link key={c} href={`/news?category=${encodeURIComponent(c)}`} className="text-muted transition-colors hover:text-ink">
                {topicLabel(c)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <article className="group/lead">
              <Link href={`/news/${lead.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-mist md:aspect-[16/11]">
                <Image src={lead.image} alt="" fill sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-premium)] group-hover/lead:scale-[1.03]" style={{ objectPosition: "50% 70%" }} />
              </Link>
              <div className="mt-7 grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr] md:gap-10">
                <div className="flex gap-6 md:flex-col md:gap-2">
                  <p className="type-eyebrow text-red">{topicLabel(lead.category)}</p>
                  <p className="text-[13px] text-muted num">{formatDate(lead.publishedOn)}</p>
                  <p className="text-[13px] text-muted">{lead.readMinutes} min read</p>
                </div>
                <div>
                  <h3 className="type-h2 text-balance">
                    <Link href={`/news/${lead.slug}`} className="transition-colors hover:text-red">
                      {lead.title}
                    </Link>
                  </h3>
                  <p className="mt-4 text-[16px] leading-relaxed text-muted">{lead.dek}</p>
                  <p className="mt-5 text-[13px]">
                    By <span className="font-medium">{author.name}</span> <span className="text-muted">· {author.role}</span>
                  </p>
                </div>
              </div>
            </article>
          </Reveal>

          <RevealGroup className="flex flex-col lg:col-span-5" gap={0.1}>
            {side.map((a, i) => (
              <RevealItem key={a.slug}>
                <article className={cn("group/row grid grid-cols-[1fr_112px] gap-5 border-b border-line py-6 md:grid-cols-[1fr_148px]", i === 0 && "pt-0")}>
                  <div>
                    <p className="type-eyebrow text-muted">{topicLabel(a.category)}</p>
                    <h3 className="type-h4 mt-2.5 text-[17px] leading-snug md:text-lg">
                      <Link href={`/news/${a.slug}`} className="transition-colors group-hover/row:text-red">
                        {a.title}
                      </Link>
                    </h3>
                    <p className="mt-3 text-[12.5px] text-muted num">
                      {formatDate(a.publishedOn)} · {a.readMinutes} min
                    </p>
                  </div>
                  <Link href={`/news/${a.slug}`} tabIndex={-1} aria-hidden className="relative aspect-square overflow-hidden bg-mist">
                    <Image src={a.image} alt="" fill sizes="148px" className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/row:scale-110" />
                  </Link>
                </article>
              </RevealItem>
            ))}
            <RevealItem className="mt-8">
              <TextLink href="/news">All stories</TextLink>
            </RevealItem>
          </RevealGroup>
        </div>

        {/* Video reviews */}
        <div className="mt-20">
          <div className="flex items-center justify-between">
            <p className="type-eyebrow flex items-center gap-3">
              <span aria-hidden className="h-px w-6 bg-red" /> Video reviews
            </p>
            <TextLink href="/news?category=Video">Watch more</TextLink>
          </div>
          <RevealGroup className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2" gap={0.12}>
            {videos.map((v) => (
              <RevealItem key={v.slug}>
                <Link href={`/news/${v.slug}`} className="group/vid relative block aspect-video overflow-hidden bg-ink text-white">
                  <Image src={v.image} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover opacity-75 transition-[transform,opacity] duration-[900ms] ease-[var(--ease-premium)] group-hover/vid:scale-[1.04] group-hover/vid:opacity-90" />
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/10 to-transparent" />
                  <span className="absolute left-1/2 top-1/2 inline-flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-ink transition-transform duration-[400ms] ease-[var(--ease-premium)] group-hover/vid:scale-110">
                    <Play className="ml-0.5 size-5 fill-current" aria-hidden />
                  </span>
                  <span className="absolute right-4 top-4 bg-ink/70 px-2 py-1 text-[11.5px] font-medium backdrop-blur-sm num">{v.videoDuration}</span>
                  <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
                    <h3 className="type-h3 max-w-lg text-balance">{v.title.replace(/^Video: /, "")}</h3>
                  </div>
                </Link>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}
