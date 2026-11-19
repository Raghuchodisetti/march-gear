"use client";

import { AnimatePresence, motion } from "motion/react";
import { EASE } from "@/lib/motion";

/** Cross-fades text when it changes. Renders statically on first paint. */
export function SwapText({ text, className }: { text: string; className?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={text}
        className={className ?? "block"}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        {text}
      </motion.span>
    </AnimatePresence>
  );
}
