import Image from "next/image";
import Link from "next/link";
import type { CarModel } from "@/types";
import { getCatalog } from "@/server/catalog";
import { formatPriceRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/ui/rating";
import { competitorsOf, maxOf } from "./utils";

/**
 * Compact side-by-side of the model against up to three rivals. The best
 * figure in each row is marked; mobile scrolls horizontally with the label
 * column pinned.
 */
export async function CompareRivals({ car }: { car: CarModel }) {
  const cat = await getCatalog();
  const { brandName } = cat;
  const rivals = competitorsOf(car, cat, 3);
  const field = [car, ...rivals];
  const href = `/compare?cars=${field.map((c) => c.slug).join(",")}`;

  const rows: { label: string; render: (c: CarModel) => React.ReactNode; score?: (c: CarModel) => number; higherIsBetter?: boolean }[] = [
    { label: "Price (ex-showroom)", render: (c) => formatPriceRange(c.priceMin, c.priceMax), score: (c) => c.priceMin, higherIsBetter: false },
    { label: "Max power", render: (c) => `${maxOf(c.power)} bhp`, score: (c) => maxOf(c.power) },
    { label: "Max torque", render: (c) => `${maxOf(c.torque)} Nm`, score: (c) => maxOf(c.torque) },
    { label: "Efficiency", render: (c) => c.efficiency },
    {
      label: "Safety",
      render: (c) =>
        c.safetyAgency === "Not tested" ? (
          <span className="text-muted">Not tested</span>
        ) : (
          <span className="inline-flex flex-col gap-1">
            <Stars value={c.safetyRating} size={12} />
            <span className="text-[11.5px] text-muted">{c.safetyAgency}</span>
          </span>
        ),
      score: (c) => c.safetyRating,
    },
    { label: "Boot space", render: (c) => `${c.bootSpace} L`, score: (c) => c.bootSpace },
    { label: "Owner rating", render: (c) => `${c.rating.toFixed(1)} / 5`, score: (c) => c.rating },
  ];

  return (
    <div>
      <div className="no-scrollbar -mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
        <table className="w-full min-w-[720px] border-collapse text-left text-[14px]">
          <caption className="sr-only">
            {car.name} compared with {rivals.map((r) => r.name).join(", ")}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-[150px] bg-white align-bottom md:w-[200px]">
                <span className="sr-only">Specification</span>
              </th>
              {field.map((c, i) => (
                <th key={c.slug} scope="col" className={cn("px-4 pb-5 align-top font-normal", i === 0 && "bg-mist pt-4")}>
                  <Link href={`/cars/${c.slug}`} className="group block">
                    <span className="relative block aspect-[16/10] overflow-hidden bg-mist">
                      <Image
                        src={c.images[0]}
                        alt={`${brandName(c.brand)} ${c.name}`}
                        fill
                        sizes="240px"
                        className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover:scale-[1.04]"
                        style={{ objectPosition: c.focus ?? "50% 55%" }}
                      />
                    </span>
                    <span className="mt-3 block text-[11.5px] uppercase tracking-[0.14em] text-muted">{brandName(c.brand)}</span>
                    <span className="mt-1 block text-[15px] font-semibold group-hover:text-red">{c.name}</span>
                    {i === 0 && <span className="mt-1 block text-[11.5px] font-medium text-red">This car</span>}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const scores = row.score ? field.map(row.score) : [];
              const target = row.score ? (row.higherIsBetter === false ? Math.min(...scores) : Math.max(...scores)) : null;
              return (
                <tr key={row.label} className="border-t border-line">
                  <th scope="row" className="sticky left-0 z-10 bg-white py-4 pr-4 text-[12.5px] font-normal text-muted">
                    {row.label}
                  </th>
                  {field.map((c, i) => {
                    const best = target !== null && row.score && row.score(c) === target && new Set(scores).size > 1;
                    return (
                      <td key={c.slug} className={cn("px-4 py-4 align-top num", i === 0 && "bg-mist font-medium")}>
                        <span className="inline-flex items-start gap-2">
                          {row.render(c)}
                          {best && (
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red" aria-label="Best in group" role="img" />
                          )}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-8 flex flex-col gap-5 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-[12.5px] text-muted">
          <span aria-hidden className="size-1.5 rounded-full bg-red" /> Best in this group · prices indicative
        </p>
        <Button href={href} variant="dark" arrow>
          Compare all {field.length} in detail
        </Button>
      </div>
    </div>
  );
}
