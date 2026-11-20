"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building, Loader2, Mail, MapPin, Pencil, Phone, Plus, Star, Trash2 } from "lucide-react";
import { INDIAN_STATES } from "@/data/states";
import { cn } from "@/lib/utils";
import { deleteBranchAction, saveBranchAction, setPrimaryBranchAction } from "@/server/actions/ins-profile";
import { Badge } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { ConfirmDialog, FieldError, inputCls, useAction } from "@/components/portal/profile/kit";
import type { BranchView } from "./shared";

/* Branch offices: add, edit, remove, and exactly one primary office. */

type Draft = { id: number | null; name: string; address: string; city: string; state: string; pin: string; phone: string; email: string };
const blank = (): Draft => ({ id: null, name: "", address: "", city: "", state: "", pin: "", phone: "", email: "" });

export function BranchManager({ branches }: { branches: BranchView[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState<{ b: BranchView; kind: "delete" | "primary" } | null>(null);
  const { busy, errors, setErrors, run } = useAction();

  const open = (b?: BranchView) => {
    setErrors({});
    setDraft(b ? { id: b.id, name: b.name, address: b.address, city: b.city, state: b.state, pin: b.pin, phone: b.phone ?? "", email: b.email ?? "" } : blank());
  };
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const save = async () => {
    if (!draft) return;
    const res = await run(() => saveBranchAction(draft), draft.id ? "Office updated." : "Office added.");
    if (res) {
      setDraft(null);
      router.refresh();
    }
  };
  const confirmed = async () => {
    if (!confirm) return;
    const { b, kind } = confirm;
    const res = await run(() => (kind === "delete" ? deleteBranchAction(b.id) : setPrimaryBranchAction(b.id)), kind === "delete" ? `${b.name} removed.` : `${b.name} is now your primary office.`);
    setConfirm(null);
    if (res) router.refresh();
  };

  const field = (k: "name" | "address" | "city" | "pin" | "phone" | "email", label: string, opts: { placeholder?: string; inputMode?: "numeric" | "tel" | "email"; wide?: boolean; optional?: boolean } = {}) => (
    <div className={cn(opts.wide && "sm:col-span-2")}>
      <label htmlFor={`br-${k}`} className="mb-1.5 block text-[12.5px] font-medium">
        {label}
        {opts.optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      <input id={`br-${k}`} value={draft?.[k] ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={opts.placeholder} inputMode={opts.inputMode} className={inputCls} aria-invalid={Boolean(errors[k]) || undefined} />
      <FieldError msg={errors[k]} />
    </div>
  );

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-[13.5px] text-muted">Offices customers and MarchGear can reach. One is your primary office — its city appears on your listings.</p>
        <Button onClick={() => open()} icon={<Plus aria-hidden className="size-4" />} size="sm" variant="dark" className="shrink-0">
          Add office
        </Button>
      </div>

      {branches.length ? (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {branches.map((b) => (
            <li key={b.id} className={cn("flex flex-col border bg-white p-5", b.isPrimary ? "border-ink" : "border-line")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold">{b.name}</span>
                    {b.isPrimary && <Badge tone="dark">Primary</Badge>}
                  </p>
                  <p className="mt-1 flex gap-2 text-[13px] text-ink/80">
                    <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted" />
                    <span>
                      {b.address}, {b.city}, {b.state} <span className="num">{b.pin}</span>
                    </span>
                  </p>
                  {(b.phone || b.email) && (
                    <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
                      {b.phone && (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone aria-hidden className="size-3.5" /> {b.phone}
                        </span>
                      )}
                      {b.email && (
                        <span className="inline-flex min-w-0 items-center gap-1.5 break-all">
                          <Mail aria-hidden className="size-3.5 shrink-0" /> {b.email}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <Button size="sm" variant="outline" onClick={() => open(b)} icon={<Pencil aria-hidden className="size-3.5" />}>
                  Edit
                </Button>
                {!b.isPrimary && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setConfirm({ b, kind: "primary" })} icon={<Star aria-hidden className="size-3.5" />}>
                      Make primary
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red hover:bg-red-50" onClick={() => setConfirm({ b, kind: "delete" })} icon={<Trash2 aria-hidden className="size-3.5" />}>
                      Remove
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center border border-line bg-white px-6 py-14 text-center">
          <span className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-mist text-ink/60">
            <Building className="size-5" />
          </span>
          <p className="text-[15px] font-semibold">No offices yet</p>
          <p className="mt-1 max-w-sm text-[13.5px] text-muted">Add your head office first — it becomes your primary office.</p>
          <Button className="mt-5" onClick={() => open()} icon={<Plus aria-hidden className="size-4" />}>
            Add office
          </Button>
        </div>
      )}

      <Drawer
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit office" : "Add office"}
        className="sm:max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button variant="dark" size="sm" onClick={save} disabled={busy} icon={busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : undefined}>
              {draft?.id ? "Save office" : "Add office"}
            </Button>
          </div>
        }
      >
        {draft && (
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            {field("name", "Office name", { placeholder: "e.g. Head office, Mumbai branch", wide: true })}
            {field("address", "Street address", { wide: true })}
            <div>
              <label htmlFor="br-state" className="mb-1.5 block text-[12.5px] font-medium">
                State
              </label>
              <select id="br-state" value={draft.state} onChange={(e) => set("state", e.target.value)} className={cn(inputCls, "cursor-pointer")} aria-invalid={Boolean(errors.state) || undefined}>
                <option value="">Choose the state</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <FieldError msg={errors.state} />
            </div>
            {field("city", "City")}
            {field("pin", "PIN code", { inputMode: "numeric" })}
            {field("phone", "Phone", { inputMode: "tel", optional: true })}
            {field("email", "Email", { inputMode: "email", optional: true, wide: true })}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === "delete" ? `Remove ${confirm.b.name}?` : `Make ${confirm?.b.name ?? ""} your primary office?`}
        body={confirm?.kind === "delete" ? "It's removed from your profile." : "Its city shows on your listings from now on. Your current primary office stays listed as a branch."}
        confirm={confirm?.kind === "delete" ? "Remove office" : "Make primary"}
        tone={confirm?.kind === "delete" ? "primary" : "dark"}
        busy={busy}
        onConfirm={confirmed}
      />
    </div>
  );
}
