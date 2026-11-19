"use client";

import { MapPin } from "lucide-react";
import { formatINR } from "@/lib/format";
import { EmiCalculator } from "@/components/tools/emi-calculator";
import { TextLink } from "@/components/ui/section-heading";
import { useUI } from "@/components/providers/app-provider";
import { useCarDetail } from "./context";

/** EMI calculator pre-filled with the selected variant's on-road price. */
export function CarEmi() {
  const { variant, onRoad, title, city } = useCarDetail();
  const { setLocationOpen } = useUI();
  const maxPrice = Math.max(20_000_000, Math.ceil((onRoad * 1.5) / 1_000_000) * 1_000_000);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          Pre-filled with the on-road price of the <span className="font-medium text-ink">{variant.name}</span> in{" "}
          <button type="button" onClick={() => setLocationOpen(true)} className="inline-flex items-center gap-1 font-medium text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink">
            <MapPin aria-hidden className="size-3 text-red" />
            {city.name}
          </button>{" "}
          · <span className="num text-ink">{formatINR(onRoad)}</span>
        </p>
        <TextLink href="/tools/car-loan" className="shrink-0">
          Check loan eligibility
        </TextLink>
      </div>
      {/* Keyed so a new variant or city resets the calculator to the new price.
          grid-cols-1 + tighter tenure buttons keep the shared calculator within a 360px viewport. */}
      <EmiCalculator
        key={`${variant.slug}-${city.slug}`}
        defaultPrice={onRoad}
        maxPrice={maxPrice}
        subject={`${title} ${variant.name}`}
        tone="light"
        className="grid-cols-1 border border-line [&_[role=radio]]:px-0 sm:[&_[role=radio]]:px-4"
      />
    </div>
  );
}
