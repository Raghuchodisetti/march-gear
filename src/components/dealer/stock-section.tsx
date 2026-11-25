"use client";

import { useState } from "react";
import Image from "next/image";
import { Palette } from "lucide-react";
import { formatINR, formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { Eyebrow } from "@/components/ui/section-heading";
import { useCatalog } from "@/components/providers/catalog-provider";
import { useUI } from "@/components/providers/app-provider";
import { TrackView } from "@/components/portal/track";
import type { PublicVehicle } from "@/components/portal/inventory/shared";
import { StockVehicleDetail, availabilityText, stockTitle } from "./stock-detail";

/*
 * "In stock at this showroom" on a partner dealer's public page: published new-car stock, in stock or on order.
 * The car (photos, names, specs) is the MarchGear catalogue's; colour, price and availability are the dealer's.
 */

export function StockSection({ items, dealerId, dealerName }: { items: PublicVehicle[]; dealerId: string; dealerName: string }) {
  const { brandName } = useCatalog();
  const { openEnquiry } = useUI();
  const [open, setOpen] = useState<PublicVehicle | null>(null);

  const onOrder = items.filter((v) => v.availability === "on_order").length;
  const enquire = (v: PublicVehicle) =>
    openEnquiry({
      kind: "contact-dealer",
      subject: `${stockTitle(v, brandName(v.brand))} ${v.variant}`.trim(),
      detail: `${v.colour ? `${v.colour} · ` : ""}${v.availability === "on_order" ? "On order · " : ""}${dealerName} · ${v.reference}`,
      dealerId,
      carSlug: v.modelSlug ?? undefined,
    });

  return (
    <section id="stock" aria-labelledby="stock-title" className="scroll-mt-24 border-t border-line bg-[#F6F6F6] py-14 md:py-20">
      <div className="container-x">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow>New-car stock</Eyebrow>
            <h2 id="stock-title" className="type-h2 mt-5">
              In stock at this showroom
            </h2>
          </div>
          <p className="max-w-sm text-[14px] text-muted sm:text-right">
            {items.length - onOrder > 0 && `${items.length - onOrder} ready for delivery`}
            {items.length - onOrder > 0 && onOrder > 0 && " · "}
            {onOrder > 0 && `${onOrder} on order`}. Specifications and photos from the MarchGear catalogue; prices and availability are {dealerName}&rsquo;s own.
          </p>
        </div>

        <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((v) => {
            const title = stockTitle(v, brandName(v.brand));
            const name = `${brandName(v.brand)} ${v.model}`;
            return (
              <li key={v.id}>
                <article className="group/card flex h-full flex-col border border-line bg-white transition-[border-color] duration-[400ms] ease-[var(--ease-premium)] hover:border-ink/25">
                  <button type="button" onClick={() => setOpen(v)} className="relative block aspect-[3/2] overflow-hidden bg-mist text-left" aria-label={`View details of ${title} ${v.variant}`}>
                    {v.images[0] && (
                      <Image
                        src={v.images[0]}
                        alt=""
                        fill
                        sizes="(min-width: 1280px) 24vw, (min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw"
                        className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/card:scale-[1.04]"
                      />
                    )}
                    <span className="absolute left-3 top-3 inline-flex h-6 items-center rounded-full bg-white/95 px-2.5 text-[11px] font-semibold text-ink num">
                      <span aria-hidden className={`mr-1.5 size-1.5 rounded-full ${v.availability === "on_order" ? "bg-[#c98a1b]" : "bg-[#1e7a3c]"}`} />
                      {availabilityText(v)}
                    </span>
                  </button>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-[12px] text-muted num">{v.year > 0 ? `${v.year} model · ` : ""}Brand new</p>
                    <h3 className="type-h4 mt-1.5">{name}</h3>
                    <p className="mt-0.5 truncate text-[13px] text-muted">{v.variant}</p>
                    {v.colour && (
                      <p className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-ink/80">
                        {v.colourHex ? <span aria-hidden className="size-3 rounded-full border border-black/10" style={{ backgroundColor: v.colourHex }} /> : <Palette aria-hidden className="size-3.5 text-muted" />} {v.colour}
                      </p>
                    )}
                    <div className="mt-auto pt-5">
                      <div className="border-t border-line pt-4">
                        <p className="text-lg font-semibold num">{formatPrice(v.sellingPrice)}</p>
                        {v.exShowroom ? <p className="text-[11.5px] text-muted num">Ex-showroom {formatINR(v.exShowroom)}</p> : null}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" onClick={() => setOpen(v)}>
                          Details
                        </Button>
                        <Button size="sm" onClick={() => enquire(v)}>
                          Enquire
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} size="xl" title={open ? `${stockTitle(open, brandName(open.brand))} ${open.variant}` : undefined} description={dealerName}>
        {open && (
          <div className="p-5 sm:p-8">
            <TrackView partnerId={open.partnerId} kind="vehicle_view" refId={open.id} />
            <StockVehicleDetail
              vehicle={open}
              brandName={brandName(open.brand)}
              actions={
                <>
                  <Button
                    onClick={() => {
                      const v = open;
                      setOpen(null);
                      enquire(v);
                    }}
                    arrow
                  >
                    Enquire now
                  </Button>
                  {open.modelSlug && (
                    <Button href={`/cars/${open.modelSlug}`} variant="outline" arrow>
                      Model overview
                    </Button>
                  )}
                </>
              }
            />
          </div>
        )}
      </Modal>
    </section>
  );
}
