"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";

/* ──────────────────────────────────────────────────────────────
   Form controls for the insurance vendor catalogue (products,
   coverage, add-ons): labelled fields, chip toggles, line lists,
   unit inputs and a searchable multi-picker.
   ────────────────────────────────────────────────────────────── */

export const control =
  "h-11 w-full rounded-[3px] border border-line bg-white px-3.5 text-[14px] text-ink placeholder:text-muted/70 outline-none transition-[border-color] duration-200 hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red disabled:cursor-not-allowed disabled:bg-mist disabled:text-muted";

export function Field({
  name,
  label,
  hint,
  error,
  optional,
  wide,
  htmlFor,
  children,
  className,
}: {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  wide?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-field={name} className={cn("min-w-0", wide && "sm:col-span-2", className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[12.5px] font-medium text-ink">
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-red">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function SelectBox({
  id,
  value,
  onChange,
  options,
  placeholder,
  error,
  disabled,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={ariaLabel} aria-invalid={error ? true : undefined} className={cn(control, "cursor-pointer appearance-none pr-10")}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="m4 6 4 4 4-4" />
      </svg>
    </div>
  );
}

/** A text input with a unit before or after it (₹, %, years). */
export function UnitInput({
  id,
  value,
  onChange,
  prefix,
  suffix,
  error,
  disabled,
  placeholder,
  inputMode = "decimal",
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
  ariaLabel?: string;
}) {
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[13.5px] text-muted">{prefix}</span>}
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        className={cn(control, "num", prefix && "pl-8", suffix && "pr-16")}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[12.5px] text-muted">{suffix}</span>}
    </div>
  );
}

/** Multi-select as toggle chips (fuels, body types). */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
              on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/40",
            )}
          >
            {on && <Check aria-hidden className="size-3.5" strokeWidth={2.5} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A list of short lines (exclusions, highlights) — Enter adds, each can be removed. */
export function LineList({
  value,
  onChange,
  max,
  maxLength = 200,
  placeholder,
  error,
  disabled,
  ariaLabel,
  numbered,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  max: number;
  maxLength?: number;
  placeholder: string;
  error?: string;
  disabled?: boolean;
  ariaLabel: string;
  numbered?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim().replace(/\s+/g, " ");
    if (!t) return;
    if (value.some((x) => x.toLowerCase() === t.toLowerCase())) return setDraft("");
    if (value.length >= max) return;
    onChange([...value, t.slice(0, maxLength)]);
    setDraft("");
  };
  return (
    <div>
      {value.length > 0 && (
        <ol className="mb-3 divide-y divide-line border border-line">
          {value.map((line, i) => (
            <li key={`${line}-${i}`} className="flex items-start gap-3 bg-white px-3 py-2.5 text-[13.5px]">
              <span className="mt-px w-5 shrink-0 text-[11.5px] text-muted num">{numbered ? `${i + 1}.` : "—"}</span>
              <span className="min-w-0 flex-1 break-words">{line}</span>
              {!disabled && (
                <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove “${line}”`} className="-my-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-mist hover:text-red">
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {!disabled && (
        <div className="flex gap-2">
          <input
            aria-label={ariaLabel}
            className={control}
            value={draft}
            maxLength={maxLength}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            disabled={value.length >= max}
            aria-invalid={error ? true : undefined}
          />
          <Button variant="outline" className="h-11 shrink-0" onClick={add} disabled={!draft.trim() || value.length >= max} icon={<Plus aria-hidden className="size-4" />}>
            Add
          </Button>
        </div>
      )}
      <p className={cn("mt-1.5 text-xs", error ? "text-red" : "text-muted")}>{error ?? `${value.length} of ${max}${disabled ? "" : ". Press Enter to add."}`}</p>
    </div>
  );
}

export interface PickOption {
  value: string;
  label: string;
  group?: string;
  meta?: string;
}

/**
 * A button showing the selection as chips; opens a searchable checklist.
 * Empty means "any" (the `anyLabel`).
 */
export function MultiPicker({
  title,
  description,
  options,
  value,
  onChange,
  anyLabel,
  disabled,
  error,
  max = 300,
  id,
}: {
  title: string;
  description?: string;
  options: PickOption[];
  value: string[];
  onChange: (v: string[]) => void;
  anyLabel: string;
  disabled?: boolean;
  error?: string;
  max?: number;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>(value);
  const labelOf = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return options.filter((o) => !n || `${o.label} ${o.group ?? ""} ${o.meta ?? ""}`.toLowerCase().includes(n));
  }, [options, q]);
  const groups = useMemo(() => {
    const m = new Map<string, PickOption[]>();
    for (const o of shown) m.set(o.group ?? "", [...(m.get(o.group ?? "") ?? []), o]);
    return [...m.entries()];
  }, [shown]);

  const start = () => {
    setSel(value);
    setQ("");
    setOpen(true);
  };
  const toggle = (v: string) => setSel((s) => (s.includes(v) ? s.filter((x) => x !== v) : s.length >= max ? s : [...s, v]));
  const chips = value.slice(0, 12);

  return (
    <div>
      <div className={cn("flex min-h-11 flex-wrap items-center gap-1.5 rounded-[3px] border bg-white px-2 py-1.5", error ? "border-red" : "border-line", disabled && "bg-mist")}>
        {value.length === 0 ? (
          <span className="px-1.5 text-[13.5px] text-muted">{anyLabel}</span>
        ) : (
          <>
            {chips.map((v) => (
              <span key={v} className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-[#fafafa] py-0.5 pl-2.5 pr-1 text-[12.5px]">
                <span className="truncate">{labelOf.get(v) ?? v}</span>
                {!disabled && (
                  <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${labelOf.get(v) ?? v}`} className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white hover:text-red">
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ))}
            {value.length > chips.length && <span className="px-1 text-[12.5px] text-muted">+{value.length - chips.length} more</span>}
          </>
        )}
        {!disabled && (
          <button id={id} type="button" onClick={start} className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-[3px] px-2.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-mist">
            {value.length ? "Change" : "Choose"}
          </button>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description} size="md">
        <div className="flex max-h-[70dvh] flex-col">
          <div className="border-b border-line p-4 sm:px-6">
            <label className="relative block">
              <span className="sr-only">Search</span>
              <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input data-autofocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className={cn(control, "pl-10")} />
            </label>
            <div className="mt-2.5 flex items-center justify-between text-[12.5px] text-muted">
              <span className="num">{sel.length ? `${sel.length} selected` : anyLabel}</span>
              <span className="flex gap-3">
                {shown.length > 0 && shown.length <= 80 && (
                  <button type="button" className="font-medium hover:text-ink" onClick={() => setSel((s) => [...new Set([...s, ...shown.map((o) => o.value)])].slice(0, max))}>
                    Select shown
                  </button>
                )}
                {sel.length > 0 && (
                  <button type="button" className="font-medium hover:text-ink" onClick={() => setSel([])}>
                    Clear
                  </button>
                )}
              </span>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-4">
            {groups.length === 0 && <p className="py-10 text-center text-[13.5px] text-muted">Nothing matches “{q}”.</p>}
            {groups.map(([group, list]) => (
              <div key={group || "all"} className="py-1">
                {group && <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{group}</p>}
                <ul>
                  {list.map((o) => {
                    const on = sel.includes(o.value);
                    return (
                      <li key={o.value}>
                        <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(o.value)} className="flex w-full items-center gap-3 rounded-[3px] px-2 py-2 text-left text-[13.5px] transition-colors hover:bg-mist">
                          <span aria-hidden className={cn("inline-flex size-[18px] shrink-0 items-center justify-center rounded-[3px] border", on ? "border-ink bg-ink text-white" : "border-ink/25 bg-white")}>
                            {on && <Check className="size-3.5" strokeWidth={3} />}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{o.label}</span>
                          {o.meta && <span className="shrink-0 text-[12px] text-muted">{o.meta}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-line p-4 sm:flex-row sm:justify-end sm:px-6">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="dark"
              size="sm"
              onClick={() => {
                onChange(sel);
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </Modal>
      {error && <p className="mt-1.5 text-xs text-red">{error}</p>}
    </div>
  );
}

/** A labelled radio card (pricing basis, PA cover, luxury). */
export function RadioCards<T extends string>({
  options,
  value,
  onChange,
  disabled,
  ariaLabel,
  columns = 2,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  ariaLabel: string;
  columns?: 2 | 3 | 4;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("grid grid-cols-1 gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3", columns === 4 && "sm:grid-cols-2 xl:grid-cols-4")}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-start gap-3 rounded-[3px] border bg-white px-3.5 py-3 text-left transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60",
              on ? "border-ink shadow-[inset_0_0_0_1px_var(--color-ink)]" : "border-line hover:border-ink/40",
            )}
          >
            <span aria-hidden className={cn("mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-ink" : "border-ink/30")}>
              {on && <span className="size-2 rounded-full bg-ink" />}
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium leading-snug">{o.label}</span>
              {o.hint && <span className="mt-0.5 block text-[12px] leading-snug text-muted">{o.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
