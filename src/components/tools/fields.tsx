"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Label } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** Mirrors the shared field control so bespoke inputs sit flush with TextField/SelectField. */
const control =
  "h-12 w-full rounded-[3px] border border-line bg-white px-4 text-[16px] font-medium text-ink num placeholder:font-normal placeholder:text-muted/70 transition-[border-color] duration-[250ms] outline-none hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red";

/**
 * Numeric input with a leading symbol and trailing unit — "₹ 105 /L".
 * Value is kept as a string so the field can be cleared while typing.
 */
export function UnitField({
  label,
  value,
  onChange,
  prefix,
  unit,
  hint,
  error,
  decimals = true,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  unit?: string;
  hint?: ReactNode;
  error?: string;
  decimals?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[15px] text-muted">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode={decimals ? "decimal" : "numeric"}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? msgId : undefined}
          onChange={(e) => {
            const cleaned = e.target.value.replace(decimals ? /[^\d.]/g : /\D/g, "");
            const [whole, ...rest] = cleaned.split(".");
            onChange(rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole);
          }}
          className={cn(control, prefix && "pl-9", unit && "pr-16")}
        />
        {unit && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[12.5px] text-muted">
            {unit}
          </span>
        )}
      </div>
      {(error || hint) && (
        <p id={msgId} className={cn("mt-1.5 text-xs", error ? "text-red" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** Accessible on/off switch with a visible label. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  className,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-6", className)}>
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-[14.5px] font-medium text-ink">
          {label}
        </p>
        {description && (
          <p id={`${id}-desc`} className="mt-1 text-[13px] leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-[250ms] ease-[var(--ease-premium)] disabled:cursor-wait disabled:opacity-50",
          checked ? "bg-ink" : "bg-line hover:bg-ink/20",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "inline-block size-5 rounded-full bg-white shadow-soft transition-transform duration-[250ms] ease-[var(--ease-premium)]",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

/** Tracks an element's rendered width so SVG charts can draw at true pixel size. */
export function useElementWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
