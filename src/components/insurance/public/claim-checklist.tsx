"use client";

import { useState } from "react";
import { Check, Printer, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const GROUPS: { id: string; title: string; when: string; items: string[] }[] = [
  {
    id: "always",
    title: "Every claim",
    when: "Keep these ready whatever happened",
    items: ["Policy copy or policy number", "Registration certificate (RC)", "Driving licence of whoever was driving", "Signed claim form from the insurer", "Photos of the damage and the scene", "Your ID and contact details"],
  },
  {
    id: "accident",
    title: "Accident damage",
    when: "Own-damage repairs",
    items: ["Garage estimate for the repair", "Final repair invoice", "Payment receipt (reimbursement claims)", "FIR or police report, if anyone was hurt or there was a dispute"],
  },
  {
    id: "theft",
    title: "Theft",
    when: "The car is missing",
    items: ["FIR copy", "Police final report that the car is untraced", "All original keys", "Letter informing the RTO", "Signed ownership transfer forms for the insurer", "Loan closure or lender's letter, if financed"],
  },
  {
    id: "reimburse",
    title: "Reimbursement",
    when: "You paid the garage yourself",
    items: ["Original bills and receipts", "Cancelled cheque or bank details", "KYC documents the insurer asks for"],
  },
];

/** A tick-off documents checklist (kept on screen only) with a print button. */
export function ClaimChecklist() {
  const [done, setDone] = useState<string[]>([]);
  const toggle = (k: string) => setDone((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]));
  const total = GROUPS.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6 print:hidden">
        <p className="text-[13px] text-muted num" aria-live="polite">
          {done.length} of {total} ticked
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDone([])}
            disabled={!done.length}
            className="inline-flex h-9 items-center gap-1.5 rounded-[3px] border border-line px-3 text-[13px] font-medium transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw aria-hidden className="size-3.5" /> Reset
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded-[3px] bg-ink px-3 text-[13px] font-medium text-white transition-colors hover:bg-ink-3">
            <Printer aria-hidden className="size-3.5" /> Print
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-px bg-line md:grid-cols-2">
        {GROUPS.map((g) => (
          <fieldset key={g.id} className="min-w-0 bg-white p-5 sm:p-6">
            <legend className="sr-only">{g.title}</legend>
            <p className="text-[15px] font-semibold">{g.title}</p>
            <p className="mt-0.5 text-[12.5px] text-muted">{g.when}</p>
            <ul className="mt-4 space-y-1">
              {g.items.map((item) => {
                const k = `${g.id}:${item}`;
                const on = done.includes(k);
                return (
                  <li key={k}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-[3px] px-2 py-1.5 text-[14px] leading-snug transition-colors hover:bg-mist">
                      <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(k)} />
                      <span
                        aria-hidden
                        className={cn(
                          "mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-[3px] border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-red",
                          on ? "border-ink bg-ink text-white" : "border-ink/25 bg-white",
                        )}
                      >
                        {on && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className={cn(on && "text-muted line-through decoration-ink/30")}>{item}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
