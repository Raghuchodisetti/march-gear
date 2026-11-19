"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { Check, ClipboardCheck, Download, Loader2, Mail } from "lucide-react";
import type { FuelType } from "@/types";
import { cars } from "@/data/cars";
import { brandName, brands } from "@/data/brands";
import { PDI_FUELS } from "@/data/pdi";
import { createPersistentStore, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { SelectField, TextField } from "@/components/ui/field";
import { useUI, useUser } from "@/components/providers/app-provider";
import { downloadChecklistPdf, pdfCheckCount } from "./checklist-pdf";

/* ──────────────────────────────────────────────────────────────
   Lead capture for the free DIY checklist: details in, checklist
   "emailed" and unlocked on the page.
   ────────────────────────────────────────────────────────────── */

export interface ChecklistLead {
  name: string;
  email: string;
  phone: string;
  brand: string;
  model: string;
  fuel: FuelType;
  /** "Brand Model", as printed on the PDF. */
  car: string;
  delivery: string;
}

export const pdiLeadStore = createPersistentStore<ChecklistLead | null>("mg.pdi.lead", null);

// Modal open state, shared by the hero button and the locked checklist.
let gateOpen = false;
const listeners = new Set<() => void>();
const setGateOpen = (open: boolean) => {
  gateOpen = open;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const openChecklistGate = () => setGateOpen(true);

const OTHER = "other";
const FUEL_LABEL: Record<FuelType, string> = { Petrol: "Petrol", Diesel: "Diesel", CNG: "CNG", Hybrid: "Hybrid", Electric: "Electric (EV)" };

const brandOptions = [
  ...brands
    .filter((b) => cars.some((c) => c.brand === b.slug))
    .map((b) => ({ value: b.slug, label: b.name }))
    .sort((a, b) => a.label.localeCompare(b.label)),
  { value: OTHER, label: "Other brand" },
];

const modelOptions = (brand: string) => [
  ...cars
    .filter((c) => c.brand === brand)
    .map((c) => ({ value: c.slug, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label)),
  { value: OTHER, label: "Other model" },
];

/** Maps a saved lead back to the brand / model fields. */
function carFields(lead: ChecklistLead | null) {
  if (!lead?.brand) return { brand: "", brandOther: "", model: "", modelOther: "" };
  const brand = brands.find((b) => b.name === lead.brand);
  if (!brand) return { brand: OTHER, brandOther: lead.brand, model: "", modelOther: lead.model };
  const car = cars.find((c) => c.brand === brand.slug && c.name === lead.model);
  return car
    ? { brand: brand.slug, brandOther: "", model: car.slug, modelOther: "" }
    : { brand: brand.slug, brandOther: "", model: OTHER, modelOther: lead.model };
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Hero call-to-action. */
export function ChecklistCtaButton() {
  return (
    <Button size="lg" variant="light" icon={<ClipboardCheck className="size-4 text-red" aria-hidden />} onClick={openChecklistGate}>
      Free DIY checklist
    </Button>
  );
}

/** The details form + confirmation. Render once per page. */
export function ChecklistGateModal() {
  const open = useSyncExternalStore(subscribe, () => gateOpen, () => false);
  const lead = useStore(pdiLeadStore);
  const close = () => setGateOpen(false);
  return (
    <Modal open={open} onClose={close} bare size="md" labelledBy="gate-title">
      {/* keyed so each opening starts fresh */}
      <GateForm key={open ? "open" : "closed"} existing={lead} onClose={close} />
    </Modal>
  );
}

function GateForm({ existing, onClose }: { existing: ChecklistLead | null; onClose: () => void }) {
  const { user } = useUser();
  const { toast } = useUI();
  const [initial] = useState(() => carFields(existing));
  const [name, setName] = useState(existing?.name ?? user?.name ?? "");
  const [email, setEmail] = useState(existing?.email ?? user?.email ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? user?.phone ?? "");
  const [brand, setBrand] = useState(initial.brand);
  const [brandOther, setBrandOther] = useState(initial.brandOther);
  const [model, setModel] = useState(initial.model);
  const [modelOther, setModelOther] = useState(initial.modelOther);
  const [fuel, setFuel] = useState<FuelType | "">(existing?.fuel ?? "");
  const [delivery, setDelivery] = useState(existing?.delivery ?? "");
  const [consent, setConsent] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<ChecklistLead | null>(null);

  const otherBrand = brand === OTHER;
  const typedModel = otherBrand || model === OTHER;
  const knownCar = !typedModel ? cars.find((c) => c.slug === model) : undefined;
  const fuelOptions = knownCar ? PDI_FUELS.filter((f) => knownCar.fuelTypes.includes(f)) : PDI_FUELS;

  // Clear a field's error as soon as it's edited.
  const fix = (...keys: string[]) =>
    setErrors((prev) => {
      if (!keys.some((k) => k in prev)) return prev;
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });

  const chooseBrand = (value: string) => {
    fix("brand", "brandOther", "model", "modelOther", "fuel");
    setBrand(value);
    setModel("");
    setModelOther("");
    setFuel("");
  };
  const chooseModel = (value: string) => {
    fix("model", "modelOther", "fuel");
    setModel(value);
    const car = cars.find((c) => c.slug === value);
    // Pre-select the fuel when the model only comes in one.
    setFuel(car?.fuelTypes.length === 1 ? car.fuelTypes[0] : "");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Enter your full name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) next.email = "Enter a valid email address";
    if (!/^[6-9]\d{9}$/.test(phone)) next.phone = "Enter a valid 10-digit mobile number";
    if (!brand) next.brand = "Choose your car's brand";
    else if (otherBrand && brandOther.trim().length < 2) next.brandOther = "Enter the brand name";
    if (brand && !otherBrand && !model) next.model = "Choose your model";
    else if (brand && typedModel && !modelOther.trim()) next.modelOther = "Enter the model name";
    if (!fuel) next.fuel = "Choose the fuel type";
    if (!delivery) next.delivery = "Choose your delivery date";
    else if (delivery < todayISO()) next.delivery = "Pick a date from today onwards";
    if (!consent) next.consent = "Please accept to receive the checklist";
    setErrors(next);
    if (Object.keys(next).length || !fuel) return;

    setSending(true);
    const brandLabel = otherBrand ? brandOther.trim() : brandName(brand);
    const modelLabel = typedModel ? modelOther.trim() : (knownCar?.name ?? "");
    const saved: ChecklistLead = {
      name: name.trim(),
      email: email.trim(),
      phone,
      brand: brandLabel,
      model: modelLabel,
      fuel,
      car: `${brandLabel} ${modelLabel}`,
      delivery,
    };
    // Front-end demo: no mail server is connected, so delivery is simulated.
    window.setTimeout(async () => {
      pdiLeadStore.set(saved);
      setSent(saved);
      setSending(false);
      toast(`Checklist PDF sent to ${saved.email}`, { tone: "success" });
      try {
        await downloadChecklistPdf(saved);
      } catch {
        toast("Couldn't create the PDF — use the download button to try again", { tone: "error" });
      }
    }, 1000);
  };

  if (sent) {
    return (
      <div className="p-8 text-center sm:p-10">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-red text-white"
        >
          <Mail className="size-7" />
        </motion.span>
        <h2 id="gate-title" className="type-h2 mt-6">
          Checklist sent!
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-[15px] text-muted">
          We&apos;ve emailed the {pdfCheckCount(sent.fuel)}-point PDI checklist for your{" "}
          <span className="font-medium text-ink">
            {sent.car} ({sent.fuel})
          </span>{" "}
          to <span className="font-medium text-ink">{sent.email}</span>. A copy has also been downloaded to this device.
        </p>
        <p className="mt-3 text-[12px] text-muted">The full checklist is unlocked on this page too.</p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="dark"
            arrow
            onClick={() => {
              onClose();
              window.setTimeout(() => document.getElementById("checklist")?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
            }}
          >
            Open checklist now
          </Button>
          <Button variant="outline" icon={<Download className="size-4" aria-hidden />} onClick={() => downloadChecklistPdf(sent)}>
            Download PDF again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="border-b border-line px-6 py-5 sm:px-8">
        <p className="type-eyebrow text-red">Free download</p>
        <h2 id="gate-title" className="type-h3 mt-2">
          Get the PDI checklist in your inbox
        </h2>
        <p className="mt-1.5 text-[14px] text-muted">
          A ready-to-print PDF of every check to do before you accept your new car — with extra checks for your car&apos;s fuel type. All fields are required.
        </p>
      </div>

      <div className="space-y-6 px-6 py-6 sm:px-8">
        <fieldset>
          <legend className="type-eyebrow text-muted">Your details</legend>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField data-autofocus label="Full name" autoComplete="name" value={name} onChange={(e) => { fix("name"); setName(e.target.value); }} error={errors.name} placeholder="Your name" className="sm:col-span-2" />
            <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => { fix("email"); setEmail(e.target.value); }} error={errors.email} placeholder="you@example.com" />
            <TextField
              label="Mobile number"
              prefix="+91"
              inputMode="numeric"
              autoComplete="tel-national"
              value={phone}
              onChange={(e) => {
                  fix("phone");
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                }}
              error={errors.phone}
              placeholder="98765 43210"
            />
          </div>
        </fieldset>

        <div className="border-t border-line pt-6">
          <fieldset>
            <legend className="type-eyebrow text-muted">Your new car</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField label="Car brand" placeholder="Select brand" value={brand} onChange={(e) => chooseBrand(e.target.value)} options={brandOptions} error={errors.brand} />
              {otherBrand ? (
                <TextField label="Brand name" value={brandOther} onChange={(e) => { fix("brandOther"); setBrandOther(e.target.value); }} error={errors.brandOther} placeholder="e.g. Renault" />
              ) : (
                <SelectField
                  label="Model"
                  placeholder={brand ? "Select model" : "Choose a brand first"}
                  value={model}
                  onChange={(e) => chooseModel(e.target.value)}
                  options={brand ? modelOptions(brand) : []}
                  disabled={!brand}
                  error={errors.model}
                />
              )}
              {brand && typedModel && (
                <TextField
                  label="Model name"
                  value={modelOther}
                  onChange={(e) => {
                  fix("modelOther");
                  setModelOther(e.target.value);
                }}
                  error={errors.modelOther}
                  placeholder="e.g. Kiger RXZ"
                  className="sm:col-span-2"
                />
              )}
              <FuelPicker
                options={fuelOptions}
                value={fuel}
                onChange={(f) => {
                  fix("fuel");
                  setFuel(f);
                }}
                error={errors.fuel}
              />
              <TextField
                label="Delivery date"
                type="date"
                min={todayISO()}
                value={delivery}
                onChange={(e) => {
                  fix("delivery");
                  setDelivery(e.target.value);
                }}
                error={errors.delivery}
                hint="The day you'll collect the car from the dealership"
                className="sm:col-span-2"
              />
            </div>
          </fieldset>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-[12.5px] text-muted">
          <input type="checkbox" checked={consent} onChange={(e) => { fix("consent"); setConsent(e.target.checked); }} className="mt-0.5 size-4 accent-[var(--color-red)]" />
          <span>
            Email me the checklist and a few delivery-day tips. We never share your details.
            {errors.consent && <span className="block text-red">{errors.consent}</span>}
          </span>
        </label>
      </div>

      <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-line bg-mist px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <button type="button" onClick={onClose} className="text-[13px] font-medium text-muted hover:text-ink">
          Not now
        </button>
        <Button type="submit" disabled={sending} icon={sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}>
          {sending ? "Sending…" : "Send me the PDF"}
        </Button>
      </div>
    </form>
  );
}

function FuelPicker({
  options,
  value,
  onChange,
  error,
}: {
  options: FuelType[];
  value: FuelType | "";
  onChange: (fuel: FuelType) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="sm:col-span-2">
      <p id={id} className="mb-2 block text-[12.5px] font-medium text-ink">
        Fuel type
      </p>
      <div role="radiogroup" aria-labelledby={id} aria-describedby={error ? `${id}-msg` : undefined} className="flex flex-wrap gap-2">
        {options.map((f) => {
          const on = f === value;
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(f)}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[13.5px] font-medium transition-colors duration-[250ms]",
                on ? "border-ink bg-ink text-white" : error ? "border-red text-ink hover:border-ink" : "border-line text-ink hover:border-ink/40",
              )}
            >
              {on && <Check aria-hidden className="size-3.5" strokeWidth={3} />}
              {FUEL_LABEL[f]}
            </button>
          );
        })}
      </div>
      {error && (
        <p id={`${id}-msg`} className="mt-1.5 text-xs text-red">
          {error}
        </p>
      )}
    </div>
  );
}
