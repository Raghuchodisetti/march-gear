"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useSpring } from "motion/react";

/**
 * Wraps the readable part of an article and draws a thin red progress
 * rule fixed directly beneath the sticky 72px header.
 */
export function ReadingProgress({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 72px", "end end"] });
  const scaleX = useSpring(scrollYProgress, { stiffness: 220, damping: 40, restDelta: 0.001 });

  return (
    <div ref={ref} className={className}>
      <motion.div aria-hidden className="fixed inset-x-0 top-[72px] z-40 h-[2px] origin-left bg-red" style={{ scaleX }} />
      {children}
    </div>
  );
}
