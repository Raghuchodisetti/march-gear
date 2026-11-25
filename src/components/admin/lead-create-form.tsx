"use client";

import { useState } from "react";
import { useDeskRouter as useRouter } from "@/components/admin/desk";
import { Loader2, Plus } from "lucide-react";
import { LEAD_STATUS, LEAD_TYPES, type LeadStatus, type LeadType } from "@/db/enums";
import { LEAD_STATUS_LABEL, LEAD_TYPE_LABEL } from "@/lib/leads";
import { createLeadAction } from "@/server/actions/admin";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { LEAD_CHANNELS, type LeadChannel } from "./options";
import { Panel } from "./ui";

interface Values {
  type: LeadType;
  channel: LeadChannel;
  name: string;
  phone: string;
  email: string;
  city: string;
  subject: string;
  message: string;
  status: LeadStatus;
  assignedTo: string;
}

/** For enquiries that come in by phone, walk-in or WhatsApp rather than through a website form. */
export function NewLeadForm({ staff, meId }: { staff: { id: number; name: string }[]; meId: number }) {
  const router = useRouter();
  const { toast } = useUI();
  const [v, setV] = useState<Values>({
    type: "callback",
    channel: "Phone call",
    name: "",
    phone: "",
    email: "",
    city: "",
    subject: "",
    message: "",
    status: "new",
    assignedTo: staff.some((s) => s.id === meId) ? String(meId) : "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Values>(k: K, value: Values[K]) => setV((p) => ({ ...p, [k]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await createLeadAction(v).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      setErrors(res?.fieldErrors ?? {});
      toast(res?.error ?? "Couldn't reach the server. Please try again.", { tone: "error" });
      return;
    }
    toast(`Lead ${res.reference} added`, { tone: "success" });
    router.replace(`/admin/leads/${res.id}`);
  };

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <Panel title="Customer">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Name" autoComplete="off" value={v.name} onChange={(e) => set("name", e.target.value)} error={errors.name} className="sm:col-span-2" />
            <TextField
              label="Mobile"
              prefix="+91"
              inputMode="numeric"
              autoComplete="off"
              value={v.phone}
              onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
              error={errors.phone}
              hint="A mobile number or an email is needed."
            />
            <TextField label="Email" type="email" autoComplete="off" value={v.email} onChange={(e) => set("email", e.target.value)} error={errors.email} />
            <TextField label="City" autoComplete="off" value={v.city} onChange={(e) => set("city", e.target.value)} error={errors.city} />
          </div>
        </Panel>

        <Panel title="Request">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Type"
              value={v.type}
              onChange={(e) => set("type", e.target.value as LeadType)}
              options={LEAD_TYPES.map((t) => ({ value: t, label: LEAD_TYPE_LABEL[t] }))}
              error={errors.type}
            />
            <SelectField
              label="How they reached us"
              value={v.channel}
              onChange={(e) => set("channel", e.target.value as LeadChannel)}
              options={LEAD_CHANNELS.map((c) => ({ value: c, label: c }))}
              error={errors.channel}
            />
            <TextField
              label="About"
              placeholder="Hyundai Creta SX(O), a dealer, a used car…"
              value={v.subject}
              onChange={(e) => set("subject", e.target.value)}
              error={errors.subject}
              className="sm:col-span-2"
            />
            <div className="sm:col-span-2">
              <TextArea label="Message" rows={5} placeholder="What they asked for, preferred dates, budget…" value={v.message} onChange={(e) => set("message", e.target.value)} />
              {errors.message && <p className="mt-1.5 text-xs text-red">{errors.message}</p>}
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Manage">
          <div className="space-y-4">
            <SelectField
              label="Status"
              value={v.status}
              onChange={(e) => set("status", e.target.value as LeadStatus)}
              options={LEAD_STATUS.map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s] }))}
            />
            <SelectField
              label="Owner"
              value={v.assignedTo}
              onChange={(e) => set("assignedTo", e.target.value)}
              placeholder="Unassigned"
              options={staff.map((s) => ({ value: String(s.id), label: s.name }))}
              error={errors.assignedTo}
            />
            <Button type="submit" className="w-full" disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}>
              Add lead
            </Button>
          </div>
        </Panel>
      </div>
    </form>
  );
}
