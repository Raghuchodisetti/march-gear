import type { Metadata } from "next";
import Image from "next/image";
import { BadgeCheck, Banknote, Car, Clock, FileText, Handshake, Phone, Quote, ShieldCheck, Timer, Wrench, type LucideIcon } from "lucide-react";
import type { SellIcon } from "@/content/blocks/sell";
import { IMG } from "@/data/images";
import { getCatalog } from "@/server/catalog";
import { formatPrice } from "@/lib/format";
import { Accordion } from "@/components/ui/accordion";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Carousel } from "@/components/ui/carousel";
import { Counter, Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { Eyebrow, SectionHeading } from "@/components/ui/section-heading";
import { SellFlow } from "@/components/valuation/sell-flow";
import { EnquiryButton } from "@/components/used/enquiry-button";

export const metadata: Metadata = {
  title: "Sell your car — instant price, paid in 24 hours",
  description:
    "Get an instant indicative price for your car, book a free 200-point doorstep inspection and get paid before pick-up. RC transfer and loan closure handled.",
};

const BENEFIT_ICONS: Record<SellIcon, LucideIcon> = {
  banknote: Banknote,
  wrench: Wrench,
  timer: Timer,
  file: FileText,
  shield: ShieldCheck,
  handshake: Handshake,
  clock: Clock,
  car: Car,
  badge: BadgeCheck,
  phone: Phone,
};

export default async function SellCarPage() {
  const { stats, steps, benefits, testimonials, faqs } = (await getCatalog()).content.sell;
  return (
    <>
      {/* Hero + instant valuation */}
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <Image
          src={IMG.signing}
          alt=""
          fill
          preload
          sizes="100vw"
          className="-z-10 animate-kenburns object-cover opacity-40"
          style={{ objectPosition: "50% 40%" }}
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/80 to-ink/40" />
        <div className="container-x grid grid-cols-1 gap-12 pb-16 pt-8 md:pb-20 md:pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:gap-16 lg:pb-24 xl:grid-cols-[minmax(0,1fr)_540px]">
          <div className="flex min-w-0 flex-col">
            <Breadcrumbs items={[{ label: "Sell your car" }]} tone="light" />
            <Reveal className="mt-14 md:mt-20 lg:mt-24">
              <Eyebrow tone="light">Sell your car</Eyebrow>
              <h1 className="type-h1 mt-6 max-w-2xl text-balance">
                Sold in a day. <span className="type-editorial">Paid</span> before it leaves your driveway.
              </h1>
              <p className="type-lead mt-6 max-w-xl text-white/70">
                An instant indicative price, a free 200-point inspection at your door, and the full amount in your account
                before pick-up. We handle the RC transfer and any outstanding loan.
              </p>
            </Reveal>
            <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-white/15 pt-8 sm:grid-cols-4 lg:mt-auto lg:pt-10">
              {stats.map((s, i) => (
                <div key={i} className="flex flex-col-reverse justify-end">
                  <dt className="mt-2 text-[12.5px] leading-snug text-white/55">{s.label}</dt>
                  <dd className="type-h3 num">
                    <Counter to={s.value} decimals={s.decimals} prefix={s.prefix} suffix={s.suffix} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div id="valuation" className="min-w-0 scroll-mt-24 lg:pt-14">
            <SellFlow />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 py-14 md:py-20">
        <div className="container-x">
          <SectionHeading
            eyebrow="How it works"
            title={
              <span id="how-title">
                Four steps. <span className="type-editorial">One</span> visit.
              </span>
            }
            description="No listings to manage, no strangers on test drives, no haggling. Most sellers are paid within 24 hours of their inspection."
          />
          <RevealGroup role="list" className="mt-14 grid grid-cols-1 md:mt-20 lg:grid-cols-4 lg:border-t lg:border-ink">
            {steps.map((s, i) => (
              <RevealItem
                key={i}
                role="listitem"
                className="relative border-l border-line pb-12 pl-8 last:pb-0 lg:border-l-0 lg:pb-0 lg:pl-0 lg:pr-10 lg:pt-10"
              >
                <span aria-hidden className="absolute -left-[4.5px] top-1.5 size-2 rounded-full bg-ink lg:-top-[4.5px] lg:left-0" />
                <span className="font-display text-[3.25rem] font-semibold leading-none tracking-[-0.04em] text-ink/10 [font-stretch:110%] num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="type-h3 mt-5">{s.title}</h3>
                <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted">{s.body}</p>
                <p className="mt-5 inline-flex items-center gap-2 text-[12.5px] font-medium text-ink">
                  <Clock className="size-3.5 text-red" aria-hidden /> {s.meta}
                </p>
              </RevealItem>
            ))}
          </RevealGroup>
          <div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-line pt-8">
            <Button href="#valuation" arrow>
              Get my instant price
            </Button>
            <EnquiryButton kind="inspection" subject="Free doorstep inspection" variant="outline">
              Book an inspection directly
            </EnquiryButton>
          </div>
        </div>
      </section>

      {/* Why sell with us */}
      <section aria-labelledby="why-title" className="bg-mist py-14 md:py-20">
        <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-[96px]">
            <div className="relative aspect-[4/5] overflow-hidden bg-line">
              <Image
                src={IMG.mechanic}
                alt="An engineer inspecting a car's engine bay during a pre-purchase check"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-ink/75 p-5 text-white backdrop-blur-sm md:p-6">
                <p className="type-eyebrow text-white/60">Inspection standard</p>
                <p className="mt-2 text-[15px] font-medium">200 checks · 45 minutes · report shared with you</p>
              </div>
            </div>
            </div>
          </div>
          <div className="lg:col-span-7">
            <Reveal>
              <Eyebrow>Why March Gear</Eyebrow>
              <h2 id="why-title" className="type-h2 mt-5 max-w-xl text-balance">
                The easiest way to sell a car in India.
              </h2>
              <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted">
                We buy the car ourselves, so there&apos;s no waiting for a buyer and nothing to negotiate with strangers.
              </p>
            </Reveal>
            <ul className="mt-12 grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2">
              {benefits.map((b, i) => {
                const Icon = BENEFIT_ICONS[b.icon];
                return (
                  <li key={i} className="bg-white p-6 md:p-7">
                    <Icon className="size-5 text-ink" aria-hidden />
                    <h3 className="type-h4 mt-6">{b.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-muted">{b.body}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section aria-labelledby="stories-title" className="bg-ink py-20 text-white md:py-28">
        <div className="container-x">
          <Carousel
            tone="light"
            label="seller stories"
            itemClassName="w-[86%] sm:w-[60%] lg:w-[42%] xl:w-[36%]"
            headerSlot={
              <div>
                <Eyebrow tone="light">Seller stories</Eyebrow>
                <h2 id="stories-title" className="type-h2 mt-5 max-w-xl text-balance">
                  Sold, paid, and <span className="type-editorial">done</span>.
                </h2>
              </div>
            }
          >
            {testimonials.map((t, i) => (
              <figure key={i} className="flex h-full flex-col border border-white/12 p-7 md:p-9">
                <Quote className="size-6 text-red" aria-hidden />
                <blockquote className="mt-6 flex-1 text-[1.1875rem] leading-[1.5] tracking-[-0.01em] text-white/90 md:text-[1.3125rem]">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-10 flex items-end justify-between gap-4 border-t border-white/12 pt-5">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium">{t.name}</p>
                    <p className="mt-0.5 truncate text-[12.5px] text-white/50">
                      {t.city} · {t.car}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Sold for</p>
                    <p className="mt-0.5 text-[15px] font-semibold num">{formatPrice(t.soldFor)}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </Carousel>
        </div>
      </section>

      {/* FAQs */}
      <section aria-labelledby="faq-title" className="py-14 md:py-20">
        <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-[96px]">
              <Eyebrow>Questions</Eyebrow>
              <h2 id="faq-title" className="type-h2 mt-5 text-balance">
                Before you sell.
              </h2>
              <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-muted">
                Still unsure about documents, loans or timing? An advisor can walk you through it.
              </p>
              <EnquiryButton kind="callback" subject="Selling my car" variant="dark" className="mt-7">
                Request a callback
              </EnquiryButton>
            </div>
          </div>
          <div className="lg:col-span-8">
            <Accordion defaultOpen={["faq-0"]} items={faqs.map((f, i) => ({ id: `faq-${i}`, title: f.q, content: f.a }))} />
          </div>
        </div>
      </section>

      {/* Closing band */}
      <section className="border-t border-line bg-mist">
        <div className="container-x flex flex-col gap-8 py-14 md:flex-row md:items-center md:justify-between md:py-16">
          <div>
            <p className="type-h3 max-w-xl text-balance">Your price is sixty seconds away.</p>
            <p className="mt-2 text-[14px] text-muted">Prefer a number before you commit? Try the full valuation tool.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href="#valuation" arrow>
              Start valuation
            </Button>
            <Button href="/tools/car-valuation" variant="outline">
              Detailed valuation
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
