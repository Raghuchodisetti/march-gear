"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { NCB_OPTIONS } from "@/insurance/search";
import { createRenewalAction } from "@/server/actions/ins-renewals";
import { useCatalog } from "@/components/providers/catalog-provider";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/portal/crm/controls";
import { useRun } from "@/components/portal/crm/use-run";
import { RENEWAL_POLICY_TYPES, type MemberOption } from "@/components/insurance/vendor/crm/shared";

/* "Add renewal": one of your own policyholders whose policy is coming up for renewal. */

const EMPTY = {
  name: "",
  mobile: "",
  email: "",
  regNumber: "",
  brand: "",
  model: "",
  variant: "",
  year: "",
  city: "",
  currentInsurer: "",
  policyNumber: "",
  policyType: "Comprehensive",
  expiryDate: "",
  ncbPct: "0",
  premium: "",
  assignedMemberId: "",
  followUpAt: "",
  notes: "",
};

export function AddRenewalModal({ open, onClose, members, canAssign, today, onCreated }: { open: boolean; onClose: () => void; members: MemberOption[]; canAssign: boolean; today: string; onCreated: (id: number) => void }) {
  const catalog = useCatalog();
  const { run, busy, errors } = useRun();
  const [f, setF] = useState(EMPTY);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const brands = useMemo(() => catalog.brands.filter((b) => catalog.cars.some((c) => c.brand === b.slug)).sort((a, b) => a.name.localeCompare(b.name)), [catalog]);
  const models = useMemo(() => catalog.cars.filter((c) => c.brand === f.brand).sort((a, b) => a.name.localeCompare(b.name)), [catalog, f.brand]);
  const variants = catalog.getCar(f.model)?.variants ?? [];
  const thisYear = Number(today.slice(0, 4));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await run("add", () => createRenewalAction(f), (r) => `Renewal ${r.reference} added`);
    if (res) {
      setF(EMPTY);
      onClose();
      onCreated(res.id);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add a renewal" description="A policyholder of yours whose policy is due for renewal. Their details stay private to your team." size="lg">
      <form onSubmit={submit} noValidate className="space-y-6 px-6 py-6 sm:px-8">
        <fieldset className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Customer</legend>
          <Input label="Full name" value={f.name} onChange={set("name")} error={errors.name} maxLength={120} data-autofocus autoComplete="off" />
          <Input label="Mobile" inputMode="tel" value={f.mobile} onChange={set("mobile")} error={errors.mobile} placeholder="10-digit mobile" autoComplete="off" />
          <Input label="Email (optional)" type="email" value={f.email} onChange={set("email")} error={errors.email} autoComplete="off" />
          <Input label="City" value={f.city} onChange={set("city")} error={errors.city} maxLength={64} />
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Vehicle</legend>
          <Input label="Registration number" value={f.regNumber} onChange={(e) => setF((v) => ({ ...v, regNumber: e.target.value.toUpperCase() }))} error={errors.regNumber} placeholder="MH12AB1234" maxLength={16} />
          <Select label="Manufacturing year" value={f.year} onChange={set("year")} options={Array.from({ length: 16 }, (_, i) => ({ value: String(thisYear - i), label: String(thisYear - i) }))} placeholder="Choose year" error={errors.year} />
          <Select label="Brand" value={f.brand} onChange={(e) => setF((v) => ({ ...v, brand: e.target.value, model: "", variant: "" }))} options={brands.map((b) => ({ value: b.slug, label: b.name }))} placeholder="Choose brand" error={errors.brand} />
          <Select label="Model" value={f.model} disabled={!f.brand} onChange={(e) => setF((v) => ({ ...v, model: e.target.value, variant: "" }))} options={models.map((m) => ({ value: m.slug, label: m.name }))} placeholder="Choose model" error={errors.model} />
          <Select label="Variant (optional)" value={f.variant} disabled={!f.model} onChange={set("variant")} options={variants.map((v) => ({ value: v.slug, label: `${v.name} · ${v.fuel}` }))} placeholder="Not sure" error={errors.variant} className="sm:col-span-2" />
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Existing policy</legend>
          <Input label="Current insurer" value={f.currentInsurer} onChange={set("currentInsurer")} error={errors.currentInsurer} maxLength={160} />
          <Input label="Policy number (optional)" value={f.policyNumber} onChange={set("policyNumber")} error={errors.policyNumber} maxLength={60} />
          <Select label="Policy type" value={f.policyType} onChange={set("policyType")} options={RENEWAL_POLICY_TYPES.map((t) => ({ value: t, label: t }))} error={errors.policyType} />
          <Input label="Expiry date" type="date" value={f.expiryDate} onChange={set("expiryDate")} error={errors.expiryDate} />
          <Select label="No-claim bonus" value={f.ncbPct} onChange={set("ncbPct")} options={NCB_OPTIONS.map((n) => ({ value: String(n), label: `${n}%` }))} error={errors.ncbPct} />
          <Input label="Last premium (₹, optional)" inputMode="numeric" value={f.premium} onChange={(e) => setF((v) => ({ ...v, premium: e.target.value.replace(/[^\d]/g, "") }))} error={errors.premium} />
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Follow-up</legend>
          {canAssign ? (
            <Select label="Assign to" value={f.assignedMemberId} onChange={set("assignedMemberId")} options={members.map((m) => ({ value: String(m.id), label: `${m.name} · ${m.roleLabel}` }))} placeholder="Unassigned" error={errors.assignedMemberId} />
          ) : (
            <p className="self-end pb-2.5 text-[12.5px] text-muted">It will be assigned to you.</p>
          )}
          <Input label="Follow-up reminder (IST, optional)" type="datetime-local" value={f.followUpAt} onChange={set("followUpAt")} error={errors.followUpAt} />
          <Textarea label="Notes (optional)" value={f.notes} onChange={set("notes")} error={errors.notes} maxLength={2000} className="sm:col-span-2" />
        </fieldset>

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="dark" size="sm" disabled={busy !== null} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}>
            Add renewal
          </Button>
        </div>
      </form>
    </Modal>
  );
}
