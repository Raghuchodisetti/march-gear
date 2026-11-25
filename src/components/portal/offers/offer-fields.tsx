"use client";

import { useId, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/* Form primitives for the offer editor (consistent with src/components/ui/field). */

const control =
  "w-full rounded-[3px] border border-line bg-white text-[15px] text-ink placeholder:text-muted outline-none transition-[border-color] duration-[250ms] hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red";

export function FieldShell({ label, htmlFor, hint, error, counter, optional, children, className }: { label?: string; htmlFor?: string; hint?: ReactNode; error?: string; counter?: string; optional?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      {(label || counter) && (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink">
              {label}
              {optional && <span className="font-normal text-muted"> (optional)</span>}
            </label>
          )}
          {counter && <span className="shrink-0 text-[11px] text-muted num">{counter}</span>}
        </div>
      )}
      {children}
      {(error || hint) && (
        <p id={htmlFor ? `${htmlFor}-msg` : undefined} className={cn("mt-1.5 text-xs leading-relaxed", error ? "text-red" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function Area({ label, value, onChange, error, hint, rows = 4, maxLength, placeholder, optional, className }: { label: string; value: string; onChange: (v: string) => void; error?: string; hint?: ReactNode; rows?: number; maxLength?: number; placeholder?: string; optional?: boolean; className?: string }) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} error={error} hint={hint} optional={optional} counter={maxLength ? `${value.length.toLocaleString("en-IN")}/${maxLength.toLocaleString("en-IN")}` : undefined} className={className}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={cn(control, "min-h-24 px-4 py-3 leading-relaxed")}
      />
    </FieldShell>
  );
}

export function Input({
  label,
  value,
  onChange,
  error,
  hint,
  maxLength,
  placeholder,
  optional,
  type = "text",
  prefix,
  suffix,
  inputMode,
  className,
  counter = true,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: ReactNode;
  maxLength?: number;
  placeholder?: string;
  optional?: boolean;
  type?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  inputMode?: "numeric" | "decimal" | "text" | "url";
  className?: string;
  counter?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} error={error} hint={hint} optional={optional} counter={maxLength && counter ? `${value.length}/${maxLength}` : undefined} className={className}>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[14px] text-muted">{prefix}</span>}
        <input
          id={id}
          type={type}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          inputMode={inputMode}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          className={cn(control, "h-12 px-4", prefix ? "pl-9" : undefined, suffix ? "pr-10" : undefined)}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[14px] text-muted">{suffix}</span>}
      </div>
    </FieldShell>
  );
}

/** Whole rupees, shown with Indian digit grouping. */
export function MoneyField({ label, value, onChange, error, hint, optional = true }: { label: string; value: number | null; onChange: (v: number | null) => void; error?: string; hint?: ReactNode; optional?: boolean }) {
  return (
    <Input
      label={label}
      optional={optional}
      prefix="₹"
      inputMode="numeric"
      placeholder="0"
      value={value === null ? "" : value.toLocaleString("en-IN")}
      onChange={(v) => {
        const digits = v.replace(/\D/g, "").slice(0, 9);
        onChange(digits ? Number(digits) : null);
      }}
      error={error}
      hint={hint}
    />
  );
}

/** A whole number (units, redemptions). */
export function CountField({ label, value, onChange, error, hint, suffix }: { label: string; value: number | null; onChange: (v: number | null) => void; error?: string; hint?: ReactNode; suffix?: string }) {
  return (
    <Input
      label={label}
      optional
      inputMode="numeric"
      placeholder="No limit"
      suffix={suffix}
      value={value === null ? "" : String(value)}
      onChange={(v) => {
        const digits = v.replace(/\D/g, "").slice(0, 7);
        onChange(digits ? Number(digits) : null);
      }}
      error={error}
      hint={hint}
    />
  );
}

/** Percentage with up to two decimals. Keeps what's typed ("7.") until it parses. */
export function PercentField({ label, value, onChange, error, hint }: { label: string; value: number | null; onChange: (v: number | null) => void; error?: string; hint?: ReactNode }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (value === null ? text !== "" : Number(text) !== value) setText(value === null ? "" : String(value));
  }
  return (
    <Input
      label={label}
      optional
      inputMode="decimal"
      placeholder="0"
      suffix="%"
      value={text}
      onChange={(v) => {
        const clean = v.replace(/[^\d.]/g, "").replace(/^(\d*\.\d{0,2}).*$/, "$1").slice(0, 6);
        setText(clean);
        const n = Number.parseFloat(clean);
        onChange(clean && Number.isFinite(n) ? n : null);
      }}
      error={error}
      hint={hint}
    />
  );
}

export function Chip({ active, onClick, children, disabled, title }: { active: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-[background-color,border-color,color] duration-300 disabled:cursor-not-allowed disabled:opacity-45",
        active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/80 hover:border-ink/40 hover:text-ink",
      )}
    >
      {active && <Check aria-hidden className="size-3.5 shrink-0" />}
      <span className="truncate">{children}</span>
    </button>
  );
}

/** A large radio option with a title and description. */
export function ChoiceCard({ checked, onSelect, title, description, icon, name }: { checked: boolean; onSelect: () => void; title: string; description?: ReactNode; icon?: ReactNode; name: string }) {
  return (
    <label
      className={cn(
        "group/choice relative flex cursor-pointer gap-3 rounded-[4px] border bg-white p-4 transition-[border-color,box-shadow] duration-300",
        checked ? "border-ink shadow-[inset_0_0_0_1px_var(--color-ink)]" : "border-line hover:border-ink/30",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      {icon && <span className={cn("mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors [&>svg]:size-4", checked ? "bg-red text-white" : "bg-mist text-ink")}>{icon}</span>}
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold">{title}</span>
        {description && <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">{description}</span>}
      </span>
      <span aria-hidden className={cn("absolute right-3 top-3 inline-flex size-4 items-center justify-center rounded-full border transition-colors", checked ? "border-red bg-red" : "border-ink/25")}>
        {checked && <span className="size-1.5 rounded-full bg-white" />}
      </span>
    </label>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4 rounded-[4px] border bg-white p-4 transition-colors", checked ? "border-ink" : "border-line hover:border-ink/30")}>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold">{label}</span>
        {description && <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className={cn("relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-300 peer-focus-visible:outline-2 peer-focus-visible:outline-red", checked ? "bg-red" : "bg-ink/15")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow-soft transition-transform duration-300 ease-[var(--ease-premium)]", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
      </span>
    </label>
  );
}

export function SectionCard({ title, description, action, children, className }: { title: string; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("border border-line bg-white", className)}>
      <header className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-start sm:justify-between md:px-6">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="space-y-5 px-5 py-5 md:px-6 md:py-6">{children}</div>
    </section>
  );
}

export function ErrorNote({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-[3px] border border-red/25 bg-red-50 px-3 py-2 text-[13px] text-[#8f1418]">{children}</p>;
}
