"use client";

import { animate, motion, useInView, useMotionValue, useTransform, type HTMLMotionProps } from "motion/react";
import { useEffect, useRef } from "react";
import { fadeUp, stagger, transition } from "@/lib/motion";

type RevealProps = HTMLMotionProps<"div"> & { delay?: number; y?: number; amount?: number };

/** Fades and lifts content into view once. */
export function Reveal({ delay = 0, y = 28, amount = 0.2, children, ...props }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={transition(undefined, delay)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Parent that staggers <RevealItem> children. */
export function RevealGroup({
  children,
  gap = 0.08,
  delay = 0,
  amount = 0.15,
  ...props
}: HTMLMotionProps<"div"> & { gap?: number; delay?: number; amount?: number }) {
  return (
    <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount }} variants={stagger(gap, delay)} {...props}>
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={fadeUp} {...props}>
      {children}
    </motion.div>
  );
}

/** Animated count-up number, triggered when scrolled into view. */
export function Counter({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.6,
  className,
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const value = useMotionValue(0);
  const text = useTransform(value, (v) => `${prefix}${v.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(value, to, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [inView, to, duration, value]);

  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}
