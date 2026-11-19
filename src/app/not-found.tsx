import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { IMG } from "@/data/images";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/section-heading";
import { SearchLauncher } from "@/components/account/search-launcher";
import { SiteShell } from "@/components/layout/site-shell";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you were looking for has moved or no longer exists.",
};

const DESTINATIONS = [
  { href: "/new-cars", title: "New cars", body: "Every model on sale in India, with indicative on-road prices." },
  { href: "/used-cars", title: "Used cars", body: "Verified pre-owned cars from dealers and owners." },
  { href: "/electric-cars", title: "Electric cars", body: "Range, charging and running costs, demystified." },
  { href: "/tools", title: "Tools", body: "EMI, loan, mileage and true-cost calculators." },
];

const READING = "000404";

// Handles unmatched URLs too, so it brings its own site chrome.
export default function NotFound() {
  return (
    <SiteShell>
      <section className="border-b border-line">
        <div className="container-x grid grid-cols-1 gap-14 py-14 md:py-24 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="lg:col-span-7">
            <Eyebrow>Error 404 · Page not found</Eyebrow>

            {/* Trip meter reading 404 — decorative; the eyebrow carries the meaning. */}
            <div aria-hidden className="mt-10 inline-flex items-stretch gap-[3px] bg-ink p-[3px]">
              {READING.split("").map((digit, i) => (
                <span
                  key={i}
                  className={cn(
                    "relative flex h-14 w-10 items-center justify-center font-mono text-[28px] font-medium text-white md:h-20 md:w-14 md:text-[42px]",
                    "after:absolute after:inset-x-0 after:top-1/2 after:h-px after:bg-black/40",
                    i === READING.length - 1 ? "bg-red" : "bg-ink-3",
                  )}
                >
                  {digit}
                </span>
              ))}
              <span className="flex items-end px-2.5 pb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/50">km</span>
            </div>

            <h1 className="type-display mt-10">Wrong turn.</h1>
            <p className="type-lead mt-6 max-w-xl text-muted">
              The page you were looking for has moved, been sold, or never rolled off the line.{" "}
              <span className="type-editorial text-ink">Let&apos;s reroute.</span>
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchLauncher />
              <Button href="/" variant="dark" size="lg" arrow>
                Back to home
              </Button>
            </div>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden bg-ink sm:aspect-[16/10] lg:col-span-5 lg:aspect-[4/5]">
            <Image
              src={IMG.cityTaillights}
              alt="Tail-lights streaking through a city at night"
              fill
              preload
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover opacity-90"
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white md:p-7">
              <div>
                <p className="type-eyebrow text-white/60">Recalculating route</p>
                <p className="type-h4 mt-2">You&apos;re slightly off the map.</p>
              </div>
              <span aria-hidden className="mb-1 size-2 shrink-0 rounded-full bg-red" />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="destinations-heading" className="py-12 md:py-16">
        <div className="container-x">
          <Eyebrow>Popular destinations</Eyebrow>
          <h2 id="destinations-heading" className="type-h3 mt-4">
            Where most drivers were headed
          </h2>
          <ul className="mt-10 grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {DESTINATIONS.map((d, i) => (
              <li key={d.href} className="bg-white">
                <Link href={d.href} className="group/dest flex h-full flex-col p-6 transition-colors duration-[400ms] hover:bg-mist md:p-8">
                  <span className="font-mono text-[11.5px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span className="mt-10 flex items-center justify-between gap-4">
                    <span className="type-h3">{d.title}</span>
                    <ArrowUpRight
                      aria-hidden
                      className="size-5 shrink-0 text-red transition-transform duration-[250ms] group-hover/dest:-translate-y-0.5 group-hover/dest:translate-x-0.5"
                    />
                  </span>
                  <span className="mt-2 text-[14px] leading-relaxed text-muted">{d.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </SiteShell>
  );
}
