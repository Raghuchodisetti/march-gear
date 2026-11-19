"use client";

import { Check } from "lucide-react";
import { pdiPlans, type PdiPlanId } from "@/data/pdi";
import { createPersistentStore, useStore } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Shared between the plan cards and the booking form. */
export const pdiPlanStore = createPersistentStore<PdiPlanId>("mg.pdi.plan", "complete");

export function PdiPlans() {
  const selected = useStore(pdiPlanStore);

  const choose = (id: PdiPlanId) => {
    pdiPlanStore.set(id);
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
      {pdiPlans.map((plan) => {
        const Icon = plan.icon;
        const dark = plan.popular;
        return (
          <article
            key={plan.id}
            className={cn(
              "relative flex flex-col border p-7 md:p-8",
              dark ? "border-ink bg-ink text-white" : "border-line bg-white",
              selected === plan.id && !dark && "border-ink",
            )}
          >
            {plan.popular && (
              <span className="absolute right-6 top-6 inline-flex h-6 items-center rounded-full bg-red px-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">
                Most popular
              </span>
            )}
            <span className={cn("inline-flex size-12 items-center justify-center rounded-full", dark ? "bg-white/10" : "bg-mist")}>
              <Icon aria-hidden className="size-5" />
            </span>
            <h3 className="type-h3 mt-6">{plan.name}</h3>
            <p className={cn("mt-2 text-[14.5px] leading-relaxed", dark ? "text-white/65" : "text-muted")}>{plan.summary}</p>
            <p className="mt-6 flex items-baseline gap-2">
              <span className="font-display text-4xl font-semibold tracking-[-0.03em] num">{formatINR(plan.price)}</span>
              <span className={cn("text-[13px]", dark ? "text-white/55" : "text-muted")}>per car</span>
            </p>
            <p className={cn("mt-1 text-[13px] num", dark ? "text-white/55" : "text-muted")}>
              {plan.checks}+ checks · {plan.duration}
            </p>
            <ul className={cn("mt-6 space-y-3 border-t pt-6 text-[14px]", dark ? "border-white/10" : "border-line")}>
              {plan.features.map((f) => (
                <li key={f} className="flex gap-3">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-red" strokeWidth={2.5} />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-8">
              <Button variant={dark ? "primary" : "dark"} className="w-full" onClick={() => choose(plan.id)}>
                Book {plan.name}
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
