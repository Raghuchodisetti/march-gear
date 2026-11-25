"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatPriceShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCity, useUI } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { useCarDetail } from "./context";

/**
 * Mobile-only fixed action bar (≈76px + safe area). It slides away while the
 * footer is on screen so the footer is never covered. Pages using it add
 * matching bottom padding (BOTTOM_BAR_PADDING in ./utils).
 */
export function BottomActionBar({
  exShowroom,
  ev,
  subject,
  detail,
  carSlug,
  tone = "light",
}: {
  exShowroom: number;
  ev: boolean;
  subject: string;
  detail: string;
  carSlug?: string;
  tone?: "light" | "dark";
}) {
  const { city } = useCity();
  const { onRoadPrice } = useCatalog();
  const { openEnquiry, setLocationOpen } = useUI();
  const [hidden, setHidden] = useState(false);
  const dark = tone === "dark";
  const onRoad = onRoadPrice(exShowroom, city.slug, ev);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const io = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting), { rootMargin: "0px 0px -24px 0px" });
    io.observe(footer);
    return () => io.disconnect();
  }, []);

  return (
    <div
      aria-hidden={hidden || undefined}
      inert={hidden}
      className={cn(
        "fixed inset-x-0 bottom-0 z-[55] border-t pb-[env(safe-area-inset-bottom)] transition-transform duration-[400ms] ease-[var(--ease-premium)] lg:hidden",
        dark ? "border-white/10 bg-ink-2/95 text-white backdrop-blur-md" : "border-line bg-white/95 text-ink backdrop-blur-md",
        hidden && "translate-y-full",
      )}
    >
      <div className="flex h-[76px] items-center gap-2.5 px-4">
        <button
          type="button"
          onClick={() => setLocationOpen(true)}
          className="min-w-0 flex-1 text-left"
        >
          <span className={cn("flex items-center gap-1 text-[11px]", dark ? "text-white/55" : "text-muted")}>
            <span className="truncate">On-road · {city.name}</span>
            <ChevronDown aria-hidden className="size-3 shrink-0" />
          </span>
          <span className="block text-[17px] font-semibold leading-tight num">{formatPriceShort(onRoad)}</span>
          <span className={cn("block truncate text-[11px]", dark ? "text-white/55" : "text-muted")}>{detail}</span>
          <span className="sr-only">. Change city</span>
        </button>
        <Button
          variant={dark ? "outline-light" : "outline"}
          className="px-3.5 text-[13px]"
          onClick={() => openEnquiry({ kind: "test-drive", subject, detail, carSlug })}
        >
          Test drive
        </Button>
        <Button className="px-3.5 text-[13px]" onClick={() => openEnquiry({ kind: "best-price", subject, detail: `${detail} · ${city.name}`, carSlug })}>
          Best price
        </Button>
      </div>
    </div>
  );
}

/** Model-page wrapper: follows the variant chosen in the hero. */
export function ModelBottomBar() {
  const { car, variant, ev, title } = useCarDetail();
  return <BottomActionBar exShowroom={variant.price} ev={ev} subject={title} detail={variant.name} carSlug={car.slug} />;
}
