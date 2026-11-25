"use client";

import { useState, type ReactNode } from "react";
import { useDeskRouter as useRouter } from "@/components/admin/desk";
import { ChevronDown, Loader2, Plus, X } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────
   One decision dialog for every insurance admin workflow (vendors,
   products, covers): remarks, required-correction lists (optionally
   tagged with a wizard step), document picks, toggles and selects.
   Shared by the vendors, products and covers screens.
   ────────────────────────────────────────────────────────────── */

export const OFFLINE: { ok: false; error: string } = { ok: false, error: "Couldn't reach the server. Please try again." };

export type DialogValues = Record<string, string | string[] | boolean>;
export type DialogField =
  | { name: string; kind: "textarea"; label: string; placeholder?: string; hint?: string; optional?: boolean; rows?: number }
  | { name: string; kind: "list"; label: string; placeholder?: string; hint?: string; suggestions?: string[]; areas?: Record<string, string>; optional?: boolean }
  | { name: string; kind: "checks"; label: string; hint?: string; options: { value: string; label: string; note?: string }[] }
  | { name: string; kind: "toggle"; label: string; hint?: string }
  | { name: string; kind: "select"; label: string; hint?: string; options: { value: string; label: string }[] };

export interface DialogSpec {
  title: string;
  description?: ReactNode;
  notice?: ReactNode;
  fields: DialogField[];
  initial?: DialogValues;
  submitLabel: string;
  tone?: "primary" | "dark" | "danger";
  icon?: ReactNode;
  run: (values: DialogValues) => Promise<ActionResult<object>>;
  done: string | ((res: Record<string, unknown>) => string);
}

export const control = "w-full rounded-[3px] border border-line bg-white px-3.5 text-[14px] outline-none transition-colors hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red";

function errorFor(errors: Record<string, string>, name: string) {
  return errors[name] ?? Object.entries(errors).find(([k]) => k.startsWith(`${name}.`))?.[1];
}

/** "area: text" → its parts, for any set of areas. */
function splitItem(item: string, areas?: Record<string, string>) {
  if (!areas) return { area: null as string | null, text: item };
  const m = /^([a-z_]+):\s*([\s\S]*)$/.exec(item);
  return m && areas[m[1]] ? { area: m[1], text: m[2] } : { area: null, text: item };
}

