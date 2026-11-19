import Image from "next/image";
import Link from "next/link";
import {
  Armchair,
  ArrowUpRight,
  Baby,
  CarFront,
  Check,
  Coffee,
  HandCoins,
  KeyRound,
  Package,
  ParkingMeter,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Truck,
  Wifi,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Dealer } from "@/types";
import type { DealerReview } from "@/lib/catalog";
import { getCatalog } from "@/server/catalog";
import { formatDate } from "@/lib/format";
import { Stars } from "@/components/ui/rating";
import { Eyebrow } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";

/* ── Facilities ───────────────────────────────────────────────── */

const FACILITY_ICONS: [RegExp, LucideIcon][] = [
  [/lounge|café/i, Coffee],
  [/wi-?fi/i, Wifi],
  [/\bev\b|charger/i, PlugZap],
  [/kids/i, Baby],
  [/valet|parking/i, ParkingMeter],
  [/test drive/i, CarFront],
  [/pick-up|drop/i, Truck],
  [/detailing/i, Sparkles],
  [/finance/i, HandCoins],
  [/insurance/i, ShieldCheck],
  [/viewing suite/i, Armchair],
  [/delivery/i, KeyRound],
  [/accessories/i, Package],
  [/service|body shop/i, Wrench],
];

const facilityIcon = (label: string) => FACILITY_ICONS.find(([re]) => re.test(label))?.[1] ?? Check;

export function FacilityGrid({ items }: { items: string[] }) {
  return (
    <ul className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3">
      {items.map((f) => {
        const Icon = facilityIcon(f);
        return (
          <li key={f} className="flex min-h-[108px] flex-col justify-between gap-4 bg-white p-5">
            <Icon className="size-5 text-ink/70" aria-hidden />
            <span className="text-[13.5px] font-medium leading-snug text-ink">{f}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Reviews ──────────────────────────────────────────────────── */

/** Deterministic star distribution consistent with the headline rating. */
function distribution(rating: number) {
  const five = Math.round(Math.min(88, Math.max(40, (rating - 3.6) * 62)));
  const rest = 100 - five;
  const four = Math.round(rest * 0.62);
  const three = Math.round((rest - four) * 0.55);
  const two = Math.round((rest - four - three) * 0.45);
  const one = Math.max(0, rest - four - three - two);
  return [
    { stars: 5, pct: five },
    { stars: 4, pct: four },
    { stars: 3, pct: three },
    { stars: 2, pct: two },
    { stars: 1, pct: one },
  ];
}

export function DealerReviews({ dealer, reviews }: { dealer: Dealer; reviews: DealerReview[] }) {
  return (
    <section aria-labelledby="reviews-title" className="bg-mist py-14 md:py-20">
      <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-[96px]">
            <Eyebrow>Customer reviews</Eyebrow>
            <h2 id="reviews-title" className="type-h2 mt-5 text-balance">
              What customers <span className="type-editorial">say</span>.
            </h2>
            <div className="mt-10 flex items-end gap-5">
              <p className="font-display text-[4.5rem] font-semibold leading-[0.85] tracking-[-0.04em] [font-stretch:110%]">
                {dealer.rating.toFixed(1)}
              </p>
              <div className="pb-1">
                <Stars value={dealer.rating} size={16} />
                <p className="mt-1.5 text-[13px] text-muted num">{dealer.reviewCount.toLocaleString("en-IN")} verified reviews</p>
              </div>
            </div>
            <dl className="mt-8 space-y-2.5">
              {distribution(dealer.rating).map((row) => (
                <div key={row.stars} className="grid grid-cols-[28px_minmax(0,1fr)_40px] items-center gap-3 text-[12.5px]">
                  <dt className="text-muted num">{row.stars} ★</dt>
                  <dd className="h-[3px] bg-line" aria-hidden>
                    <div className="h-full bg-ink" style={{ width: `${row.pct}%` }} />
                  </dd>
                  <dd className="text-right text-muted num">{row.pct}%</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="lg:col-span-8">
          {reviews.length === 0 ? (
            <p className="border border-line bg-white p-8 text-[15px] text-muted">
              Reviews for this showroom are being verified and will appear here shortly.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-px border border-line bg-line">
              {reviews.map((r) => (
                <li key={r.id} className="bg-white p-6 md:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Stars value={r.rating} size={13} />
                    <span className="text-[12px] text-muted">{formatDate(r.date)}</span>
                  </div>
                  <h3 className="type-h4 mt-4">{r.title}</h3>
                  <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink/80">{r.body}</p>
                  <p className="mt-5 text-[12.5px] text-muted">
                    <span className="font-medium text-ink">{r.name}</span> · {r.visit}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[11.5px] text-muted">Reviews are illustrative demo content.</p>
        </div>
      </div>
    </section>
  );
}

/* ── Nearby showrooms ─────────────────────────────────────────── */

export async function NearbyDealers({ items, city }: { items: { dealer: Dealer; km: number }[]; city: string }) {
  if (items.length === 0) return null;
  const { brandName } = await getCatalog();
  return (
    <section aria-labelledby="nearby-title" className="py-14 md:py-20">
      <div className="container-x">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow>Also nearby</Eyebrow>
            <h2 id="nearby-title" className="type-h2 mt-5">
              Other showrooms near {city}
            </h2>
          </div>
          <Link href="/dealers" className="group/al inline-flex items-center gap-1.5 text-sm font-medium text-ink">
            All dealers
            <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover/al:-translate-y-0.5 group-hover/al:translate-x-0.5" />
          </Link>
        </div>
        <Reveal className="mt-12">
          <ul className="grid grid-cols-1 border-t border-ink md:grid-cols-3">
            {items.map(({ dealer, km }) => (
              <li key={dealer.id} className="border-b border-line md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
                <Link
                  href={`/dealers/${dealer.id}`}
                  className="group/nd flex items-center gap-5 py-6 md:flex-col md:items-stretch md:py-8"
                >
                  <span className="relative block aspect-square w-24 shrink-0 overflow-hidden bg-mist md:aspect-[16/10] md:w-full">
                    <Image
                      src={dealer.image}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 30vw, 96px"
                      className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/nd:scale-[1.04]"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="type-eyebrow block text-muted">
                      {dealer.brand === "multi-brand" ? "Multi-brand" : brandName(dealer.brand)}
                    </span>
                    <span className="type-h4 mt-2 block transition-colors duration-[250ms] group-hover/nd:text-red">{dealer.name}</span>
                    <span className="mt-1 block text-[13px] text-muted num">
                      {dealer.area}, {dealer.city} · {km === 0 ? "Same city" : `${km.toLocaleString("en-IN")} km away`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
