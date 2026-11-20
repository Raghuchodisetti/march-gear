import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface TpSlabRow {
  max: number | null;
  annual: number;
  threeYear: number;
}

/** "Up to 1,000 cc" · "1,001 – 1,500 cc" · "Above 1,500 cc" (or kW). */
export function slabLabel(slabs: TpSlabRow[], i: number, unit: "cc" | "kW") {
  const n = (v: number) => v.toLocaleString("en-IN");
  const prev = i > 0 ? slabs[i - 1].max : null;
  const cur = slabs[i].max;
  if (cur === null) return prev === null ? "All" : `Above ${n(prev)} ${unit}`;
  if (prev === null) return `Up to ${n(cur)} ${unit}`;
  return unit === "cc" ? `${n(prev + 1)} – ${n(cur)} cc` : `Above ${n(prev)} up to ${n(cur)} kW`;
}

export const TP_NOTE = "Third-party rates as configured on MarchGear, before GST. They are notified by the regulator — check the latest notification before relying on them.";

/** A third-party premium table read from the insurancePricing block. */
export function TpRateTable({ slabs, unit, caption, highlight, className }: { slabs: TpSlabRow[]; unit: "cc" | "kW"; caption: string; highlight?: number; className?: string }) {
  return (
    <div className={cn("relative overflow-x-auto border border-line bg-white", className)}>
      <table className="w-full min-w-[320px] border-collapse text-left text-[14px]">
        <caption className="border-b border-line px-4 py-4 text-left text-[12px] font-semibold uppercase sm:px-5 tracking-[0.14em] text-muted">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-mist/60 text-[12px] text-muted">
            <th scope="col" className="px-4 py-3 font-medium sm:px-5">
              {unit === "cc" ? "Engine capacity" : "Motor power"}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium sm:px-5">
              1 year
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium sm:px-5">
              3 years<span className="sr-only"> (new cars)</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {slabs.map((s, i) => (
            <tr key={i} className={cn("border-b border-line last:border-b-0", highlight === i && "bg-red-50/60")}>
              <th scope="row" className="px-4 py-3.5 font-medium sm:px-5">
                {slabLabel(slabs, i, unit)}
                {highlight === i && <span className="ml-2 rounded-[2px] bg-red px-1.5 py-0.5 align-[1px] text-[10px] font-semibold uppercase tracking-[0.1em] text-white">Your car</span>}
              </th>
              <td className="whitespace-nowrap px-4 py-3.5 text-right num sm:px-5">{formatINR(s.annual)}</td>
              <td className="whitespace-nowrap px-4 py-3.5 text-right num sm:px-5">{formatINR(s.threeYear)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
