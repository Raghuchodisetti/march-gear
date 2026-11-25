"use client";

import { useState, type FormEvent } from "react";
import { useDeskRouter as useRouter } from "@/components/admin/desk";
import { Loader2, Pencil, RotateCcw } from "lucide-react";
import { AD_AUDIENCE, type AdAudience } from "@/db/enums";
import { restorePlacementDefaultsAction, updatePlacementAction } from "@/server/actions/ads-admin";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { useDecisionDialog } from "@/components/admin/partner-actions";
import { AUDIENCE_LABEL, type PlacementView } from "@/components/ads/shared";

/* Edit a placement's name, copy, sizes, price, length limits, slots, audience and on/off. */

const OFFLINE: { ok: false; error: string; fieldErrors?: Record<string, string> } = { ok: false, error: "Couldn't reach the server. Please try again." };

export function PlacementEditor({ placement, hasDefaults }: { placement: PlacementView; hasDefaults: boolean }) {
  const router = useRouter();
  const { toast } = useUI();
  const dialog = useDecisionDialog();
  const [open, setOpen] = useState(false);
  const init = () => ({
    name: placement.name,
    description: placement.description,
    location: placement.location,
    desktopSize: placement.desktopSize ?? "",
    mobileSize: placement.mobileSize ?? "",
    pricePerDay: String(placement.pricePerDay),
    minDays: String(placement.minDays),
    maxDays: String(placement.maxDays),
    slots: String(placement.slots),
    audience: placement.audience as AdAudience,
    isActive: placement.isActive,
  });
  const [v, setV] = useState(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const banner = placement.format === "banner";
  const set = <K extends keyof ReturnType<typeof init>>(k: K, val: ReturnType<typeof init>[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => {
      const next = { ...e };
      delete next[k];
      return next;
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await updatePlacementAction(placement.id, { ...v, desktopSize: banner ? v.desktopSize : null, mobileSize: banner ? v.mobileSize : null }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast(res.error ?? "Couldn't save the placement.", { tone: "error" });
      return;
    }
    toast(`${v.name} saved`, { tone: "success" });
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        icon={<Pencil className="size-4" aria-hidden />}
        onClick={() => {
          setV(init());
          setErrors({});
          setOpen(true);
        }}
      >
        Edit
      </Button>
      {hasDefaults && (
        <Button
          size="sm"
          variant="ghost"
          icon={<RotateCcw className="size-4" aria-hidden />}
          onClick={() =>
            dialog.open({
              title: `Restore “${placement.name}” to launch settings?`,
              description: "Name, copy, sizes, price, length limits, slots and audience go back to the defaults in the code, and the placement is switched on. Existing bookings keep their booked price.",
              fields: [],
              submitLabel: "Restore defaults",
              tone: "dark",
              icon: <RotateCcw aria-hidden className="size-4" />,
              run: () => restorePlacementDefaultsAction(placement.id),
              done: "Defaults restored",
            })
          }
        >
          Restore defaults
        </Button>
      )}
      {dialog.element}
      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={`Edit ${placement.name}`} description="Changes apply to new bookings. Existing bookings keep the rate they were booked at.">
        <form onSubmit={save} noValidate>
          <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2 sm:px-8">
            <TextField label="Name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={120} error={errors.name} className="sm:col-span-2" />
            <div className="sm:col-span-2">
              <TextArea label="Description" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={300} rows={2} />
              {errors.description && <p className="mt-1.5 text-xs text-red">{errors.description}</p>}
            </div>
            <TextField label="Where it appears" value={v.location} onChange={(e) => set("location", e.target.value)} maxLength={160} error={errors.location} className="sm:col-span-2" />
            {banner && (
              <>
                <TextField label="Desktop size (px)" value={v.desktopSize} onChange={(e) => set("desktopSize", e.target.value)} placeholder="1600×400" hint="Width × height" error={errors.desktopSize} />
                <TextField label="Mobile size (px)" value={v.mobileSize} onChange={(e) => set("mobileSize", e.target.value)} placeholder="800×600" hint="Width × height" error={errors.mobileSize} />
              </>
            )}
            <TextField label="Price per day (₹, before GST)" type="number" inputMode="numeric" min={0} step={1} value={v.pricePerDay} onChange={(e) => set("pricePerDay", e.target.value)} error={errors.pricePerDay} />
            <TextField label="Advertisers at once (slots)" type="number" inputMode="numeric" min={1} max={20} value={v.slots} onChange={(e) => set("slots", e.target.value)} error={errors.slots} hint="They rotate in the slot." />
            <TextField label="Minimum days" type="number" inputMode="numeric" min={1} max={365} value={v.minDays} onChange={(e) => set("minDays", e.target.value)} error={errors.minDays} />
            <TextField label="Maximum days" type="number" inputMode="numeric" min={1} max={365} value={v.maxDays} onChange={(e) => set("maxDays", e.target.value)} error={errors.maxDays} />
            <SelectField label="Who can book it" value={v.audience} onChange={(e) => set("audience", e.target.value as AdAudience)} options={AD_AUDIENCE.map((a) => ({ value: a, label: AUDIENCE_LABEL[a] }))} error={errors.audience} />
            <label className="flex cursor-pointer items-start gap-3 self-end rounded-[3px] border border-line px-3.5 py-3">
              <input type="checkbox" checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-red)]" />
              <span>
                <span className="block text-[13.5px] font-medium">Placement is on</span>
                <span className="block text-[12px] text-muted">Off: nothing serves and it can&apos;t be booked.</span>
              </span>
            </label>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
              Save placement
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
