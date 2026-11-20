"use client";

import type { ReactNode } from "react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductFormValue, SectionKey } from "./shared";

/* The frame every product-form section uses, and the props sections share. */

export type Group = "eligibility" | "coverage" | "pricing" | "deductibles" | "documents";

export interface SectionProps {
  v: ProductFormValue;
  set: <K extends keyof ProductFormValue>(k: K, val: ProductFormValue[K]) => void;
  setIn: <G extends Group>(g: G, p: Partial<ProductFormValue[G]>) => void;
  err: (k: string) => string | undefined;
  disabled: boolean;
}

export function Section({
  id,
  index,
  title,
  description,
  state,
  children,
  action,
}: {
  id: SectionKey;
  index: number;
  title: string;
  description?: ReactNode;
  state: "ready" | "todo" | "error" | "optional";
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section id={`sec-${id}`} data-section={id} aria-labelledby={`sec-${id}-title`} className="scroll-mt-[8.5rem] border border-line bg-white">
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 md:px-6">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 font-mono text-[11.5px] text-red num">{String(index).padStart(2, "0")}</span>
          <div className="min-w-0">
            <h2 id={`sec-${id}-title`} className="text-[15px] font-semibold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {action}
          <StatePill state={state} />
        </div>
      </header>
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}

export function StatePill({ state }: { state: "ready" | "todo" | "error" | "optional" }) {
  if (state === "optional") return <span className="hidden text-[12px] text-muted sm:inline">Optional</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12px] font-medium", state === "ready" ? "text-[#1e7a3c]" : state === "error" ? "text-red" : "text-muted")}>
      {state === "ready" ? <Check aria-hidden className="size-3.5" strokeWidth={2.5} /> : <Circle aria-hidden className="size-3" />}
      <span className="hidden sm:inline">{state === "ready" ? "Ready" : state === "error" ? "Check" : "To do"}</span>
    </span>
  );
}

/** A small inline note under a group of fields. */
export function Note({ tone = "muted", children }: { tone?: "muted" | "amber" | "red"; children: ReactNode }) {
  return <p className={cn("text-[12.5px] leading-relaxed", tone === "amber" ? "text-[#9a5b00]" : tone === "red" ? "text-red" : "text-muted")}>{children}</p>;
}
