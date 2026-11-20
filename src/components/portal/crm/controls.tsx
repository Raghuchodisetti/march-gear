"use client";

import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* Compact form controls for dense portal panels, drawers and modals. */

const control =
  "w-full rounded-[3px] border border-line bg-white px-3 text-[13.5px] text-ink outline-none transition-[border-color] duration-300 placeholder:text-muted/70 hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red disabled:cursor-not-allowed disabled:bg-mist disabled:text-muted";

function Shell({ id, label, error, hint, className, children }: { id: string; label?: ReactNode; error?: string; hint?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-ink/80">
          {label}
        </label>
      )}
      {children}
      {(error || hint) && (
        <p id={`${id}-msg`} className={cn("mt-1.5 text-[12px]", error ? "text-red" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function Input({ label, error, hint, className, ...props }: ComponentProps<"input"> & { label?: ReactNode; error?: string; hint?: ReactNode }) {
  const auto = useId();
  const id = props.id ?? auto;
  return (
    <Shell id={id} label={label} error={error} hint={hint} className={className}>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? `${id}-msg` : undefined} {...props} className={cn(control, "h-10")} />
    </Shell>
  );
}

export function Select({
  label,
  error,
  hint,
  className,
  options,
  placeholder,
  ...props
}: ComponentProps<"select"> & { label?: ReactNode; error?: string; hint?: ReactNode; placeholder?: string; options: { value: string; label: string; disabled?: boolean }[] }) {
  const auto = useId();
  const id = props.id ?? auto;
  return (
    <Shell id={id} label={label} error={error} hint={hint} className={className}>
      <div className="relative">
        <select id={id} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? `${id}-msg` : undefined} {...props} className={cn(control, "h-10 cursor-pointer appearance-none pr-9")}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      </div>
    </Shell>
  );
}

export function Textarea({ label, error, hint, className, ...props }: ComponentProps<"textarea"> & { label?: ReactNode; error?: string; hint?: ReactNode }) {
  const auto = useId();
  const id = props.id ?? auto;
  return (
    <Shell id={id} label={label} error={error} hint={hint} className={className}>
      <textarea id={id} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? `${id}-msg` : undefined} {...props} className={cn(control, "min-h-[88px] py-2.5 leading-relaxed")} />
    </Shell>
  );
}

/** A small popover menu (export options, row actions). Closes on outside click and Escape. */
export function Menu({ trigger, children, align = "right", className }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className={cn("relative", className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-40 mt-1.5 min-w-[240px] animate-[rise_0.35s_var(--ease-premium)_both] border border-line bg-white py-1.5 shadow-soft",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export const menuItem = "flex w-full items-start gap-3 px-4 py-2.5 text-left text-[13.5px] text-ink transition-colors hover:bg-mist";
