"use client";

import { useMemo, useState } from "react";
import { Zap } from "lucide-react";
import { formatINR } from "@/lib/format";
import { SelectField } from "@/components/ui/field";
import { useCatalog } from "@/components/providers/catalog-provider";
import { TP_NOTE, TpRateTable, slabLabel } from "./tp-rates";

/**
 * Electric third-party rates from the insurancePricing block (as configured), with a picker that
 * highlights the slab for a catalogue EV by its motor power.
 */
export function EvSlabFinder() {
  const catalog = useCatalog();
  const slabs = catalog.content.insurancePricing.tpElectric;
  const evs = useMemo(
    () =>
      catalog
        .electricCars()
        .filter((c) => c.ev?.motorKw)
        .map((c) => ({ value: c.slug, label: `${catalog.brandName(c.brand)} ${c.name}`, kw: c.ev!.motorKw }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [catalog],
  );
  const [slug, setSlug] = useState("");
  const car = evs.find((e) => e.value === slug);
  const index = car ? slabs.findIndex((s) => s.max === null || car.kw <= s.max) : -1;
  const slab = index >= 0 ? slabs[index] : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="border border-line bg-white p-6 lg:col-span-2">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-mist">
          <Zap aria-hidden className="size-[18px] text-red" />
        </span>
        <p className="mt-5 text-[15px] font-semibold">Find your EV&apos;s slab</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted">Choose a model from our catalogue to see its motor power and the third-party slab it falls in.</p>
        <SelectField
          className="mt-5"
          label="Electric car"
          placeholder={evs.length ? "Choose a model" : "No electric models listed"}
          disabled={!evs.length}
          options={evs.map(({ value, label }) => ({ value, label }))}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <div aria-live="polite" className="mt-5 min-h-24 border-t border-line pt-5">
          {car && slab ? (
            <dl className="grid grid-cols-2 gap-4 text-[13px]">
              <div>
                <dt className="text-muted">Motor power</dt>
                <dd className="mt-0.5 text-[18px] font-semibold num">{car.kw} kW</dd>
              </div>
              <div>
                <dt className="text-muted">Slab</dt>
                <dd className="mt-0.5 text-[14px] font-semibold">{slabLabel(slabs, index, "kW")}</dd>
              </div>
              <div>
                <dt className="text-muted">Third party, 1 year</dt>
                <dd className="mt-0.5 text-[18px] font-semibold num">{formatINR(slab.annual)}</dd>
              </div>
              <div>
                <dt className="text-muted">3 years (new car)</dt>
                <dd className="mt-0.5 text-[18px] font-semibold num">{formatINR(slab.threeYear)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-[13px] text-muted">The figures appear here once you choose a model.</p>
          )}
        </div>
      </div>
      <div className="lg:col-span-3">
        <TpRateTable slabs={slabs} unit="kW" caption="Electric cars — third-party premium by motor power" highlight={index >= 0 ? index : undefined} />
        <p className="mt-4 text-[12.5px] leading-relaxed text-muted">{TP_NOTE} Own-damage premiums and add-ons are extra and vary by insurer.</p>
      </div>
    </div>
  );
}
