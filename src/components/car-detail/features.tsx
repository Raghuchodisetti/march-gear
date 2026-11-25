"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { EASE } from "@/lib/motion";
import { Tabs } from "@/components/ui/tabs";
import { useCarDetail } from "./context";

/** Feature groups as underline tabs, with the selected variant's headline kit alongside. */
export function FeatureTabs() {
  const { car, variant } = useCarDetail();
  const [group, setGroup] = useState<string>(car.features[0]?.group ?? "Comfort");
  const current = car.features.find((g) => g.group === group) ?? car.features[0];

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-10">
      <div className="min-w-0 lg:col-span-8">
        <Tabs
          ariaLabel={`${car.name} feature groups`}
          items={car.features.map((g) => ({ value: g.group, label: g.group, count: g.items.length }))}
          value={group}
          onChange={setGroup}
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.group}
            role="tabpanel"
            aria-label={`${current.group} features`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <ul className="mt-8 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
              {current.items.map((item) => (
                <li key={item} className="flex items-start gap-3.5 border-b border-ink/10 py-4 text-[15px]">
                  <span aria-hidden className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
        <p className="mt-5 text-[12.5px] text-muted">Equipment varies by variant. Top-spec availability shown.</p>
      </div>

      <aside className="lg:col-span-4" aria-label={`Highlights of the ${variant.name}`}>
        <div className="border border-line bg-white p-6 md:p-7">
          <p className="type-eyebrow text-muted">Selected variant</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={variant.slug}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p className="type-h3 mt-3">{variant.name}</p>
              <p className="mt-1 text-[13px] text-muted">
                {variant.fuel} · {variant.transmission}
              </p>
              <ul className="mt-6 space-y-3">
                {variant.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-[14px]">
                    <span aria-hidden className="h-px w-4 bg-red" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
          <p className="mt-6 border-t border-line pt-4 text-[12.5px] text-muted">
            Change the variant in the price panel above to see what each trim adds.
          </p>
        </div>
      </aside>
    </div>
  );
}
