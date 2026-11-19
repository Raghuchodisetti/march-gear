"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Tabs } from "@/components/ui/tabs";
import { EASE } from "@/lib/motion";

export interface Panel {
  value: string;
  label: string;
  count?: number;
  content: ReactNode;
}

/** Tabs over server-rendered panels — keeps the card grids on the server. */
export function TabbedPanels({ panels, ariaLabel }: { panels: Panel[]; ariaLabel: string }) {
  const [value, setValue] = useState(panels[0]?.value ?? "");
  const current = panels.find((p) => p.value === value) ?? panels[0];
  if (!current) return null;
  return (
    <div>
      <Tabs
        ariaLabel={ariaLabel}
        value={current.value}
        onChange={setValue}
        items={panels.map((p) => ({ value: p.value, label: p.label, count: p.count }))}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.value}
          role="tabpanel"
          aria-label={current.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="pt-10"
        >
          {current.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
