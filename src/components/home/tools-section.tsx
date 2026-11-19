"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { tools } from "@/data/tools";
import { calculateEmi } from "@/lib/finance";
import { formatINR, formatPriceShort } from "@/lib/format";
import { RangeField } from "@/components/ui/field";
import { RevealGroup, RevealItem } from "@/components/ui/reveal";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";

export function ToolsSection() {
  const [price, setPrice] = useState(1_500_000);
  const emi = calculateEmi(price * 0.8, 9.25, 60);

  return (
    <section aria-labelledby="tools-title" className="bg-mist py-14 md:py-20">
      <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Eyebrow>Automotive tools</Eyebrow>
          <h2 id="tools-title" className="type-h2 mt-5 text-balance">
            Do the maths before the showroom does.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-muted">
            Precise, transparent calculators for every money decision — from the first EMI to the last service.
          </p>

          <div className="mt-10 border border-line bg-white p-6">
            <p className="type-eyebrow text-muted">Quick EMI</p>
            <RangeField
              className="mt-5"
              label="Car price"
              value={price}
              min={500_000}
              max={5_000_000}
              step={50_000}
              onChange={setPrice}
              format={formatPriceShort}
            />
            <div className="mt-6 flex items-end justify-between gap-4 border-t border-line pt-5">
              <div>
                <p className="text-[12px] text-muted">Estimated EMI</p>
                <p className="font-display text-3xl font-semibold tracking-[-0.03em] num">{formatINR(emi)}</p>
                <p className="text-[11.5px] text-muted">20% down · 9.25% · 5 years</p>
              </div>
              <TextLink href="/tools/emi-calculator">Full calculator</TextLink>
            </div>
          </div>
        </div>

        <RevealGroup className="grid grid-cols-1 gap-px self-start border border-line bg-line sm:grid-cols-2 lg:col-span-8" gap={0.06}>
          {tools.map((tool, i) => {
            const Icon = tool.icon;
            return (
              <RevealItem key={tool.slug} className="bg-mist">
                <Link href={tool.href} className="group/tool relative flex h-full min-h-[220px] flex-col bg-white p-7 transition-colors duration-[400ms] hover:bg-ink hover:text-white md:p-8">
                  <div className="flex items-start justify-between">
                    <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist text-ink transition-colors duration-[400ms] group-hover/tool:bg-red group-hover/tool:text-white">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-[12px] text-muted num transition-colors group-hover/tool:text-white/40">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="type-h3 mt-auto pt-10">{tool.name}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted transition-colors group-hover/tool:text-white/60">{tool.description}</p>
                  <ArrowUpRight className="absolute bottom-7 right-7 size-5 -translate-x-1 translate-y-1 opacity-0 transition-all duration-[400ms] group-hover/tool:translate-x-0 group-hover/tool:translate-y-0 group-hover/tool:text-red group-hover/tool:opacity-100" aria-hidden />
                </Link>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}
