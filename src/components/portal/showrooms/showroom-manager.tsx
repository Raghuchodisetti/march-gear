"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, MapPin, Pencil, Phone, Plus, Power, Star, Store, Wrench } from "lucide-react";
import { defaultHours } from "@/partner/application";
import type { DayHours } from "@/partner/types";
import { cn } from "@/lib/utils";
import { saveShowroomAction, setPrimaryShowroomAction, setShowroomActiveAction } from "@/server/actions/partner-showrooms";
import { Badge } from "@/components/portal/ui";
import { ImageUploader } from "@/components/portal/uploader";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { ConfirmDialog, FieldError, Toggle, inputCls, useAction } from "@/components/portal/profile/kit";
import { HoursEditor } from "./hours-editor";
import { MapPicker } from "./map-picker";
import { hoursSummary, osmLink } from "./shared";

export interface ShowroomView {
  id: number;
  name: string;
  address: string;
  state: string;
  district: string;
  city: string;
  pin: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  hours: DayHours[];
  photos: string[];
  serviceCentre: boolean;
  isPrimary: boolean;
  isActive: boolean;
  vehicles: number;
}

type Draft = Omit<ShowroomView, "isPrimary" | "isActive" | "vehicles" | "id" | "phone"> & { id: number | null; phone: string };

const blank = (): Draft => ({ id: null, name: "", address: "", state: "", district: "", city: "", pin: "", lat: null, lng: null, phone: "", hours: defaultHours(), photos: [], serviceCentre: false });

