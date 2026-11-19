"use client";

import { useEffect } from "react";
import { motion } from "motion/react";

// The first paint must never wait on JavaScript, so only client-side
// navigations fade in. The flag flips after the first mount.
let hasMounted = false;

/**
 * Route transition. Opacity only — a transform here would become the
 * containing block for fixed-position children (sticky bars, modals).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const animateIn = hasMounted;
  useEffect(() => {
    hasMounted = true;
  }, []);

  return (
    <motion.div
      initial={animateIn ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
