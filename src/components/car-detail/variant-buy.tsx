"use client";

import { MapPin } from "lucide-react";
import { formatINR, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CompareToggle, WishlistButton } from "@/components/vehicle/toggles";
import { useCity, useUI } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { ShareButton } from "./buy-actions";
import { emiFrom } from "./utils";

/** Price + enquiry block for a single variant (variant and EV pages). */
export function VariantBuyPanel({
  slug,
  title,
  variantName,
  price,
  ev,
  tone = "light",
  className,
}: {
  slug: string;
  title: string;
  variantName: string;
  price: number;
  ev: boolean;
  tone?: "light" | "dark";
  className?: string;
}) {
  const { city } = useCity();
  const { openEnquiry, setLocationOpen } = useUI();
  const { onRoadPrice } = useCatalog();
  const onRoad = onRoadPrice(price, city.slug, ev);
  const dark = tone === "dark";

  return (
    <div className={className}>
      <div className={cn("grid grid-cols-1 gap-px border min-[400px]:grid-cols-2", dark ? "border-white/10 bg-white/10" : "border-line bg-line")}>
        <div className={cn("p-5", dark ? "bg-ink" : "bg-white")}>
          <p className={cn("text-[12px]", dark ? "text-white/55" : "text-muted")}>Ex-showroom</p>
          <p className="mt-1.5 text-[clamp(1.375rem,1.1rem+1vw,1.875rem)] font-semibold leading-tight num">{formatPrice(price)}</p>
          <p className={cn("mt-1 text-[11px]", dark ? "text-white/50" : "text-muted")}>Indicative</p>
        </div>
        <div className={cn("p-5", dark ? "bg-ink" : "bg-white")}>
          <p className={cn("truncate text-[12px]", dark ? "text-white/55" : "text-muted")}>On-road · {city.name}</p>
          <p className="mt-1.5 text-[clamp(1.375rem,1.1rem+1vw,1.875rem)] font-semibold leading-tight num">{formatPrice(onRoad)}</p>
          <button
            type="button"
            onClick={() => setLocationOpen(true)}
            className={cn("mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium underline underline-offset-4", dark ? "decoration-white/30 hover:decoration-white" : "decoration-ink/25 hover:decoration-ink")}
          >
            <MapPin aria-hidden className="size-3 text-red" />
            Change city
          </button>
        </div>
      </div>
      <p className={cn("mt-3 text-[12.5px]", dark ? "text-white/55" : "text-muted")}>
        EMI from <span className={cn("font-semibold num", dark ? "text-white" : "text-ink")}>{formatINR(emiFrom(onRoad))}</span>/month · 80% financed, 5 years at 9.25%
      </p>

      <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Button size="lg" arrow onClick={() => openEnquiry({ kind: "best-price", subject: title, detail: `${variantName} · ${city.name}`, carSlug: slug })}>
          Get best price
        </Button>
        <Button size="lg" variant={dark ? "outline-light" : "outline"} onClick={() => openEnquiry({ kind: "test-drive", subject: title, detail: variantName, carSlug: slug })}>
          Book a test drive
        </Button>
      </div>
      <div className="mt-5 flex items-center justify-between gap-4">
        <CompareToggle slug={slug} label={title} tone={dark ? "light" : "dark"} />
        <div className="flex items-center gap-2">
          <WishlistButton id={slug} label={title} tone={dark ? "dark" : "outline"} />
          <ShareButton label={`${title} ${variantName}`} tone={dark ? "dark" : "light"} />
        </div>
      </div>
    </div>
  );
}

/** Dark CTA band buttons. */
export function EnquiryButtons({ title, detail, carSlug, tone = "dark" }: { title: string; detail: string; carSlug?: string; tone?: "light" | "dark" }) {
  const { openEnquiry } = useUI();
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button size="lg" arrow onClick={() => openEnquiry({ kind: "best-price", subject: title, detail, carSlug })}>
        Get best price
      </Button>
      <Button size="lg" variant={tone === "dark" ? "outline-light" : "outline"} onClick={() => openEnquiry({ kind: "test-drive", subject: title, detail, carSlug })}>
        Book a test drive
      </Button>
    </div>
  );
}
