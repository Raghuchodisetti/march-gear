"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/section-heading";
import { useUI } from "@/components/providers/app-provider";
import type { PublicVehicle } from "@/components/portal/inventory/shared";

/* "Available at MarchGear dealers" on a model page: the cheapest published stock across partner dealers. */

export function DealerStock({ items, dealers, carName, carSlug }: { items: PublicVehicle[]; dealers: number; carName: string; carSlug: string }) {
  const { openEnquiry } = useUI();
  if (!items.length) return null;
  return (
    <section aria-labelledby="dealer-stock-title" className="border-t border-line bg-[#F6F6F6] py-12 md:py-16">
      <div className="container-x">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow>In stock now</Eyebrow>
            <h2 id="dealer-stock-title" className="type-h3 mt-4">
              Available at MarchGear dealers
            </h2>
          </div>
          <p className="max-w-md text-[14px] text-muted md:text-right">
            {dealers === 1 ? "One partner dealer has" : `${dealers} partner dealers have`} the {carName} ready for delivery. Dealer prices, verified listings.
          </p>
        </div>

        <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {items.map((v) => (
            <li key={v.id}>
              <article className="group/st flex h-full flex-col border border-line bg-white transition-[border-color] duration-[400ms] ease-[var(--ease-premium)] hover:border-ink/25">
                <div className="flex gap-4 p-4">
                  <div className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden bg-mist">
                    {v.images[0] && <Image src={v.images[0]} alt="" fill sizes="112px" className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/st:scale-[1.05]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold">{v.dealer.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-muted">
                      <MapPin aria-hidden className="size-3.5 shrink-0" />
                      <span className="truncate">{[v.dealer.area, v.dealer.city].filter(Boolean).join(", ")}</span>
                    </p>
                    <p className="mt-2 truncate text-[13px] text-ink/80">{[v.variant, v.colour].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-line px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold num">{formatPrice(v.sellingPrice)}</p>
                    <p className="text-[11.5px] text-muted num">{v.stock} in stock</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {v.dealer.id && (
                      <Link
                        href={`/dealers/${v.dealer.id}#stock`}
                        className="inline-flex h-9 items-center gap-1 rounded-[3px] px-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-mist"
                      >
                        Showroom <ArrowUpRight aria-hidden className="size-3.5 text-red" />
                      </Link>
                    )}
                    <Button
                      size="sm"
                      onClick={() =>
                        openEnquiry({
                          kind: "contact-dealer",
                          subject: `${carName} ${v.variant}`.trim(),
                          detail: `${v.colour ? `${v.colour} · ` : ""}${v.dealer.name} · ${v.reference}`,
                          dealerId: v.dealer.id ?? undefined,
                          carSlug,
                        })
                      }
                    >
                      Enquire
                    </Button>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
