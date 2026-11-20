import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { IMG } from "@/data/images";
import { authorProfile } from "@/data/editorial-extra";
import { PageHeader } from "@/components/ui/page-header";
import { Eyebrow } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { Counter, Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { InitialsAvatar, shortTitle, storyHref } from "@/components/editorial/primitives";

export const metadata: Metadata = {
  title: "About",
  description:
    "March Gear is an independent automotive discovery platform for India — expert road tests, moderated owner reviews and clear tools to help you choose with confidence.",
};

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

/** "Four specialists", "One specialist", "14 specialists" — follows the authors in the admin panel. */
const teamSize = (n: number) => `${NUMBER_WORDS[n] ?? n} specialist${n === 1 ? "" : "s"}`;

export default async function AboutPage() {
  const cat = await getCatalog();
  const { timeline, stats, values, principles } = cat.content.about;
  const stories = cat.articles;
  return (
    <>
      <PageHeader
        eyebrow="About March Gear"
        title={
          <>
            An independent guide to <span className="type-editorial">the cars India drives.</span>
          </>
        }
        description="Expert road tests, honest owner voices and clear tools that help you choose, compare and buy with confidence."
        crumbs={[{ label: "About" }]}
        image={IMG.heroSilhouette}
      />

      {/* Story */}
      <section aria-labelledby="story-heading" className="container-x py-14 md:py-20">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:col-span-5">
            <Eyebrow>Our story</Eyebrow>
            <h2 id="story-heading" className="type-h2 mt-5 text-balance">
              Buying a car had become harder than it needed to be.
            </h2>
          </Reveal>
          <div className="space-y-6 text-[16px] leading-[1.75] text-ink/80 lg:col-span-6 lg:col-start-7 lg:pt-12">
            <p className="type-lead text-ink">
              March Gear began in 2019 as a weekly email for friends who kept asking the same question: <em className="type-editorial text-[1.15em]">which car should I buy?</em>
            </p>
            <p>
              Seven years on, it is an independent automotive discovery platform. We review every new car on Indian roads with our own team, publish
              moderated reviews from owners, and build tools that turn variant lists and on-road prices into decisions you can make with confidence.
            </p>
            <p>
              We are not owned by a carmaker, a dealer group or a lender. That independence shapes everything we publish — and it is why our scores
              mean something.
            </p>
          </div>
        </div>

        <ol className="mt-16 grid grid-cols-1 border-t border-line sm:grid-cols-2 md:mt-24 lg:grid-cols-4">
          {timeline.map((t, i) => (
            <li key={i} className="border-b border-line py-8 sm:pr-8 sm:even:pl-8 lg:border-b-0 lg:border-l lg:px-8 lg:first:border-l-0 lg:first:pl-0 lg:even:pl-8">
              <p className="font-display text-[2.5rem] font-semibold leading-none tracking-[-0.04em] num [font-stretch:110%]">{t.year}</p>
              <p className="type-h4 mt-6">{t.title}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{t.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Photo band */}
      <section aria-label="On the road" className="relative isolate flex h-[60vh] max-h-[720px] min-h-[380px] items-end overflow-hidden bg-ink text-white">
        <Image
          src={IMG.autumnRoad}
          alt="An empty road winding through hills"
          fill
          sizes="100vw"
          className="-z-10 object-cover opacity-75"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
        <div className="container-x pb-12 md:pb-16">
          <Reveal>
            <p className="type-editorial max-w-3xl text-balance text-[2rem] leading-[1.08] md:text-[3.25rem]">
              “Every verdict is earned on the road — not on a spec sheet.”
            </p>
            <p className="type-eyebrow mt-6 text-white/55">The March Gear road-test charter</p>
          </Reveal>
        </div>
      </section>

      {/* Numbers */}
      <section aria-label="March Gear in numbers" className="container-x py-12 md:py-16">
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={i}
              className={
                "flex flex-col border-t border-line pb-8 pt-6 lg:border-l lg:border-t-0 lg:px-8 lg:pb-2 lg:pt-0 lg:first:border-l-0 lg:first:pl-0 " +
                (i % 2 === 1 ? "pl-5 lg:pl-8" : "pr-5")
              }
            >
              <dt className="mt-4 text-[14px] font-medium">{s.label}</dt>
              <dd className="order-first whitespace-nowrap font-display text-[2rem] font-semibold leading-none tracking-[-0.04em] [font-stretch:110%] sm:text-[2.75rem] lg:text-[3rem] xl:text-[3.5rem]">
                <Counter to={s.value} decimals={s.decimals} prefix={s.prefix} suffix={s.suffix} className="num" />
              </dd>
              <dd className="mt-1 text-[12.5px] text-muted">{s.note}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-[11.5px] text-muted">Figures are illustrative demo data.</p>
      </section>

      {/* Mission & values */}
      <section aria-labelledby="mission-heading" className="border-t border-line py-14 md:py-20">
        <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <Reveal className="lg:sticky lg:top-28">
              <Eyebrow>Our mission</Eyebrow>
              <h2 id="mission-heading" className="type-h2 mt-5 text-balance">
                Help every buyer choose with <span className="type-editorial">confidence.</span>
              </h2>
              <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-muted">
                A car is one of the biggest purchases most families make. It deserves research that is rigorous, readable and on your side.
              </p>
            </Reveal>
          </div>
          <RevealGroup className="grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
            {values.map((v, i) => (
              <RevealItem key={i} className="border-t border-line py-8 md:py-10">
                <p className="type-eyebrow text-muted num">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="type-h3 mt-5">{v.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{v.body}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* Team */}
      <section id="team" aria-labelledby="team-heading" className="bg-mist py-14 md:py-20">
        <div className="container-x">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Eyebrow>The editorial team</Eyebrow>
              <h2 id="team-heading" className="type-h2 mt-5 text-balance">
                The people behind <span className="type-editorial">the verdicts</span>
              </h2>
            </div>
            <p className="max-w-md text-[15px] leading-relaxed text-muted lg:text-right">
              {teamSize(cat.authors.length)}, more than 2,000 cars driven between them, and a shared rule: if we wouldn&apos;t tell a friend, we don&apos;t publish it.
            </p>
          </div>

          <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 md:mt-16 lg:grid-cols-4">
            {cat.authors.map((a) => {
              const profile = authorProfile(a.id, cat);
              const latest = stories.find((s) => s.authorId === a.id);
              return (
                <li key={a.id} className="flex flex-col bg-white p-6 md:p-7">
                  <div className="flex items-start justify-between">
                    <InitialsAvatar name={a.name} size="xl" tone="ink" />
                    {profile.joined && <span className="text-[11.5px] text-muted num">Since {profile.joined}</span>}
                  </div>
                  <h3 className="type-h3 mt-8">{a.name}</h3>
                  <p className="mt-1 text-[13px] text-muted">
                    {a.role}
                    {profile.base && ` · ${profile.base}`}
                  </p>
                  {(profile.beat || profile.bio) && (
                    <div className="mt-5 space-y-2 border-t border-line pt-5">
                      {profile.beat && <p className="text-[12px] font-medium text-ink">{profile.beat}</p>}
                      {profile.bio && <p className="text-[14px] leading-relaxed text-muted">{profile.bio}</p>}
                    </div>
                  )}
                  {latest && (
                    <div className="mt-auto pt-6">
                      <Link
                        href={storyHref(latest)}
                        className="group/latest flex items-start justify-between gap-3 border-t border-line pt-5 text-[13px] font-medium leading-snug"
                      >
                        <span>
                          <span className="block text-[11.5px] font-normal text-muted">Latest story</span>
                          <span className="mt-1 block transition-colors duration-[250ms] group-hover/latest:text-red">{shortTitle(latest.title, 56)}</span>
                        </span>
                        <ArrowUpRight className="mt-4 size-4 shrink-0 text-red" aria-hidden />
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Independence */}
      <section aria-labelledby="independence-heading" className="bg-ink py-20 text-white md:py-28">
        <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:col-span-5">
            <Eyebrow tone="light">Editorial independence</Eyebrow>
            <h2 id="independence-heading" className="type-h2 mt-5 text-balance">
              Our scores are <span className="type-editorial">not for sale.</span>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/60">
              March Gear is funded by advertising and dealer partnerships. These principles keep that money a long way from our verdicts.
            </p>
          </Reveal>
          <ol className="border-t border-white/10 lg:col-span-6 lg:col-start-7">
            {principles.map((p, i) => (
              <li key={i} className="grid grid-cols-[44px_1fr] gap-4 border-b border-white/10 py-7 md:grid-cols-[64px_1fr] md:py-8">
                <span aria-hidden className="font-display text-[1.75rem] font-semibold leading-none tracking-[-0.04em] text-white/25 num md:text-[2rem]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="type-h4">{p.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-white/60">{p.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section aria-label="Get started" className="container-x py-14 md:py-20">
        <div className="grid grid-cols-1 border border-line lg:grid-cols-12">
          <div className="border-b border-line p-7 sm:p-10 md:p-14 lg:col-span-7 lg:border-b-0 lg:border-r">
            <Eyebrow>Start exploring</Eyebrow>
            <h2 className="type-h2 mt-5 max-w-xl text-balance">
              Find the car that <span className="type-editorial">moves you.</span>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              Browse every new car on sale in India, compare up to four side by side, or start with our expert verdicts.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button href="/new-cars" variant="dark" arrow>
                Browse new cars
              </Button>
              <Button href="/reviews" variant="outline">
                Read expert reviews
              </Button>
            </div>
          </div>
          <div className="flex flex-col p-7 sm:p-10 md:p-14 lg:col-span-5">
            <Eyebrow>Work with us</Eyebrow>
            <h3 className="type-h3 mt-5 text-balance">Press, partnerships or a correction to report?</h3>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">Our team replies to every message within one working day.</p>
            <div className="mt-9 lg:mt-auto lg:pt-9">
              <Button href="/contact" variant="outline" arrow>
                Contact the team
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
