"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";

export interface AccordionItem {
  id: string;
  title: ReactNode;
  content: ReactNode;
}

export function Accordion({
  items,
  defaultOpen,
  multiple = false,
  tone = "dark",
  className,
}: {
  items: AccordionItem[];
  defaultOpen?: string[];
  multiple?: boolean;
  tone?: "dark" | "light";
  className?: string;
}) {
  const [open, setOpen] = useState<string[]>(defaultOpen ?? []);
  const baseId = useId();

  const toggle = (id: string) =>
    setOpen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : multiple ? [...prev, id] : [id]));

  return (
    <div className={cn("divide-y border-y", tone === "dark" ? "divide-line border-line" : "divide-white/10 border-white/10", className)}>
      {items.map((item) => {
        const isOpen = open.includes(item.id);
        const panelId = `${baseId}-${item.id}`;
        return (
          <div key={item.id}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-6 py-5 text-left text-[15px] font-medium transition-colors duration-[250ms] md:text-base",
                  tone === "dark" ? "text-ink hover:text-red" : "text-white hover:text-white/80",
                )}
              >
                <span>{item.title}</span>
                <Plus
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 transition-transform duration-[400ms] ease-[var(--ease-premium)]",
                    isOpen && "rotate-45 text-red",
                  )}
                />
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  role="region"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className={cn("pb-6 pr-10 text-[15px] leading-relaxed", tone === "dark" ? "text-muted" : "text-white/65")}>
                    {item.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
