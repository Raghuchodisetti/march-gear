"use client";

import { useState, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { Tabs } from "@/components/ui/tabs";

/* Small shared pieces for the dealer-portal account modules (dashboard, profile, showrooms, brands, staff, settings). */

/** Runs a Server Action with a busy flag, field errors and toasts. Resolves to the result on success, null otherwise. */
export function useAction() {
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = async <T extends object>(fn: () => Promise<ActionResult<T>>, success?: string) => {
    setBusy(true);
    try {
      const res = await fn();
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast(res.error ?? "Please check the highlighted fields.", { tone: "error" });
        return null;
      }
      setErrors({});
      if (success) toast(success, { tone: "success" });
      return res;
    } catch {
      toast("Couldn't reach the server. Please try again.", { tone: "error" });
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, errors, setErrors, run };
}

/** On/off switch with a visible label. */
export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4", disabled && "cursor-not-allowed opacity-50")}>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[12.5px] text-muted">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span
          aria-hidden
          className="h-6 w-10 rounded-full bg-[#dcdcdc] transition-colors duration-300 peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-red/40 peer-focus-visible:ring-offset-2"
        />
        <span aria-hidden className="absolute left-1 top-1 size-4 rounded-full bg-white shadow-soft transition-transform duration-300 ease-[var(--ease-premium)] peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

/** A square checkbox with label (permission matrices, model pickers). */
export function Check2({ checked, onChange, label, hint, disabled, className }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean; className?: string }) {
  return (
    <label className={cn("group flex cursor-pointer items-start gap-3", disabled && "cursor-not-allowed opacity-55", className)}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span
          aria-hidden
          className="inline-flex size-[18px] items-center justify-center rounded-[3px] border border-ink/25 bg-white text-white transition-colors duration-200 group-hover:border-ink peer-checked:border-ink peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-red/40"
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] leading-[18px] text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** A confirm dialog for destructive or consequential actions. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirm,
  tone = "dark",
  busy,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body?: ReactNode;
  confirm: string;
  tone?: "dark" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="px-6 py-5 sm:px-8">
        {body && <div className="text-[14px] leading-relaxed text-muted">{body}</div>}
        {children}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone} size="sm" onClick={onConfirm} disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
            {confirm}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Section heading inside a form panel. Put it inside an `@container` — it goes two-column when there is room. */
export function FormSection({ title, description, children, aside }: { title: string; description?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-5 border-t border-line py-7 first:border-t-0 first:pt-0 last:pb-0 @3xl:grid-cols-[220px_minmax(0,1fr)] @3xl:gap-10">
      <div>
        <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
        {description && <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{description}</p>}
        {aside}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Save bar under a form. */
export function SaveBar({ busy, dirty, onSave, onReset, label = "Save changes", note }: { busy: boolean; dirty: boolean; onSave: () => void; onReset?: () => void; label?: string; note?: ReactNode }) {
  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12.5px] text-muted">{note ?? (dirty ? "You have unsaved changes." : "All changes saved.")}</p>
      <div className="flex gap-2">
        {onReset && dirty && (
          <Button variant="ghost" size="sm" onClick={onReset} disabled={busy}>
            Discard
          </Button>
        )}
        <Button variant="dark" size="sm" onClick={onSave} disabled={busy || !dirty} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
          {label}
        </Button>
      </div>
    </div>
  );
}

/** Tabs whose panels are rendered on the server; the active tab is kept in `?tab=` without a navigation. */
export function PageTabs({ items, panels, initial }: { items: { value: string; label: string; count?: number }[]; panels: Record<string, ReactNode>; initial: string }) {
  const [tab, setTab] = useState(items.some((i) => i.value === initial) ? initial : items[0].value);
  const change = (v: string) => {
    setTab(v);
    const url = new URL(window.location.href);
    if (v === items[0].value) url.searchParams.delete("tab");
    else url.searchParams.set("tab", v);
    window.history.replaceState(window.history.state, "", url);
  };
  return (
    <div>
      <Tabs items={items} value={tab} onChange={change} className="mb-6" ariaLabel="Sections" />
      <div key={tab} className="animate-rise">
        {panels[tab]}
      </div>
    </div>
  );
}

/** Compact text input for dense portal forms (same look as TextField, smaller). */
export const inputCls =
  "h-11 w-full rounded-[3px] border border-line bg-white px-3.5 text-[14px] text-ink placeholder:text-muted outline-none transition-colors duration-200 hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red disabled:bg-mist disabled:text-muted";

export function FieldError({ msg, id }: { msg?: string; id?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="mt-1.5 text-xs text-red">
      {msg}
    </p>
  );
}
