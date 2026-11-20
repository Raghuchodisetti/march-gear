"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { LEAD_SOURCE_LABEL } from "@/partner/labels";
import { createLeadAction } from "@/server/actions/partner-crm";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/field";
import { Input, Select, Textarea } from "./controls";
import { MANUAL_SOURCES, toISTInput } from "./pipeline";
import type { MemberOption, ModelOption, OfferOption, VehicleOption } from "./types";
import { useRun } from "./use-run";

export interface AddLeadOptions {
  models: ModelOption[];
  vehicles: VehicleOption[];
  offers: OfferOption[];
  members: MemberOption[];
  canAssign: boolean;
}

/** "Add enquiry" for walk-ins, phone calls, referrals… */
export function AddLeadModal({ open, onClose, options }: { open: boolean; onClose: () => void; options: AddLeadOptions }) {
  return (
    <Modal open={open} onClose={onClose} title="Add an enquiry" description="For walk-ins, phone calls and referrals. Website enquiries arrive here automatically." size="lg">
      {open && <Form onClose={onClose} options={options} />}
    </Modal>
  );
}

function Form({ onClose, options }: { onClose: () => void; options: AddLeadOptions }) {
  const router = useRouter();
  const { run, busy, errors } = useRun();
  const [f, setF] = useState({
    name: "",
    mobile: "",
    email: "",
    source: "walk_in",
    carSlug: "",
    variant: "",
    carLabel: "",
    vehicleId: "",
    offerId: "",
    budget: "",
    location: "",
    assignedMemberId: "",
    followUpAt: "",
    note: "",
  });
  const [interest, setInterest] = useState<"catalogue" | "inventory" | "other">("catalogue");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const model = useMemo(() => options.models.find((m) => m.value === f.carSlug), [options.models, f.carSlug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...f,
      carSlug: interest === "catalogue" ? f.carSlug : "",
      variant: interest === "catalogue" ? f.variant : "",
      vehicleId: interest === "inventory" ? f.vehicleId : "",
      carLabel: interest === "other" ? f.carLabel : "",
    };
    const res = await run("save", () => createLeadAction(payload), (r) => `Enquiry ${r.reference} added`);
    if (res) {
      onClose();
      router.push(`/dealer/enquiries?lead=${res.id}`, { scroll: false });
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6 px-6 py-6 sm:px-8">
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Customer</legend>
        <Input label="Full name" value={f.name} onChange={set("name")} error={errors.name} autoComplete="off" data-autofocus />
        <Input label="Mobile" inputMode="tel" placeholder="10-digit mobile" value={f.mobile} onChange={set("mobile")} error={errors.mobile} />
        <Input label="Email (optional)" type="email" value={f.email} onChange={set("email")} error={errors.email} />
        <Select label="Source" value={f.source} onChange={set("source")} options={MANUAL_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABEL[s] }))} error={errors.source} />
        <Input label="Budget (optional)" placeholder="e.g. ₹12–15 lakh" value={f.budget} onChange={set("budget")} error={errors.budget} />
        <Input label="Preferred location (optional)" placeholder="Area or city" value={f.location} onChange={set("location")} error={errors.location} />
      </fieldset>

      <fieldset>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <legend className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Interested in</legend>
          <Segmented
            ariaLabel="Interested in"
            value={interest}
            onChange={setInterest}
            options={[
              { value: "catalogue", label: "Model" },
              { value: "inventory", label: "In stock" },
              { value: "other", label: "Other" },
            ]}
          />
        </div>
        {interest === "catalogue" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select aria-label="Model" value={f.carSlug} onChange={(e) => setF((v) => ({ ...v, carSlug: e.target.value, variant: "" }))} options={options.models.map((m) => ({ value: m.value, label: m.label }))} placeholder="Choose a model" error={errors.carSlug} />
            <Select aria-label="Variant" value={f.variant} onChange={set("variant")} options={(model?.variants ?? []).map((v) => ({ value: v, label: v }))} placeholder="Any variant" disabled={!model} />
          </div>
        )}
        {interest === "inventory" && (
          <Select
            aria-label="Vehicle in stock"
            value={f.vehicleId}
            onChange={set("vehicleId")}
            options={options.vehicles.map((v) => ({ value: String(v.id), label: `${v.label} · ${v.reference}` }))}
            placeholder={options.vehicles.length ? "Choose a published vehicle" : "No published vehicles yet"}
            error={errors.vehicleId}
          />
        )}
        {interest === "other" && <Input aria-label="Car" placeholder="e.g. Any compact SUV under ₹12 lakh" value={f.carLabel} onChange={set("carLabel")} error={errors.carLabel} />}
        {options.offers.length > 0 && (
          <Select
            label="Linked offer (optional)"
            className="mt-3"
            value={f.offerId}
            onChange={set("offerId")}
            options={options.offers.map((o) => ({ value: String(o.id), label: `${o.title} · ${o.reference}` }))}
            placeholder="No offer"
            error={errors.offerId}
          />
        )}
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Next steps</legend>
        {options.canAssign && (
          <Select
            label="Assign to"
            value={f.assignedMemberId}
            onChange={set("assignedMemberId")}
            options={options.members.map((m) => ({ value: String(m.id), label: `${m.name} · ${m.roleLabel}` }))}
            placeholder="Unassigned"
            error={errors.assignedMemberId}
          />
        )}
        <Input label="Follow-up reminder (optional)" type="datetime-local" min={toISTInput(new Date())} value={f.followUpAt} onChange={set("followUpAt")} error={errors.followUpAt} />
        <Textarea label="Note (optional)" className="sm:col-span-2" value={f.note} onChange={set("note")} maxLength={2000} placeholder="What did they ask about?" error={errors.note} />
      </fieldset>

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={busy !== null} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}>
          Add enquiry
        </Button>
      </div>
    </form>
  );
}