export function ShowroomManager({ rooms, states, limit, planName }: { rooms: ShowroomView[]; states: readonly string[]; limit: number | null; planName: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState<{ room: ShowroomView; kind: "deactivate" | "primary" } | null>(null);
  const { busy, errors, setErrors, run } = useAction();
  const active = rooms.filter((r) => r.isActive).length;
  const atLimit = limit !== null && active >= limit;

  const open = (r?: ShowroomView) => {
    setErrors({});
    setDraft(r ? { id: r.id, name: r.name, address: r.address, state: r.state, district: r.district, city: r.city, pin: r.pin, lat: r.lat, lng: r.lng, phone: r.phone ?? "", hours: r.hours.length === 7 ? r.hours : defaultHours(), photos: r.photos, serviceCentre: r.serviceCentre } : blank());
  };
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const save = async () => {
    if (!draft) return;
    const res = await run(() => saveShowroomAction(draft), draft.id ? "Showroom updated." : "Showroom added.");
    if (res) {
      setDraft(null);
      router.refresh();
    }
  };
  const toggleActive = async (r: ShowroomView, activeNow: boolean) => {
    const res = await run(() => setShowroomActiveAction({ id: r.id, active: activeNow }), activeNow ? `${r.name} is active again.` : `${r.name} deactivated.`);
    setConfirm(null);
    if (res) router.refresh();
  };
  const makePrimary = async (r: ShowroomView) => {
    const res = await run(() => setPrimaryShowroomAction(r.id), `${r.name} is now your primary showroom.`);
    setConfirm(null);
    if (res) router.refresh();
  };

  const field = (k: "name" | "address" | "district" | "city" | "pin" | "phone", label: string, opts: { placeholder?: string; inputMode?: "numeric" | "tel"; wide?: boolean } = {}) => (
    <div className={cn(opts.wide && "sm:col-span-2")}>
      <label htmlFor={`sr-${k}`} className="mb-1.5 block text-[12.5px] font-medium">
        {label}
      </label>
      <input id={`sr-${k}`} value={draft?.[k] ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={opts.placeholder} inputMode={opts.inputMode} className={inputCls} aria-invalid={Boolean(errors[k]) || undefined} />
      <FieldError msg={errors[k]} />
    </div>
  );

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 border border-line bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <p className="text-[13.5px]">
          <span className="font-semibold num">{active}</span> active {active === 1 ? "branch" : "branches"}
          <span className="text-muted">
            {limit === null ? ` · ${planName} plan: unlimited branches` : ` of ${limit} on your ${planName} plan`}
          </span>
        </p>
        <Button variant="dark" size="sm" onClick={() => open()} disabled={atLimit} icon={<Plus className="size-4" aria-hidden />} title={atLimit ? "Upgrade your plan to add more branches" : undefined}>
          Add showroom
        </Button>
      </div>

      {rooms.length === 0 ? (
        <div className="flex flex-col items-center border border-dashed border-ink/15 bg-white px-6 py-16 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
            <Store aria-hidden className="size-5 text-ink/60" />
          </span>
          <p className="mt-4 text-[15px] font-semibold">Add your first showroom</p>
          <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">Customers find you by location. Add the address, map pin, hours and a few photos — it appears on your public page straight away.</p>
          <Button className="mt-5" variant="dark" size="sm" onClick={() => open()} icon={<Plus className="size-4" aria-hidden />}>
            Add showroom
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
          {rooms.map((r) => (
            <li key={r.id} className={cn("grid grid-cols-1 border bg-white transition-colors duration-500 sm:grid-cols-[220px_minmax(0,1fr)]", r.isPrimary ? "border-ink/40" : "border-line", !r.isActive && "opacity-70")}>
              <div className="relative aspect-[16/10] bg-mist sm:aspect-auto sm:min-h-[220px]">
                {r.photos[0] ? (
                  // Dealer-uploaded showroom photo from /media.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img loading="lazy" decoding="async" src={r.photos[0]} alt={`${r.name} showroom`} className="absolute inset-0 size-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted">
                    <Store aria-hidden className="size-6" />
                    <span className="text-[12px]">No photos yet</span>
                  </div>
                )}
                {r.photos.length > 1 && <span className="absolute bottom-3 left-3 bg-ink/70 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm num">{r.photos.length} photos</span>}
              </div>
              <div className="flex min-w-0 flex-col p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {r.isPrimary && <Badge tone="dark">Primary</Badge>}
                  {!r.isActive && <Badge>Inactive</Badge>}
                  {r.serviceCentre && (
                    <Badge tone="neutral">
                      <Wrench aria-hidden className="mr-1 size-3" /> Service centre
                    </Badge>
                  )}
                </div>
                <h3 className="mt-3 text-[16px] font-semibold leading-snug">{r.name}</h3>
                <p className="mt-2 flex items-start gap-1.5 text-[13px] text-ink/80">
                  <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted" />
                  <span>
                    {r.address}, {r.city}, {r.state} {r.pin}
                  </span>
                </p>
                <p className="mt-1 flex items-start gap-1.5 text-[12.5px] text-muted">
                  <Clock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  {hoursSummary(r.hours)}
                </p>
                {r.phone && (
                  <p className="mt-1 flex items-start gap-1.5 text-[12.5px] text-muted">
                    <Phone aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    {r.phone}
                  </p>
                )}
                <p className="mt-1 text-[12px] text-muted">
                  {r.lat !== null && r.lng !== null ? (
                    <a href={osmLink(r.lat, r.lng)} target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-ink hover:underline">
                      Pinned at {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                    </a>
                  ) : (
                    <span className="text-[#9a5b00]">No map pin — add one so customers get directions</span>
                  )}
                  {r.vehicles > 0 && ` · ${r.vehicles} vehicle${r.vehicles === 1 ? "" : "s"}`}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <Button size="sm" variant="outline" onClick={() => open(r)} icon={<Pencil className="size-3.5" aria-hidden />}>
                    Edit
                  </Button>
                  {r.isActive && !r.isPrimary && (
                    <Button size="sm" variant="ghost" onClick={() => setConfirm({ room: r, kind: "primary" })} icon={<Star className="size-3.5" aria-hidden />}>
                      Make primary
                    </Button>
                  )}
                  {r.isActive && !r.isPrimary && (
                    <Button size="sm" variant="ghost" onClick={() => setConfirm({ room: r, kind: "deactivate" })} icon={<Power className="size-3.5" aria-hidden />}>
                      Deactivate
                    </Button>
                  )}
                  {!r.isActive && (
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(r, true)} disabled={busy} icon={<Power className="size-3.5" aria-hidden />}>
                      Reactivate
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Drawer
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit showroom" : "Add showroom"}
        className="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button variant="dark" size="sm" onClick={save} disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
              {draft?.id ? "Save showroom" : "Add showroom"}
            </Button>
          </div>
        }
      >
        {draft && (
          <div className="space-y-8 px-5 py-6 sm:px-6">
            <section>
              <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Branch details</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {field("name", "Showroom name", { placeholder: "QA Motors — Indiranagar", wide: true })}
                {field("address", "Street address", { placeholder: "Building, street, area", wide: true })}
                {field("city", "City or town")}
                {field("district", "District")}
                <div>
                  <label htmlFor="sr-state" className="mb-1.5 block text-[12.5px] font-medium">
                    State
                  </label>
                  <select id="sr-state" value={draft.state} onChange={(e) => set("state", e.target.value)} className={cn(inputCls, "cursor-pointer")} aria-invalid={Boolean(errors.state) || undefined}>
                    <option value="">Choose a state</option>
                    {states.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <FieldError msg={errors.state} />
                </div>
                {field("pin", "PIN code", { placeholder: "560038", inputMode: "numeric" })}
                {field("phone", "Showroom phone", { placeholder: "080 4123 4567", inputMode: "tel" })}
              </div>
              <div className="mt-5 border border-line p-4">
                <Toggle checked={draft.serviceCentre} onChange={(v) => set("serviceCentre", v)} label="Service centre at this branch" hint="Shown as “Service & body shop” on your public page." />
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Location</h3>
              <MapPicker
                lat={draft.lat}
                lng={draft.lng}
                onChange={(lat, lng) => setDraft((d) => (d ? { ...d, lat, lng } : d))}
                address={[draft.address, draft.city, draft.district, draft.state, draft.pin].filter(Boolean).join(", ")}
                error={errors.location ?? errors.lat ?? errors.lng}
              />
            </section>

            <section>
              <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Opening hours</h3>
              <HoursEditor value={draft.hours} onChange={(h) => set("hours", h)} errors={errors} />
            </section>

            <section>
              <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Photos</h3>
              <ImageUploader value={draft.photos} onChange={(p) => set("photos", p)} multiple max={8} label="Add photos" hint="Up to 8. The first photo is the cover." error={errors.photos} />
            </section>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === "primary" ? "Make this your primary showroom?" : "Deactivate this showroom?"}
        body={
          confirm?.kind === "primary"
            ? `${confirm.room.name} becomes the main address, phone and photo on your public page.`
            : `${confirm?.room.name} is hidden from your public page. Vehicles assigned to it stay listed. You can reactivate it any time.`
        }
        confirm={confirm?.kind === "primary" ? "Make primary" : "Deactivate"}
        busy={busy}
        onConfirm={() => confirm && (confirm.kind === "primary" ? makePrimary(confirm.room) : toggleActive(confirm.room, false))}
      />
    </>
  );
}
