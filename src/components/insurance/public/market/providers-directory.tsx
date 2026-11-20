"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, BadgeCheck, Search, Wrench } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import type { InsProductCategory } from "@/db/enums";
import { INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { formatNumber } from "@/lib/format";
import type { PublicProvider } from "@/server/insurance/public";
import { CompanyLogo } from "./ui";

/** /insurance/providers: every public provider, with search and a policy-type filter. */
export function ProvidersDirectory({ providers }: { providers: PublicProvider[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<InsProductCategory | "">("");
  const categories = useMemo(() => {
    const set = new Set<InsProductCategory>();
    for (const p of providers) for (const c of p.categories) set.add(c);
    return [...set];
  }, [providers]);
  const needle = q.trim().toLowerCase();
  const list = providers.filter(
    (p) => (!needle || `${p.name} ${p.shortName ?? ""} ${p.about ?? ""}`.toLowerCase().includes(needle)) && (!category || p.categories.includes(category)),
  );

  return (
    <section className="container-x py-10 md:py-14">
      <div className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search insurers"
            aria-label="Search insurers"
            className="h-12 w-full rounded-[3px] border border-line bg-white pl-11 pr-4 text-[15px] outline-none transition-colors placeholder:text-muted/70 hover:border-ink/30 focus:border-ink"
          />
        </div>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:justify-end lg:px-0" role="group" aria-label="Filter by policy type">
          <Chip selected={category === ""} onClick={() => setCategory("")}>
            All types
          </Chip>
          {categories.map((c) => (
            <Chip key={c} selected={category === c} onClick={() => setCategory(category === c ? "" : c)}>
              {INS_PRODUCT_CATEGORY_LABEL[c].replace(/ \(.+\)$/, "")}
            </Chip>
          ))}
        </div>
      </div>

      <p className="mt-5 text-[13px] text-muted num" aria-live="polite">
        {list.length} of {providers.length} provider{providers.length === 1 ? "" : "s"}
      </p>

      {providers.length === 0 ? (
        <div className="mt-6 flex flex-col items-center border border-dashed border-line px-6 py-16 text-center">
          <h2 className="type-h3">No providers listed yet</h2>
          <p className="mt-2 max-w-md text-[14px] text-muted">Insurers appear here once MarchGear has approved them and at least one of their plans is live.</p>
          <Button href="/insurance-vendor" variant="outline" size="sm" className="mt-6">
            List your products
          </Button>
        </div>
      ) : list.length === 0 ? (
        <div className="mt-6 flex flex-col items-center border border-dashed border-line px-6 py-14 text-center">
          <h2 className="type-h4">No providers match</h2>
          <Button
            variant="outline"
            size="sm"
            className="mt-5"
            onClick={() => {
              setQ("");
              setCategory("");
            }}
          >
            Clear search
          </Button>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const claim = p.claimInfo?.verified && p.claimInfo.settlementRatio !== null ? p.claimInfo : null;
            return (
              <li key={p.id}>
                <Link href={`/insurance/providers/${p.slug}`} className="group flex h-full flex-col border border-line bg-white p-6 transition-colors duration-[250ms] hover:border-ink">
                  <div className="flex items-start justify-between gap-4">
                    <CompanyLogo company={p} size="md" />
                    <ArrowUpRight className="size-4 text-red transition-transform duration-[250ms] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                  </div>
                  <h2 className="type-h4 mt-5">{p.name}</h2>
                  {p.about && <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-muted">{p.about}</p>}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {p.categories.slice(0, 4).map((c) => (
                      <span key={c} className="inline-flex h-6 items-center rounded-[2px] bg-mist px-2 text-[11px] font-medium text-ink">
                        {INS_PRODUCT_CATEGORY_LABEL[c].replace(/ \(.+\)$/, "")}
                      </span>
                    ))}
                  </div>
                  <span aria-hidden className="flex-1" />
                  <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5 text-[12px]">
                    <div>
                      <dt className="text-muted">Plans</dt>
                      <dd className="mt-1 text-[15px] font-semibold text-ink num">{p.productCount}</dd>
                    </div>
                    <div>
                      <dt className="inline-flex items-center gap-1 text-muted">
                        <Wrench className="size-3" aria-hidden /> Garages
                      </dt>
                      <dd className="mt-1 text-[15px] font-semibold text-ink num">{p.garageCount ? formatNumber(p.garageCount) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Claims settled</dt>
                      <dd className="mt-1 text-[15px] font-semibold text-ink num">
                        {claim ? (
                          <span className="inline-flex items-center gap-1">
                            {claim.settlementRatio}%<BadgeCheck className="size-3.5 text-red" aria-label="Verified by MarchGear" />
                          </span>
                        ) : (
                          <span className="text-[11.5px] font-normal leading-tight text-muted">Not yet verified</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-10 max-w-3xl text-[12px] leading-relaxed text-muted">
        Garage counts are as stated by each insurer. Claim settlement figures are shown only after MarchGear has verified them, with the year and source on the provider&apos;s page.
      </p>
    </section>
  );
}
