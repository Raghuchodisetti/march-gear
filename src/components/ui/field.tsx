"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "h-12 w-full rounded-[3px] border border-line bg-white px-4 text-[15px] text-ink placeholder:text-muted/70 transition-[border-color,box-shadow] duration-[250ms] outline-none hover:border-ink/30 focus:border-ink focus:ring-0 focus-visible:outline-none aria-[invalid=true]:border-red";

export function Label({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-2 block text-[12.5px] font-medium text-ink", className)}>
      {children}
    </label>
  );
}

export function TextField({
  label,
  hint,
  error,
  className,
  prefix,
  ...props
}: Omit<ComponentProps<"input">, "prefix"> & { label?: string; hint?: string; error?: string; prefix?: ReactNode }) {
  const id = useId();
  const inputId = props.id ?? id;
  return (
    <div className={className}>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-muted">{prefix}</span>}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${inputId}-msg` : undefined}
          {...props}
          className={cn(control, Boolean(prefix) && "pl-10")}
        />
      </div>
      {(error || hint) && (
        <p id={`${inputId}-msg`} className={cn("mt-1.5 text-xs", error ? "text-red" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  options,
  className,
  placeholder,
  ...props
}: ComponentProps<"select"> & {
  label?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  const selectId = props.id ?? id;
  return (
    <div className={className}>
      {label && <Label htmlFor={selectId}>{label}</Label>}
      <div className="relative">
        <select id={selectId} {...props} className={cn(control, "cursor-pointer appearance-none pr-10")}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
}

export function TextArea({ label, className, ...props }: ComponentProps<"textarea"> & { label?: string }) {
  const id = useId();
  const areaId = props.id ?? id;
  return (
    <div className={className}>
      {label && <Label htmlFor={areaId}>{label}</Label>}
      <textarea id={areaId} {...props} className={cn(control, "h-auto min-h-28 py-3 leading-relaxed")} />
    </div>
  );
}

/** Labelled range slider with a live value readout. */
export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  minLabel,
  maxLabel,
  tone = "dark",
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  minLabel?: string;
  maxLabel?: string;
  tone?: "dark" | "light";
  className?: string;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  const light = tone === "light";
  return (
    <div className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <label htmlFor={id} className={cn("text-[13px]", light ? "text-white/65" : "text-muted")}>
          {label}
        </label>
        <output htmlFor={id} className={cn("type-h4 num", light ? "text-white" : "text-ink")}>
          {format ? format(value) : value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn("mg-range", light && "mg-range-dark")}
        style={{ ["--fill" as string]: `${pct}%` }}
      />
      {(minLabel || maxLabel) && (
        <div className={cn("mt-1 flex justify-between text-[11px]", light ? "text-white/40" : "text-muted")}>
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}

/** Segmented control for 2–5 mutually exclusive options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  tone = "dark",
  ariaLabel,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  tone?: "dark" | "light";
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex rounded-[3px] p-1", tone === "dark" ? "bg-mist" : "bg-white/10", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-9 min-w-0 flex-1 whitespace-nowrap rounded-[2px] px-2 text-[13px] sm:px-4 font-medium transition-[background-color,color,box-shadow] duration-[250ms]",
              tone === "dark"
                ? active
                  ? "bg-white text-ink shadow-soft"
                  : "text-muted hover:text-ink"
                : active
                  ? "bg-white text-ink"
                  : "text-white/60 hover:text-white",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
