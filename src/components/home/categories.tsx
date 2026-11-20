import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { cn } from "@/lib/utils";
import { RevealGroup, RevealItem } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";

// Asymmetric mosaic: the first tile leads large, the last closes the grid wide.
const LARGE = "col-span-2 row-span-2 lg:col-span-6 lg:row-span-2";
const SMALL = "col-span-1 lg:col-span-3";
const WIDE = "col-span-2 lg:col-span-12 lg:h-[300px]";

export async function DiscoverCategories() {
  const { carsInCategory, content } = await getCatalog();
  const categories = content.homeCategories.items;
  return (
    <section aria-labelledby="categories-title" className="py-14 md:py-20">
      <div className="container-x">
        <SectionHeading
          eyebrow="Discover by category"
          title={<span id="categories-title">Every kind of journey, considered.</span>}
          description="Start with the shape of your life — city commutes, family road trips or electric-first. We'll show you the best of each."
        />

        <RevealGroup className="mt-12 grid auto-rows-[200px] grid-cols-2 gap-3 md:auto-rows-[240px] lg:grid-cols-12 lg:gap-4" gap={0.07}>
          {categories.map((cat, i) => {
            const count = carsInCategory(cat.slug).length;
            const large = i === 0;
            const wide = !large && i === categories.length - 1;
            return (
              <RevealItem key={cat.slug} className={large ? LARGE : wide ? WIDE : SMALL}>
                <Link
                  href={cat.slug === "electric" ? "/electric-cars" : `/new-cars?body=${cat.slug}`}
                  className="group/cat relative flex h-full flex-col justify-end overflow-hidden bg-ink p-5 text-white md:p-7"
                >
                  <Image
                    src={cat.image}
                    alt=""
                    fill
                    sizes={large ? "(min-width: 1024px) 50vw, 100vw" : wide ? "100vw" : "(min-width: 1024px) 25vw, 50vw"}
                    className="object-cover opacity-85 transition-[transform,opacity] duration-[900ms] ease-[var(--ease-premium)] group-hover/cat:scale-[1.05] group-hover/cat:opacity-100"
                    style={{ objectPosition: cat.focus || "50% 50%" }}
                  />
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/15 to-transparent" />
                  <div className="relative flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[12px] font-medium text-white/65 num">
                        {String(count).padStart(2, "0")} models
                      </p>
                      <h3 className={cn("mt-1.5 font-display font-semibold tracking-[-0.025em] [font-stretch:108%]", large || wide ? "text-3xl md:text-5xl" : "text-xl md:text-2xl")}>
                        {cat.plural}
                      </h3>
                      {(large || wide) && <p className="mt-3 hidden max-w-sm text-[14px] text-white/70 md:block">{cat.blurb}</p>}
                    </div>
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/30 transition-[background-color,border-color,color] duration-[400ms] group-hover/cat:border-white group-hover/cat:bg-white group-hover/cat:text-ink">
                      <ArrowUpRight className="size-4" aria-hidden />
                    </span>
                  </div>
                </Link>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}
