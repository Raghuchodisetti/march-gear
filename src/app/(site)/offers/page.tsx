import type { Metadata } from "next";
import { BadgeCheck, Sparkles } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { liveOffers } from "@/server/partner/offers";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { OfferCard, categoryLabel, toCardData } from "@/components/offers/offer-card";
import { OfferFilters } from "@/components/offers/offer-filters";
import { pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Car Offers & Discounts from Verified Dealers",
  description: "Live car offers from MarchGear dealer partners: festival discounts, exchange and corporate bonuses, finance and insurance benefits, each approved by our team.",
  path: "/offers",
});

const one = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : undefined);

function tally(values: string[], label: (v: string) => string) {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].map(([value, count]) => ({ value, label: label(value), count })).sort((a, b) => a.label.localeCompare(b.label));
}

export default async function OffersPage(props: PageProps<"/offers">) {
  const sp = await props.searchParams;
  const city = one(sp.city);
  const brand = one(sp.brand);
  const category = one(sp.category);
  // Reading searchParams makes this page render per request, so the time filter is exact.
  const renderedAt = new Date().getTime();
  const [all, cat] = await Promise.all([liveOffers(renderedAt), getCatalog()]);

  const offers = all.filter((o) => (!city || o.cities.includes(city)) && (!brand || o.brands.includes(brand)) && (!category || o.category === category));
  const dealers = new Set(all.map((o) => o.dealer.id)).size;
  const cityCount = new Set(all.flatMap((o) => o.cities)).size;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Dealer offers" }]}
        eyebrow="Dealer offers"
        title={
          <>
            Offers from verified showrooms, <span className="type-editorial font-normal">live now.</span>
          </>
        }
        description="Festival discounts, exchange and corporate bonuses, finance and insurance benefits — set by MarchGear dealer partners and approved by our team before they go live."
      >
        <dl className="grid max-w-xl grid-cols-3 border-t border-ink pt-5">
          {[
            { label: "Live offers", value: all.length },
            { label: "Showrooms", value: dealers },
            { label: "Cities", value: cityCount },
          ].map((s) => (
            <div key={s.label} className="flex flex-col-reverse border-l border-line pl-4 first:border-l-0 first:pl-0">
              <dt className="mt-1 text-[12px] text-muted">{s.label}</dt>
              <dd className="font-display text-[1.5rem] font-semibold tracking-[-0.02em] num">{s.value}</dd>
            </div>
          ))}
        </dl>
      </PageHeader>

      <section aria-label="Offers" className="py-10 md:py-14">
        <div className="container-x">
          <OfferFilters
            city={city}
            brand={brand}
            category={category}
            cities={tally(
              all.flatMap((o) => o.cities),
              (v) => v,
            )}
            brands={tally(
              all.flatMap((o) => o.brands),
              cat.brandName,
            )}
            categories={tally(
              all.map((o) => o.category),
              categoryLabel,
            )}
          />

          <div className="mt-8 flex items-center justify-between gap-4 border-b border-line pb-4">
            <p className="text-[13.5px] text-muted">
              <span className="font-semibold text-ink num">{offers.length}</span> offer{offers.length === 1 ? "" : "s"}
              {city ? ` in ${city}` : ""}
              {brand ? ` on ${cat.brandName(brand)}` : ""}
              {category ? ` · ${categoryLabel(category)}` : ""}
            </p>
            <p className="hidden items-center gap-1.5 text-[12.5px] text-muted sm:inline-flex">
              <BadgeCheck aria-hidden className="size-4 text-red" /> Approved by MarchGear · ending soonest first
            </p>
          </div>

          {offers.length ? (
            <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {offers.map((o, i) => (
                <li key={o.id} className="min-w-0 animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}>
                  <OfferCard offer={toCardData(o)} renderedAt={renderedAt} priority={i < 3} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-8">
              <EmptyState
                icon={<Sparkles className="size-6" aria-hidden />}
                title={all.length ? "No offers match these filters" : "No live offers right now"}
                description={
                  all.length
                    ? "Try another city, brand or offer type — or clear the filters to see every live offer."
                    : "Dealer partners publish new festival and finance offers regularly. Meanwhile, find a showroom near you."
                }
                action={
                  all.length ? (
                    <Button href="/offers" variant="outline">
                      Clear filters
                    </Button>
                  ) : (
                    <Button href="/dealers" arrow>
                      Find a dealer
                    </Button>
                  )
                }
              />
            </div>
          )}

          <p className="mt-12 max-w-3xl text-[12.5px] leading-relaxed text-muted">
            Offers are created by each dealership and reviewed by MarchGear before they appear here. Benefits, stock and eligibility are decided by the dealer — confirm the final on-road price with the showroom before you book.
          </p>
        </div>
      </section>
    </>
  );
}
