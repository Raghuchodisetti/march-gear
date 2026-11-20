"use client";

import { Check, Download, Lock, Mail, RotateCcw } from "lucide-react";
import { checklistCount, checklistFor } from "@/lib/pdi";
import { createPersistentStore, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useUI } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { Button } from "@/components/ui/button";
import { openChecklistGate, pdiLeadStore } from "./checklist-gate";
import { downloadChecklistPdf } from "./checklist-pdf";
import { PDI_ICON } from "./icons";

const checklistStore = createPersistentStore<string[]>("mg.pdi.checklist", []);

/** Free do-it-yourself PDI checklist. Ticks are saved on this device. */
export function PdiChecklist() {
  const { content } = useCatalog();
  const checklist = content.pdiChecklist;
  const done = useStore(checklistStore);
  const lead = useStore(pdiLeadStore);
  const unlocked = Boolean(lead);
  const [freeGroup, ...lockedGroups] = checklist.groups;
  const baseTotal = checklistCount(checklist.groups);
  const lockedCount = checklistCount(lockedGroups);
  // Once unlocked, the list matches the emailed PDF for the buyer's fuel type.
  const groups = unlocked ? checklistFor(checklist, lead?.fuel) : checklist.groups;
  const total = checklistCount(groups);
  const doneCount = groups.reduce((n, g) => n + g.items.filter((i) => done.includes(i.id)).length, 0);
  const { toast } = useUI();
  const pct = Math.round((doneCount / total) * 100);

  const toggle = (id: string) => checklistStore.set((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const reset = () => {
    checklistStore.set([]);
    toast("Checklist cleared");
  };

  const r = 42;
  const c = 2 * Math.PI * r;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
      {/* Progress */}
      <aside className="lg:col-span-4">
        {!unlocked ? (
          <div className="bg-ink p-6 text-white md:p-8 lg:sticky lg:top-28">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-white/10">
              <Mail aria-hidden className="size-5" />
            </span>
            <p className="type-h3 mt-6">Get the full checklist as a PDF</p>
            <p className="mt-3 text-[14.5px] leading-relaxed text-white/65">
              The first {freeGroup.items.length} checks are free to use here. Tell us about your car and we&apos;ll email you all {baseTotal}+ checks as a printable PDF, with extras for your fuel type — and unlock them on this page.
            </p>
            <ul className="mt-6 space-y-2.5 text-[14px] text-white/80">
              {["Printable PDF with tick boxes", "Tips for every tricky check", "Works offline at the dealership"].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-red" strokeWidth={2.5} />
                  {t}
                </li>
              ))}
            </ul>
            <Button className="mt-8 w-full" onClick={openChecklistGate} icon={<Lock className="size-4" aria-hidden />}>
              Unlock &amp; get the PDF
            </Button>
          </div>
        ) : (
        <div className="border border-line bg-white p-6 md:p-8 lg:sticky lg:top-28">
          <div className="flex items-center gap-6">
            <svg viewBox="0 0 100 100" className="size-28 shrink-0 -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-mist" />
              <circle
                cx="50"
                cy="50"
                r={r}
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className="stroke-red transition-[stroke-dashoffset] duration-500"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - pct / 100)}
              />
            </svg>
            <div aria-live="polite">
              <p className="font-display text-4xl font-semibold tracking-[-0.03em] num">{pct}%</p>
              <p className="mt-1 text-[14px] text-muted num">
                {doneCount} of {total} checks done
              </p>
            </div>
          </div>
          <ul className="mt-8 space-y-3 border-t border-line pt-6">
            {groups.map((g) => {
              const n = g.items.filter((i) => done.includes(i.id)).length;
              const complete = n === g.items.length;
              return (
                <li key={g.id}>
                  <a href={`#pdi-${g.id}`} className="flex items-center justify-between gap-3 text-[14px] transition-colors hover:text-red">
                    <span className="flex items-center gap-2.5">
                      <span className={cn("inline-flex size-5 items-center justify-center rounded-full", complete ? "bg-red text-white" : "bg-mist text-transparent")}>
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      {g.title}
                    </span>
                    <span className="text-[12.5px] text-muted num">
                      {n}/{g.items.length}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="mt-8 flex gap-2">
            <button
              type="button"
              onClick={() => downloadChecklistPdf({ checklist, phone: content.site.phone }, lead)}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[3px] border border-line text-[13px] font-medium transition-colors hover:border-ink"
            >
              <Download aria-hidden className="size-4" /> Download PDF
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={doneCount === 0}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[3px] border border-line text-[13px] font-medium transition-colors hover:border-ink disabled:opacity-40"
            >
              <RotateCcw aria-hidden className="size-4" /> Start over
            </button>
          </div>
          <p className="mt-4 text-[12px] text-muted">
            PDF{lead?.car && ` for your ${lead.car}${lead.fuel ? ` (${lead.fuel})` : ""}`} sent to <span className="text-ink">{lead?.email}</span>. Your ticks are saved on this device, so you can use it at the dealership.
          </p>
        </div>
        )}
      </aside>

      {/* Items */}
      <div className="space-y-6 lg:col-span-8">
        {(unlocked ? groups : [freeGroup]).map((g) => {
          const Icon = PDI_ICON[g.icon];
          return (
            <section key={g.id} id={`pdi-${g.id}`} aria-labelledby={`pdi-${g.id}-title`} className="scroll-mt-32 border border-line bg-white">
              <h3 id={`pdi-${g.id}-title`} className="flex items-center gap-3 border-b border-line px-5 py-4 text-[16px] font-semibold md:px-6">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-mist">
                  <Icon aria-hidden className="size-4" />
                </span>
                {g.title}
              </h3>
              <ul className="divide-y divide-line">
                {g.items.map((item) => {
                  const on = done.includes(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => toggle(item.id)}
                        className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-mist/60 md:px-6"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 inline-flex size-[22px] shrink-0 items-center justify-center rounded-[4px] border-2 transition-colors duration-[250ms]",
                            on ? "border-red bg-red text-white" : "border-ink/25",
                          )}
                        >
                          {on && <Check className="size-3.5" strokeWidth={3} />}
                        </span>
                        <span>
                          <span className={cn("block text-[15px] leading-snug transition-colors", on ? "text-muted line-through decoration-ink/30" : "text-ink")}>{item.text}</span>
                          {item.tip && <span className="mt-1 block text-[13px] leading-relaxed text-muted">Tip: {item.tip}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        {!unlocked && (
          <div className="relative">
            <div aria-hidden className="pointer-events-none select-none space-y-6 opacity-60 blur-[3px]">
              {lockedGroups.slice(0, 2).map((g) => (
                <div key={g.id} className="border border-line bg-white">
                  <p className="border-b border-line px-6 py-4 text-[16px] font-semibold">{g.title}</p>
                  <ul className="divide-y divide-line">
                    {g.items.slice(0, 4).map((i) => (
                      <li key={i.id} className="flex items-start gap-4 px-6 py-4 text-[15px]">
                        <span className="mt-0.5 inline-flex size-[22px] shrink-0 rounded-[4px] border-2 border-ink/25" />
                        {i.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex items-start justify-center bg-gradient-to-b from-white/30 via-white/80 to-white pt-16">
              <div className="mx-4 max-w-md border border-line bg-white p-7 text-center shadow-lift">
                <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-red-50 text-red">
                  <Lock aria-hidden className="size-5" />
                </span>
                <p className="type-h3 mt-5">{lockedCount} more checks</p>
                <p className="mt-2 text-[14.5px] text-muted">{checklist.lockedSummary} Get them all as a PDF in your inbox.</p>
                <Button className="mt-6" onClick={openChecklistGate} arrow>
                  Unlock &amp; get the PDF
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
