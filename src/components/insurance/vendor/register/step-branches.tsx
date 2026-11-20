"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Building2, ChevronDown, Copy, Plus, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { StateCityFields } from "@/components/account/state-city-fields";
import { AreaField, FieldError, Grid, Note } from "@/components/portal/register/controls";
import { INS_MAX_BRANCHES, type InsWizardApplication } from "@/insurance/schemas";
import { newKey, type InsStepProps } from "./step-types";

type Branch = InsWizardApplication["branches"][number];

export function BranchesStep({ app, value, onChange, errors, clear }: InsStepProps<"branches">) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(value.length <= 1 ? value.map((b) => b.key) : value.slice(0, 1).map((b) => b.key)));
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const update = (key: string, patch: Partial<Branch>, ...fields: string[]) => {
    const i = value.findIndex((b) => b.key === key);
    onChange((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
    clear(...fields.map((f) => `${i}.${f}`));
  };

  // Errors are keyed by position, so any change of order clears them (they come back on the next check).
  const clearAll = () => clear("form", ...value.map((_, i) => String(i)));

  const add = (fromRegistered = false) => {
    const first = value.length === 0;
    const c = app.company;
    const branch: Branch = {
      key: newKey(),
      name: first ? "Head office" : "",
      address: fromRegistered ? c.address : "",
      city: fromRegistered ? c.city : "",
      state: fromRegistered ? c.state : "",
      pin: fromRegistered ? c.pin : "",
      phone: "",
      email: first ? app.contact.email : "",
      isPrimary: first,
    };
    onChange((prev) => [...prev, branch]);
    setOpen((s) => new Set([...s, branch.key]));
    clear("form");
  };

  const remove = (key: string) => {
    onChange((prev) => {
      const rest = prev.filter((b) => b.key !== key);
      if (rest.length && !rest.some((b) => b.isPrimary)) rest[0] = { ...rest[0], isPrimary: true };
      return rest;
    });
    setConfirmRemove(null);
    clearAll();
  };

  const move = (from: number, to: number) => {
    onChange((prev) => {
      const next = [...prev];
      const [b] = next.splice(from, 1);
      next.splice(to, 0, b);
      return next;
    });
    clearAll();
  };

  const makePrimary = (key: string) => {
    onChange((prev) => prev.map((b) => ({ ...b, isPrimary: b.key === key })));
    clear("form");
  };

  const toggle = (key: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const branchErrors = (i: number) => Object.keys(errors).filter((k) => k.startsWith(`${i}.`)).length;
  const hasRegistered = Boolean(app.company.address.trim() && app.company.city);

  return (
    <>
      {errors.form && (
        <Note tone="error" className="animate-rise">
          <span data-error="true">{errors.form}</span>
        </Note>
      )}

      {value.length === 0 && (
        <div className="flex flex-col items-center border border-dashed border-ink/20 bg-white px-6 py-14 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
            <Building2 aria-hidden className="size-5" />
          </span>
          <p className="mt-4 text-[15px] font-semibold">Add your head office</p>
          <p className="mt-1 max-w-md text-[13.5px] text-muted">Add every office customers and MarchGear can reach — at least your head office. One of them is your primary branch, shown first on your public page.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {hasRegistered && (
              <Button onClick={() => add(true)} icon={<Copy aria-hidden className="size-4" />}>
                Use the registered office
              </Button>
            )}
            <Button variant={hasRegistered ? "outline" : "primary"} onClick={() => add(false)} icon={<Plus aria-hidden className="size-4" />}>
              Add an office
            </Button>
          </div>
        </div>
      )}

      {value.map((b, i) => {
        const count = branchErrors(i);
        const isOpen = open.has(b.key) || count > 0;
        return (
          <section key={b.key} className={cn("border bg-white transition-colors duration-300", count ? "border-red/40" : "border-line")} data-testid="branch">
            <header className="flex items-center gap-2 px-4 py-4 sm:gap-3 md:px-6">
              <button type="button" onClick={() => toggle(b.key)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-[3px] text-[13px] font-semibold num", b.isPrimary ? "bg-ink text-white" : "bg-mist text-ink")}>{i + 1}</span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">{b.name || "New branch"}</span>
                    {b.isPrimary && <span className="inline-flex h-5 items-center rounded-full bg-red-50 px-2 text-[10.5px] font-semibold text-red">Primary</span>}
                    {count > 0 && <span className="inline-flex h-5 items-center rounded-full bg-red px-2 text-[10.5px] font-semibold text-white">{count} to fix</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-muted">{[b.city, b.state].filter(Boolean).join(", ") || "Address not added yet"}</span>
                </span>
              </button>
              <div className="flex shrink-0 items-center">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink disabled:opacity-30" aria-label={`Move ${b.name || "branch"} up`}>
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === value.length - 1}
                  className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink disabled:opacity-30"
                  aria-label={`Move ${b.name || "branch"} down`}
                >
                  <ArrowDown className="size-4" />
                </button>
                <button type="button" onClick={() => toggle(b.key)} className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink" aria-label={isOpen ? "Collapse" : "Expand"}>
                  <ChevronDown aria-hidden className={cn("size-5 transition-transform duration-300", isOpen && "rotate-180")} />
                </button>
              </div>
            </header>

            {isOpen && (
              <div className="animate-rise space-y-5 border-t border-line px-4 py-6 md:px-6">
                <Grid>
                  <TextField label="Branch name" value={b.name} onChange={(e) => update(b.key, { name: e.target.value }, "name")} error={errors[`${i}.name`]} placeholder="e.g. Head office, Mumbai" />
                  <TextField label="Phone (optional)" type="tel" value={b.phone} onChange={(e) => update(b.key, { phone: e.target.value }, "phone")} error={errors[`${i}.phone`]} placeholder="022 2345 6789" />
                  <AreaField label="Address" rows={2} value={b.address} onChange={(e) => update(b.key, { address: e.target.value }, "address")} error={errors[`${i}.address`]} placeholder="Building, street, area, landmark" className="md:col-span-2" />
                </Grid>
                <StateCityFields
                  idPrefix={`branch-${b.key}`}
                  state={b.state}
                  city={b.city}
                  onState={(v) => update(b.key, { state: v }, "state", "city")}
                  onCity={(v) => update(b.key, { city: v }, "city")}
                  errors={{ state: errors[`${i}.state`], city: errors[`${i}.city`] }}
                  priceHint={false}
                />
                <Grid>
                  <TextField
                    label="PIN code"
                    inputMode="numeric"
                    maxLength={6}
                    value={b.pin}
                    onChange={(e) => update(b.key, { pin: e.target.value.replace(/\D/g, "").slice(0, 6) }, "pin")}
                    error={errors[`${i}.pin`]}
                    className="[&_input]:num"
                  />
                  <TextField label="Email (optional)" type="email" value={b.email} onChange={(e) => update(b.key, { email: e.target.value }, "email")} error={errors[`${i}.email`]} placeholder="branch@yourcompany.in" />
                </Grid>

                <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                  {b.isPrimary ? (
                    <p className="inline-flex items-center gap-2 text-[13px] text-muted">
                      <Star aria-hidden className="size-4 fill-red text-red" /> This is your primary branch.
                    </p>
                  ) : (
                    <button type="button" onClick={() => makePrimary(b.key)} className="inline-flex items-center gap-2 text-[13px] font-medium text-ink hover:text-red">
                      <Star aria-hidden className="size-4" /> Make this the primary branch
                    </button>
                  )}
                  {confirmRemove === b.key ? (
                    <span className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="text-muted">Remove this branch?</span>
                      <Button size="sm" variant="dark" onClick={() => remove(b.key)}>
                        Remove
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>
                        Cancel
                      </Button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmRemove(b.key)} className="inline-flex items-center gap-2 text-[13px] text-muted hover:text-red">
                      <Trash2 aria-hidden className="size-4" /> Remove branch
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        );
      })}

      {value.length > 0 && value.length < INS_MAX_BRANCHES && (
        <button
          type="button"
          onClick={() => add(false)}
          className="flex w-full items-center justify-center gap-2 border border-dashed border-ink/20 bg-white px-4 py-5 text-[14px] font-medium transition-colors duration-300 hover:border-ink"
        >
          <Plus aria-hidden className="size-4" /> Add another branch
        </button>
      )}
      {value.length >= INS_MAX_BRANCHES && <p className="text-[13px] text-muted">That&apos;s the most you can add here. Add more branches from your company profile after approval.</p>}
      <FieldError>{errors.branches}</FieldError>
    </>
  );
}
