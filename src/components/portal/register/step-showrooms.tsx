"use client";

import { useState } from "react";
import { ChevronDown, Plus, Star, Store, Trash2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { ImageUploader } from "@/components/portal/uploader";
import { defaultHours } from "@/partner/application";
import { INDIAN_STATES, errorAt, type WizardApplication } from "@/partner/schemas";
import { AreaField, FieldError, Grid, Note, Switch } from "./controls";
import { HoursEditor } from "./hours-editor";
import { LocationPicker } from "./location-picker";
import { newKey, type StepProps } from "./step-types";

type Room = WizardApplication["showrooms"][number];

const MAX_ROOMS = 20;

export function ShowroomsStep({ app, value, onChange, errors, clear }: StepProps<"showrooms">) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(value.length <= 1 ? value.map((r) => r.key) : value.slice(0, 1).map((r) => r.key)));
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const update = (key: string, patch: Partial<Room>, ...fields: string[]) => {
    const i = value.findIndex((r) => r.key === key);
    onChange(value.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    clear(...fields.map((f) => `${i}.${f}`));
  };

  const add = () => {
    const first = value.length === 0;
    const room: Room = {
      key: newKey(),
      name: first ? app.business.tradeName || app.business.legalName : "",
      address: "",
      state: "",
      district: "",
      city: "",
      pin: "",
      lat: null,
      lng: null,
      phone: first ? app.business.phone : "",
      hours: defaultHours(),
      photos: [],
      serviceCentre: false,
      isPrimary: first,
    };
    onChange([...value, room]);
    setOpen((s) => new Set([...s, room.key]));
    clear("form");
  };

  const remove = (key: string) => {
    const rest = value.filter((r) => r.key !== key);
    if (rest.length && !rest.some((r) => r.isPrimary)) rest[0] = { ...rest[0], isPrimary: true };
    onChange(rest);
    setConfirmRemove(null);
    clear("form", ...value.map((_, i) => String(i)));
  };

  const makePrimary = (key: string) => {
    onChange(value.map((r) => ({ ...r, isPrimary: r.key === key })));
    clear("form");
  };

  const toggle = (key: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const roomErrors = (i: number) => Object.keys(errors).filter((k) => k.startsWith(`${i}.`)).length;

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
            <Store aria-hidden className="size-5" />
          </span>
          <p className="mt-4 text-[15px] font-semibold">Add your first showroom</p>
          <p className="mt-1 max-w-md text-[13.5px] text-muted">Your primary branch appears on your public dealer page. Add other branches too, so customers can find the nearest one.</p>
          <Button className="mt-6" onClick={add} icon={<Plus aria-hidden className="size-4" />}>
            Add showroom
          </Button>
        </div>
      )}

      {value.map((room, i) => {
        const count = roomErrors(i);
        // A branch with problems stays open so they can be seen and fixed.
        const isOpen = open.has(room.key) || count > 0;
        return (
          <section key={room.key} className={cn("border bg-white transition-colors duration-300", count ? "border-red/40" : "border-line")}>
            <header className="flex flex-wrap items-center gap-3 px-5 py-4 md:px-7">
              <button type="button" onClick={() => toggle(room.key)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-[3px] text-[13px] font-semibold num", room.isPrimary ? "bg-ink text-white" : "bg-mist text-ink")}>{i + 1}</span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">{room.name || "New showroom"}</span>
                    {room.isPrimary && <span className="inline-flex h-5 items-center rounded-full bg-red-50 px-2 text-[10.5px] font-semibold text-red">Primary</span>}
                    {room.serviceCentre && <span className="inline-flex h-5 items-center gap-1 rounded-full bg-mist px-2 text-[10.5px] font-semibold"><Wrench aria-hidden className="size-3" /> Service</span>}
                    {count > 0 && <span className="inline-flex h-5 items-center rounded-full bg-red px-2 text-[10.5px] font-semibold text-white">{count} to fix</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-muted">{[room.city, room.state].filter(Boolean).join(", ") || "Address not added yet"}</span>
                </span>
                <ChevronDown aria-hidden className={cn("ml-auto size-5 shrink-0 text-muted transition-transform duration-300", isOpen && "rotate-180")} />
              </button>
            </header>

            {isOpen && (
              <div className="animate-rise space-y-7 border-t border-line px-5 py-6 md:px-7">
                <Grid>
                  <TextField label="Showroom name" value={room.name} onChange={(e) => update(room.key, { name: e.target.value }, "name")} error={errors[`${i}.name`]} placeholder="e.g. Autoline Hyundai, Dwaraka Nagar" />
                  <TextField label="Showroom phone (optional)" type="tel" value={room.phone} onChange={(e) => update(room.key, { phone: e.target.value }, "phone")} error={errors[`${i}.phone`]} />
                  <AreaField label="Street address" rows={2} value={room.address} onChange={(e) => update(room.key, { address: e.target.value }, "address")} error={errors[`${i}.address`]} placeholder="Building, street, area, landmark" className="md:col-span-2" />
                  <SelectField label="State" placeholder="Choose state" value={room.state} onChange={(e) => update(room.key, { state: e.target.value }, "state")} error={errors[`${i}.state`]} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} />
                  <TextField label="District" value={room.district} onChange={(e) => update(room.key, { district: e.target.value }, "district")} error={errors[`${i}.district`]} />
                  <TextField label="City / town" value={room.city} onChange={(e) => update(room.key, { city: e.target.value }, "city")} error={errors[`${i}.city`]} />
                  <TextField
                    label="PIN code"
                    inputMode="numeric"
                    maxLength={6}
                    value={room.pin}
                    onChange={(e) => update(room.key, { pin: e.target.value.replace(/\D/g, "").slice(0, 6) }, "pin")}
                    error={errors[`${i}.pin`]}
                    className="[&_input]:num"
                  />
                </Grid>

                <LocationPicker lat={room.lat} lng={room.lng} city={room.city} onChange={(lat, lng) => update(room.key, { lat, lng }, "location")} error={errors[`${i}.location`]} />

                <HoursEditor value={room.hours} onChange={(hours) => update(room.key, { hours }, "hours")} errorFor={(d) => errors[`${i}.hours.${d}`]} error={errors[`${i}.hours`]} />

                <div>
                  <p className="mb-2 text-[12.5px] font-medium text-ink">
                    Photographs <span className="font-normal text-muted">(up to 8)</span>
                  </p>
                  <ImageUploader value={room.photos} onChange={(photos) => update(room.key, { photos }, "photos")} multiple max={8} label="Add photos" hint="Showroom front, display floor, service bay. The first photo is the cover." error={errorAt(errors, `${i}.photos`)} />
                </div>

                <div className="space-y-4 border-t border-line pt-6">
                  <Switch checked={room.serviceCentre} onChange={(v) => update(room.key, { serviceCentre: v })} label="Service centre available" description="Customers can book servicing and repairs at this branch." />
                  <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                    {room.isPrimary ? (
                      <p className="inline-flex items-center gap-2 text-[13px] text-muted">
                        <Star aria-hidden className="size-4 fill-red text-red" /> This is your primary branch.
                      </p>
                    ) : (
                      <button type="button" onClick={() => makePrimary(room.key)} className="inline-flex items-center gap-2 text-[13px] font-medium text-ink hover:text-red">
                        <Star aria-hidden className="size-4" /> Make this the primary branch
                      </button>
                    )}
                    {confirmRemove === room.key ? (
                      <span className="flex items-center gap-2 text-[13px]">
                        <span className="text-muted">Remove this showroom?</span>
                        <Button size="sm" variant="dark" onClick={() => remove(room.key)}>
                          Remove
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>
                          Cancel
                        </Button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmRemove(room.key)} className="inline-flex items-center gap-2 text-[13px] text-muted hover:text-red">
                        <Trash2 aria-hidden className="size-4" /> Remove showroom
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        );
      })}

      {value.length > 0 && value.length < MAX_ROOMS && (
        <button
          type="button"
          onClick={add}
          className="flex w-full items-center justify-center gap-2 border border-dashed border-ink/20 bg-white px-4 py-5 text-[14px] font-medium transition-colors duration-300 hover:border-ink"
        >
          <Plus aria-hidden className="size-4" /> Add another showroom or branch
        </button>
      )}
      <FieldError>{errors["showrooms"]}</FieldError>
    </>
  );
}
