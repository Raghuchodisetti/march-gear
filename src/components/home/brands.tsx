import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { formatPriceShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BrandLogo, logoFit } from "@/components/ui/brand-logo";
import { RevealGroup, RevealItem } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";

/** Homepage: every marque as a logo tile, linking to its line-up. */
export async function BrowseByBrand() {
  const { brands, carsByBrand } = await getCatalog();
  const list = brands.map((b) => {
    const models = carsByBrand(b.slug);
    return { ...b, count: models.length, from: Math.min(...models.map((c) => c.priceMin)) };
  });

  return (
    <section aria-labelledby="brands-title" className="bg-mist py-14 md:py-20">
      <div className="container-x">
        <SectionHeading
          eyebrow="Browse by brand"
          title={<span id="brands-title">Your favourite marques, side by side.</span>}
          description="From India's best-sellers to German flagships — pick a brand to see every model it sells, with indicative prices."
          action={{ label: "All brands", href: "/brands" }}
        />

        <RevealGroup className="mt-12 grid grid-cols-4 gap-2 md:gap-3 lg:grid-cols-8" gap={0.03}>
          {list.map((b) => (
            <RevealItem key={b.slug}>
              <Link
                href={`/new-cars?brand=${b.slug}`}
                className="group/brand relative flex h-full flex-col items-center border border-transparent bg-white px-1.5 pb-3.5 pt-4 text-center transition-[border-color,box-shadow] duration-[400ms] ease-[var(--ease-premium)] hover:border-ink hover:shadow-soft md:px-3 md:pb-5 md:pt-6"
              >
                <span className="flex h-11 w-full items-center justify-center md:h-16">
                  <BrandLogo
                    slug={b.slug}
                    className={cn(logoFit(b.slug), "transition-transform duration-[500ms] ease-[var(--ease-premium)] group-hover/brand:scale-110")}
                  />
                </span>
                <span className="mt-2.5 line-clamp-2 block w-full text-[11px] font-semibold leading-tight md:mt-4 md:text-[14px]">{b.name}</span>
                <span className="mt-1 hidden text-[11.5px] leading-snug text-muted num md:block">
                  <span className="block">
                    {b.count} {b.count === 1 ? "model" : "models"}
                  </span>
                  <span className="block">from {formatPriceShort(b.from)}</span>
                </span>
                <ArrowUpRight
                  aria-hidden
                  className="absolute right-2.5 top-2.5 size-3.5 text-red opacity-0 transition-opacity duration-[400ms] group-hover/brand:opacity-100"
                />
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
