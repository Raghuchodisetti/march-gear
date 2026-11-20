"use client";

import { useMemo, useState } from "react";
import { Car, ChevronDown, GitCompareArrows, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RangeField } from "@/components/ui/field";
import { useUI } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { cn } from "@/lib/utils";
import type { PricingConfig } from "@/insurance/estimator";
import type { InsuranceSearch } from "@/insurance/types";
import { isSearchReady } from "@/insurance/search";
import { estimateProduct, productProblems, resolveVehicle, vehicleAssumptions, vehicleFacts, type MarketProduct } from "./engine";
import { RequestQuoteModal } from "./request-quote";
import { Breakdown } from "./quote-card";
import { useInsCompare } from "./compare-store";
import { trackInsurance } from "./track";
import { IndicativeLabel, Switch, inr } from "./ui";
import { VehiclePicker, blankSearch } from "./vehicle-picker";

/** The product page's inline estimator: choose a car → indicative premium for this plan → request a quote. */
export function ProductEstimator({
  product: p,
  config,
  initialSearch,
  initialAddOns,
  today,
  attribution,
}: {
  product: MarketProduct;
  config: PricingConfig;
  initialSearch: InsuranceSearch;
  initialAddOns: string[];
  today: string;
  attribution: { source: string; campaignId: number | null; adId: number | null };
}) {
  const catalog = useCatalog();
  const { toast } = useUI();
  const compare = useInsCompare();
  const ready = isSearchReady(initialSearch);
  const [search, setSearch] = useState<InsuranceSearch>(ready ? initialSearch : blankSearch());
  const [editing, setEditing] = useState(!ready);
  const [draft, setDraft] = useState<InsuranceSearch>(ready ? initialSearch : blankSearch());
  const [addOns, setAddOns] = useState<string[]>(initialAddOns);
  const [idv, setIdv] = useState<number | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const vehicle = useMemo(() => (isSearchReady(search) ? resolveVehicle(search, catalog, config, today) : null), [search, catalog, config, today]);
  const problems = vehicle ? productProblems(p, vehicle) : [];
  const est = vehicle && !vehicle.tooOld && !problems.length ? estimateProduct(p, vehicle, { addOns, idv }, config) : null;
  const optional = est ? est.addOns.filter((l) => l.status === "optional" || l.status === "selected") : [];
  const inCompare = compare.refs.includes(p.reference);
  const keyFor = (id: number, key: string) => (key === "custom" ? `c${id}` : key);

  const apply = () => {
    if (!isSearchReady(draft)) {
      toast("Choose your car's brand and model.", { tone: "error" });
      return;
    }
    setSearch(draft);
    setIdv(null);
    setEditing(false);
  };

  return (
    <div className="border border-line bg-white">
      <div className="border-b border-line px-5 py-4 md:px-6">
        <p className="type-eyebrow text-ink">Your indicative premium</p>
      </div>

      {editing || !vehicle ? (
        <div className="px-5 py-5 md:px-6">
          <VehiclePicker value={draft} onChange={setDraft} thisYear={Number(today.slice(0, 4))} maxAgeYears={config.maxVehicleAgeYears} layout="stack" showReg={false} />
          <div className="mt-5 flex gap-3">
            <Button variant="dark" className="flex-1" onClick={apply} disabled={!isSearchReady(draft)}>
              Show premium
            </Button>
            {vehicle && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-line bg-mist/50 px-5 py-3.5 md:px-6">
            <Car className="size-4 shrink-0 text-ink/70" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-ink">{vehicle.title}</p>
              <p className="truncate text-[11.5px] text-muted">{vehicleFacts(vehicle).join(" · ")}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraft(search);
                setEditing(true);
              }}
              className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-ink hover:text-red"
            >
              <PencilLine className="size-3.5" aria-hidden /> Change
            </button>
          </div>

          <div className="px-5 py-5 md:px-6">
            {est ? (
              <>
                <IndicativeLabel align="left" />
                <p className="mt-1 font-display text-[36px] font-semibold leading-none tracking-[-0.03em] num">{inr(est.estimate.total)}</p>
                <p className="mt-1.5 text-[12px] text-muted num">
                  incl. {est.estimate.gstPct}% GST · {est.estimate.odYears > 0 ? `IDV ${inr(est.estimate.idv)}` : "third-party only"}
                </p>
                {vehicleAssumptions(vehicle).length > 0 && (
                  <ul className="mt-3 space-y-0.5 text-[11.5px] text-muted">
                    {vehicleAssumptions(vehicle).map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="border-l-2 border-red bg-red-50 px-4 py-3 text-[13px] text-ink">
                {vehicle.tooOld ? `We estimate for cars up to ${config.maxVehicleAgeYears} years old.` : `Not available for this car: ${problems.join("; ").toLowerCase()}.`}
              </p>
            )}
          </div>

          {est && est.estimate.odYears > 0 && est.estimate.idvMax > est.estimate.idvMin && (
            <div className="border-t border-line px-5 py-5 md:px-6">
              <RangeField
                label="IDV"
                value={est.estimate.idv}
                min={est.estimate.idvMin}
                max={est.estimate.idvMax}
                step={1000}
                onChange={setIdv}
                format={(v) => inr(v)}
                minLabel={inr(est.estimate.idvMin)}
                maxLabel={inr(est.estimate.idvMax)}
              />
            </div>
          )}

          {optional.length > 0 && (
            <div className="space-y-3.5 border-t border-line px-5 py-5 md:px-6">
              <p className="text-[12.5px] font-medium text-ink">Optional add-ons</p>
              {optional.map((l) => {
                const k = keyFor(l.cover.id, l.cover.key);
                return (
                  <Switch
                    key={l.cover.id}
                    label={l.cover.name}
                    hint={`+${inr(l.premium)} before GST`}
                    checked={l.status === "selected"}
                    onChange={(on) => setAddOns(on ? [...addOns, k] : addOns.filter((x) => x !== k))}
                  />
                );
              })}
            </div>
          )}

          {est && (
            <div className="border-t border-line">
              <button type="button" onClick={() => setShowBreakdown((v) => !v)} aria-expanded={showBreakdown} className="flex w-full items-center justify-between px-5 py-3.5 text-[13px] font-medium text-ink hover:text-red md:px-6">
                Premium breakdown
                <ChevronDown className={cn("size-4 transition-transform duration-300", showBreakdown && "rotate-180")} aria-hidden />
              </button>
              {showBreakdown && <Breakdown est={est} />}
            </div>
          )}
        </>
      )}

      <div className="space-y-2.5 border-t border-line bg-mist/40 px-5 py-5 md:px-6">
        <Button className="w-full" onClick={() => setRequestOpen(true)} disabled={problems.length > 0}>
          Request a quote
        </Button>
        <Button
          variant="outline"
          className="w-full"
          icon={<GitCompareArrows className="size-4" aria-hidden />}
          onClick={() => {
            const r = compare.toggle(p.reference);
            if (r === "full") toast(`You can compare up to ${compare.max} plans. Remove one first.`, { tone: "error" });
            else if (r === "added") {
              trackInsurance("compare_add", p.vendorId, p.id);
              toast(`Added ${p.name} to compare`, { action: { label: "Compare now", href: `/insurance/compare?products=${compare.refs.concat(p.reference).join(",")}` } });
            }
          }}
        >
          {inCompare ? "Remove from compare" : "Add to compare"}
        </Button>
      </div>

      <RequestQuoteModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        items={[{ product: p, total: est?.estimate.total ?? null }]}
        search={vehicle ? search : null}
        addOns={addOns}
        idv={idv ? { [p.id]: idv } : undefined}
        source={attribution.source}
        campaignId={attribution.campaignId}
        adCampaignId={attribution.adId}
        thisYear={Number(today.slice(0, 4))}
        maxAgeYears={config.maxVehicleAgeYears}
      />
    </div>
  );
}
