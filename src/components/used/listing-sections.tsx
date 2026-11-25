import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, RotateCcw, ShieldCheck, Wrench } from "lucide-react";
import { IMG } from "@/data/images";
import { Button } from "@/components/ui/button";
import { DemoNote } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";

/** Suspense fallback for the listing: mirrors the sidebar + grid geometry. */
export function UsedListingSkeleton() {
  return (
    <div className="container-x pb-14 md:pb-20" aria-busy="true" aria-label="Loading cars">
      <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12 xl:gap-16">
        <div className="hidden space-y-8 pt-10 lg:block">
          <div className="skeleton h-6 w-24" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="space-y-3 border-t border-line pt-6">
              <div className="skeleton h-3 w-20" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }, (_, j) => (
                  <div key={j} className="skeleton h-8 w-20 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className="grid grid-cols-2 gap-2 py-3 lg:hidden">
            <div className="skeleton h-12" />
            <div className="skeleton h-12" />
          </div>
          <div className="flex items-end justify-between border-b border-line pb-5 pt-8 lg:pt-10">
            <div className="skeleton h-10 w-32" />
            <div className="skeleton hidden h-12 w-64 lg:block" />
          </div>
          <div className="grid grid-cols-1 gap-5 pt-8 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="border border-line">
                <div className="skeleton aspect-[3/2]" />
                <div className="space-y-3 p-5">
                  <div className="skeleton h-3 w-24" />
                  <div className="skeleton h-5 w-40" />
                  <div className="skeleton h-3 w-32" />
                  <div className="skeleton mt-6 h-6 w-28" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const PROMISES = [
  { icon: Wrench, title: "200-point inspection", body: "Engine to electricals, by certified engineers" },
  { icon: RotateCcw, title: "7-day return", body: "Changed your mind? Full refund, no questions" },
  { icon: ShieldCheck, title: "1-year warranty", body: "Engine and gearbox cover on every verified car" },
];

/** Slim explainer band for the verified programme. */
export function VerifiedStrip() {
  return (
    <section aria-labelledby="verified-strip-title" className="border-b border-line bg-mist">
      <div className="container-x">
        <div className="flex flex-col gap-5 py-6 lg:flex-row lg:items-center lg:gap-10 lg:py-5">
          <div className="flex shrink-0 items-center gap-3">
            <BadgeCheck className="size-5 text-red" aria-hidden />
            <h2 id="verified-strip-title" className="type-eyebrow text-ink">
              Verified inventory
            </h2>
          </div>
          <ul tabIndex={0} aria-label="Our promises" className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-3 md:gap-0 md:overflow-visible md:px-0 lg:flex-1">
            {PROMISES.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="flex w-[78%] shrink-0 snap-start items-start gap-3 border border-line bg-white p-4 md:w-auto md:border-0 md:border-l md:bg-transparent md:px-6 md:py-1"
              >
                <Icon className="mt-0.5 size-[18px] shrink-0 text-ink/70" aria-hidden />
                <div>
                  <p className="text-[14px] font-medium text-ink">{title}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-end lg:gap-1">
            <Link
              href="/used-cars?verified=1"
              scroll={false}
              className="group/v inline-flex items-center gap-1.5 text-[13px] font-medium text-ink"
            >
              Show verified only
              <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover/v:-translate-y-0.5 group-hover/v:translate-x-0.5" />
            </Link>
            <DemoNote>Demo programme · terms illustrative</DemoNote>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Full-bleed dark banner that hands sellers over to /sell-car. */
export function SellBanner() {
  return (
    <section className="bg-ink text-white" aria-labelledby="sell-banner-title">
      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="relative aspect-[16/10] overflow-hidden lg:aspect-auto lg:min-h-[520px]">
          <Image
            src={IMG.aerialLot}
            alt="Rows of pre-owned cars waiting for inspection, seen from above"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="flex items-center">
          <Reveal className="w-full px-5 py-16 md:px-12 md:py-20 xl:px-20">
            <Eyebrow tone="light">Sell your car</Eyebrow>
            <h2 id="sell-banner-title" className="type-h2 mt-5 max-w-xl text-balance">
              A firm offer in a day. <span className="type-editorial">Paid</span> before pick-up.
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/65">
              Get an instant indicative price, then a free doorstep inspection. We handle the RC transfer and any
              outstanding loan.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button href="/sell-car" arrow>
                Sell your car
              </Button>
              <Button href="/tools/car-valuation" variant="outline-light">
                Check its value
              </Button>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 border-t border-white/15 pt-6">
              {[
                ["24 hrs", "to payment"],
                ["₹0", "fees"],
                ["140+", "hubs"],
              ].map(([v, l]) => (
                <div key={l} className="flex flex-col-reverse justify-end">
                  <dt className="mt-1 text-[12px] text-white/50">{l}</dt>
                  <dd className="type-h3 num">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
