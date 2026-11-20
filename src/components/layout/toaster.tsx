"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { EASE } from "@/lib/motion";
import { useUI } from "@/components/providers/app-provider";

export function Toaster() {
  const { toasts, dismissToast } = useUI();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-4 z-[95] flex flex-col items-center gap-2 md:inset-x-auto md:right-6 md:top-[92px] md:items-end"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.2 } }}
            transition={{ duration: 0.4, ease: EASE }}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 bg-ink py-3 pl-4 pr-2 text-[13.5px] text-white shadow-lift"
          >
            {t.tone === "success" ? (
              <CheckCircle2 className="size-4 shrink-0 text-[#4ade80]" aria-hidden />
            ) : t.tone === "error" ? (
              <AlertCircle className="size-4 shrink-0 text-red" aria-hidden />
            ) : (
              <Info className="size-4 shrink-0 text-white/60" aria-hidden />
            )}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <Link href={t.action.href} onClick={() => dismissToast(t.id)} className="shrink-0 px-2 text-[12.5px] font-semibold underline-offset-4 hover:underline">
                {t.action.label}
              </Link>
            )}
            <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white">
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