function ListField({ field, value, onChange, error }: { field: Extract<DialogField, { kind: "list" }>; value: string[]; onChange: (v: string[]) => void; error?: string }) {
  const [draft, setDraft] = useState("");
  const [area, setArea] = useState("");
  const add = (text: string) => {
    const t = text.trim();
    if (!t) return;
    // Suggestions may carry their own area; typed items take the chosen one.
    const item = splitItem(t, field.areas).area || !area ? t : `${area}: ${t}`;
    if (value.includes(item)) return;
    onChange([...value, item]);
    setDraft("");
  };
  const unused = (field.suggestions ?? []).filter((s) => !value.includes(s));
  return (
    <div>
      <p className="mb-2 text-[12.5px] font-medium">
        {field.label} {field.optional && <span className="font-normal text-muted">(optional)</span>}
      </p>
      {value.length > 0 && (
        <ol className="mb-2 space-y-1.5">
          {value.map((v, i) => {
            const parts = splitItem(v, field.areas);
            return (
              <li key={v} className="flex items-start gap-2 rounded-[3px] border border-line bg-mist/50 px-3 py-2 text-[13.5px]">
                <span className="mt-px text-[12px] font-semibold text-muted num">{i + 1}.</span>
                <span className="min-w-0 flex-1 break-words">
                  {parts.area && field.areas && (
                    <span className="mr-1.5 rounded-full bg-white px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted ring-1 ring-line">{field.areas[parts.area]}</span>
                  )}
                  {parts.text}
                </span>
                <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove “${parts.text}”`} className="-mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white hover:text-red">
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        {field.areas && (
          <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Application step" className={cn(control, "h-10 w-full cursor-pointer sm:w-40")}>
            <option value="">Any step</option>
            {Object.entries(field.areas).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        )}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder={field.placeholder ?? "Describe what to fix…"}
          aria-label={`Add to ${field.label}`}
          aria-invalid={error ? true : undefined}
          className={cn(control, "h-10 min-w-0 flex-1")}
        />
        <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => add(draft)} disabled={!draft.trim()} icon={<Plus aria-hidden className="size-4" />}>
          Add
        </Button>
      </div>
      {unused.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {unused.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="inline-flex max-w-full items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-1 text-left text-[12px] text-muted transition-colors hover:border-ink hover:text-ink">
              <Plus aria-hidden className="size-3 shrink-0" /> <span className="truncate">{splitItem(s, field.areas).text}</span>
            </button>
          ))}
        </div>
      )}
      {(error || field.hint) && <p className={cn("mt-1.5 text-xs", error ? "text-red" : "text-muted")}>{error ?? field.hint}</p>}
    </div>
  );
}

function DialogBody({ spec, onClose }: { spec: DialogSpec; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useUI();
  const [values, setValues] = useState<DialogValues>(() => {
    const init: DialogValues = {};
    for (const f of spec.fields) init[f.name] = f.kind === "list" || f.kind === "checks" ? [] : f.kind === "toggle" ? false : f.kind === "select" ? (f.options[0]?.value ?? "") : "";
    return { ...init, ...spec.initial };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (name: string, v: string | string[] | boolean) => {
    setValues((p) => ({ ...p, [name]: v }));
    setErrors((e) => (errorFor(e, name) ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== name && !k.startsWith(`${name}.`))) : e));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = (await spec.run(values).catch(() => OFFLINE)) as ActionResult<Record<string, unknown>>;
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast(res.error ?? "Couldn't save that. Please try again.", { tone: "error" });
      return;
    }
    toast(typeof spec.done === "function" ? spec.done(res) : spec.done, { tone: "success" });
    onClose();
    router.refresh();
  };

  const tone = spec.tone ?? "primary";
  // Errors on fields the dialog doesn't show (e.g. a server check) still need to be visible.
  const stray = Object.entries(errors).filter(([k]) => !spec.fields.some((f) => k === f.name || k.startsWith(`${f.name}.`)));
  return (
    <form onSubmit={submit} noValidate>
      <div className="space-y-5 px-6 py-5 sm:px-8">
        {spec.notice}
        {spec.fields.map((f, i) => {
          const err = errorFor(errors, f.name);
          const auto = i === 0 ? { "data-autofocus": true } : {};
          if (f.kind === "textarea")
            return (
              <div key={f.name}>
                <label htmlFor={`dlg-${f.name}`} className="mb-2 block text-[12.5px] font-medium">
                  {f.label} {f.optional && <span className="font-normal text-muted">(optional)</span>}
                </label>
                <textarea
                  id={`dlg-${f.name}`}
                  rows={f.rows ?? 4}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={f.placeholder}
                  aria-invalid={err ? true : undefined}
                  className={cn(control, "py-2.5 leading-relaxed")}
                  {...auto}
                />
                {(err || f.hint) && <p className={cn("mt-1.5 text-xs", err ? "text-red" : "text-muted")}>{err ?? f.hint}</p>}
              </div>
            );
          if (f.kind === "select")
            return (
              <div key={f.name}>
                <label htmlFor={`dlg-${f.name}`} className="mb-2 block text-[12.5px] font-medium">
                  {f.label}
                </label>
                <div className="relative">
                  <select id={`dlg-${f.name}`} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} aria-invalid={err ? true : undefined} className={cn(control, "h-11 cursor-pointer appearance-none pr-10")} {...auto}>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                </div>
                {(err || f.hint) && <p className={cn("mt-1.5 text-xs", err ? "text-red" : "text-muted")}>{err ?? f.hint}</p>}
              </div>
            );
          if (f.kind === "list") return <ListField key={f.name} field={f} value={(values[f.name] as string[]) ?? []} onChange={(v) => set(f.name, v)} error={err} />;
          if (f.kind === "checks") {
            const picked = (values[f.name] as string[]) ?? [];
            return (
              <fieldset key={f.name}>
                <legend className="mb-2 text-[12.5px] font-medium">{f.label}</legend>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {f.options.map((o) => {
                    const on = picked.includes(o.value);
                    return (
                      <label key={o.value} className={cn("flex cursor-pointer items-start gap-2.5 rounded-[3px] border px-3 py-2.5 text-[13px] transition-colors", on ? "border-ink bg-mist/60" : "border-line hover:border-ink/30")}>
                        <input type="checkbox" checked={on} onChange={() => set(f.name, on ? picked.filter((x) => x !== o.value) : [...picked, o.value])} className="mt-0.5 size-4 accent-[var(--color-red)]" />
                        <span className="min-w-0">
                          <span className="block font-medium">{o.label}</span>
                          {o.note && <span className="block text-[12px] text-muted">{o.note}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {(err || f.hint) && <p className={cn("mt-1.5 text-xs", err ? "text-red" : "text-muted")}>{err ?? f.hint}</p>}
              </fieldset>
            );
          }
          return (
            <div key={f.name}>
              <label className={cn("flex cursor-pointer items-start gap-3 rounded-[3px] border px-3.5 py-3", err ? "border-red" : "border-line")}>
                <input type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-red)]" />
                <span>
                  <span className="block text-[13.5px] font-medium">{f.label}</span>
                  {f.hint && <span className="block text-[12px] text-muted">{f.hint}</span>}
                </span>
              </label>
              {err && <p className="mt-1.5 text-xs text-red">{err}</p>}
            </div>
          );
        })}
        {stray.length > 0 && (
          <p role="alert" className="rounded-[3px] border-l-2 border-red bg-red-50 px-3.5 py-2.5 text-[13px] text-red">
            {stray[0][1]}
          </p>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant={tone === "dark" ? "dark" : "primary"}
          className={cn(tone === "danger" && "bg-red hover:bg-red-600")}
          disabled={busy}
          icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : spec.icon}
        >
          {spec.submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** One dialog for every decision. `open(spec)` shows it; the returned element must be rendered. */
export function useInsDialog() {
  const [spec, setSpec] = useState<DialogSpec | null>(null);
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(0);
  const element = (
    <Modal open={open} onClose={() => setOpen(false)} title={spec?.title} description={spec?.description} size="lg">
      {spec && <DialogBody key={n} spec={spec} onClose={() => setOpen(false)} />}
    </Modal>
  );
  return {
    open: (s: DialogSpec) => {
      setSpec(s);
      setN((x) => x + 1);
      setOpen(true);
    },
    element,
  };
}

/** Runs a one-click action (no dialog) with a toast and a refresh. */
export function useQuickRun() {
  const router = useRouter();
  const { toast } = useUI();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<ActionResult<object>>, done: string) => {
    setBusy(key);
    const res = await fn().catch(() => OFFLINE);
    setBusy(null);
    if (!res.ok) return toast(res.error ?? "Something went wrong", { tone: "error" });
    toast(done, { tone: "success" });
    router.refresh();
  };
  return { busy, run };
}

export const actionBtn = "inline-flex h-9 items-center justify-center gap-1.5 rounded-[3px] border px-3 text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40";
export const btnTone = {
  primary: "border-red bg-red text-white hover:bg-red-600",
  dark: "border-ink bg-ink text-white hover:bg-ink-3",
  outline: "border-line bg-white hover:border-ink",
  danger: "border-line bg-white text-red hover:border-red hover:bg-red-50",
};

/** A notice box inside a dialog. */
export function DialogNotice({ tone = "neutral", children }: { tone?: "neutral" | "amber" | "green" | "red"; children: ReactNode }) {
  const cls = {
    neutral: "border-line bg-mist/60 text-ink",
    amber: "border-[#e09200]/30 bg-[#fdf3e1] text-[#7a4800]",
    green: "border-[#1e7a3c]/20 bg-[#e8f5ec] text-[#1e7a3c]",
    red: "border-red/20 bg-red-50 text-red-600",
  }[tone];
  return <div className={cn("rounded-[3px] border px-4 py-3 text-[13px]", cls)}>{children}</div>;
}
