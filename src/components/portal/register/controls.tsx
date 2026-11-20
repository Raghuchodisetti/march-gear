"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { AlertTriangle, Check, CircleCheck, Info, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/field";

/* Small form building blocks for the registration wizard. */

/** A white panel for one group of fields. */
export function FormSection({ title, description, action, children, className, id }: { title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("border border-line bg-white", className)}>
      <header className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-start sm:justify-between md:px-7 md:py-5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
          {description && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
      </header>
      <div className="px-5 py-5 md:px-7 md:py-6">{children}</div>
    </section>
  );
}

export function Grid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-x-5 gap-y-5 md:grid-cols-2", className)}>{children}</div>;
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-xs text-red" role="alert">
      {children}
    </p>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  error,
  className,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  error?: string;
  className?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={cn("group flex cursor-pointer items-start gap-3", disabled && "cursor-not-allowed opacity-60")}>
        <span className="relative mt-[2px] inline-flex size-[18px] shrink-0">
          <input
            id={id}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-msg` : undefined}
            className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-[3px] border border-ink/25 bg-white transition-colors duration-300 checked:border-ink checked:bg-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[invalid=true]:border-red"
          />
          <Check aria-hidden className="pointer-events-none absolute inset-0 m-auto size-3 text-white opacity-0 transition-opacity duration-200 peer-checked:opacity-100" strokeWidth={3} />
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] leading-snug text-ink">{label}</span>
          {description && <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">{description}</span>}
        </span>
      </label>
      <FieldError id={`${id}-msg`}>{error}</FieldError>
    </div>
  );
}

export function Switch({ checked, onChange, label, description, className }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-[14px] font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">{description}</span>}
      </label>
      <SwitchButton id={id} checked={checked} onChange={onChange} />
    </div>
  );
}

export function SwitchButton({ id, checked, onChange, label }: { id?: string; checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 ease-[var(--ease-premium)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        checked ? "bg-ink" : "bg-ink/15",
      )}
    >
      <span className={cn("inline-block size-5 rounded-full bg-white shadow-soft transition-transform duration-300 ease-[var(--ease-premium)]", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

/** A large radio option (business type, dealer type…). */
export function ChoiceCard({ selected, onSelect, title, description, icon, className }: { selected: boolean; onSelect: () => void; title: ReactNode; description?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group relative flex h-full w-full flex-col items-start gap-1.5 border bg-white p-4 text-left transition-[border-color,box-shadow,background-color] duration-300 ease-[var(--ease-premium)]",
        selected ? "border-ink shadow-[inset_0_0_0_1px_#111]" : "border-line hover:border-ink/40",
        className,
      )}
    >
      <span className="flex w-full items-start justify-between gap-3">
        {icon && <span className={cn("inline-flex size-9 items-center justify-center rounded-[3px] transition-colors duration-300", selected ? "bg-ink text-white" : "bg-mist text-ink")}>{icon}</span>}
        <span
          aria-hidden
          className={cn("ml-auto inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors duration-300", selected ? "border-red bg-red text-white" : "border-ink/25 bg-white")}
        >
          {selected && <Check className="size-3" strokeWidth={3} />}
        </span>
      </span>
      <span className="text-[14px] font-semibold text-ink">{title}</span>
      {description && <span className="text-[12.5px] leading-relaxed text-muted">{description}</span>}
    </button>
  );
}

const NOTE_TONES = {
  info: { box: "border-line bg-mist/70 text-ink", icon: Info, iconCls: "text-muted" },
  warn: { box: "border-[#f0d9a8] bg-[#fdf6e7] text-[#6b4300]", icon: AlertTriangle, iconCls: "text-[#9a5b00]" },
  success: { box: "border-[#cfe8d7] bg-[#f1f9f3] text-[#185f30]", icon: CircleCheck, iconCls: "text-[#1e7a3c]" },
  dev: { box: "border-dashed border-ink/30 bg-white text-ink", icon: Terminal, iconCls: "text-ink" },
  error: { box: "border-red/30 bg-red-50 text-[#8f1216]", icon: AlertTriangle, iconCls: "text-red" },
} as const;

export function Note({ tone = "info", title, children, className, action }: { tone?: keyof typeof NOTE_TONES; title?: ReactNode; children?: ReactNode; className?: string; action?: ReactNode }) {
  const t = NOTE_TONES[tone];
  const Icon = t.icon;
  return (
    <div className={cn("flex gap-3 border px-4 py-3 text-[13px] leading-relaxed", t.box, className)}>
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", t.iconCls)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/** Multi-line text with the same look and error handling as TextField. */
export function AreaField({ label, error, hint, className, ...props }: ComponentProps<"textarea"> & { label?: string; error?: string; hint?: string }) {
  const id = useId();
  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        {...props}
        className="min-h-[88px] w-full resize-y rounded-[3px] border border-line bg-white px-4 py-3 text-[15px] leading-relaxed text-ink outline-none transition-[border-color] duration-[250ms] placeholder:text-muted/70 hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red"
      />
      {(error || hint) && (
        <p id={`${id}-msg`} className={cn("mt-1.5 text-xs", error ? "text-red" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** A label/value pair for read-only summaries. */
export function Detail({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-[14px] text-ink">{children || <span className="text-muted">—</span>}</dd>
    </div>
  );
}

/** Scrolls to and focuses the first invalid field on the page. */
export function focusFirstError() {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>('[aria-invalid="true"], [data-error="true"]');
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (typeof el.focus === "function") el.focus({ preventScroll: true });
  });
}
