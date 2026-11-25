"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Check, ClipboardCheck, Download, Loader2 } from "lucide-react";
import type { CarLite, FuelType } from "@/types";
import type { ClientCatalog as Catalog } from "@/lib/catalog";
import { PDI_FUELS } from "@/lib/pdi";
import { createPersistentStore, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { submitLeadAction } from "@/server/actions/leads";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { SelectField, TextField } from "@/components/ui/field";
import { Honeypot } from "@/components/forms/honeypot";
import { CONSENT_REQUIRED, ConsentCheckbox, PrivacyLink } from "@/components/forms/consent";
import { radioGroupKeyDown, rovingTabIndex, useFormFeedback } from "@/components/forms/form-a11y";
import { useUI, useUser } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { downloadChecklistPdf, pdfCheckCount } from "./checklist-pdf";

/* ──────────────────────────────────────────────────────────────
   Lead capture for the free DIY checklist: details in, checklist
   downloaded and unlocked on the page. Nothing is emailed (no email
   service is connected), so the email address is optional.
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

const brandOptionsFor = ({ brands, cars }: Catalog) => [
  ...brands
    .filter((b) => cars.some((c) => c.brand === b.slug))
    .map((b) => ({ value: b.slug, label: b.name }))
    .sort((a, b) => a.label.localeCompare(b.label)),
  { value: OTHER, label: "Other brand" },
];

const modelOptions = (brand: string, cars: CarLite[]) => [
  ...cars
    .filter((c) => c.brand === brand)
    .map((c) => ({ value: c.slug, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label)),
  { value: OTHER, label: "Other model" },
];

/** Maps a saved lead back to the brand / model fields. */
function carFields(lead: ChecklistLead | null, { brands, cars }: Catalog) {
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

const NETWORK_ERROR = "Couldn't send — check your connection and try again.";

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
  const pathname = usePathname();
  const catalog = useCatalog();
  const { cars, brandName } = catalog;
  const pdf = { checklist: catalog.content.pdiChecklist, phone: catalog.content.site.phone };
  const brandOptions = useMemo(() => brandOptionsFor(catalog), [catalog]);
  const [initial] = useState(() => carFields(existing, catalog));
  const [name, setName] = useState(existing?.name ?? user?.name ?? "");
  const [email, setEmail] = useState(existing?.email ?? user?.email ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? user?.phone ?? "");
  const [brand, setBrand] = useState(initial.brand);
  const [brandOther, setBrandOther] = useState(initial.brandOther);
  const [model, setModel] = useState(initial.model);
  const [modelOther, setModelOther] = useState(initial.modelOther);
  const [fuel, setFuel] = useState<FuelType | "">(existing?.fuel ?? "");
  const [delivery, setDelivery] = useState(existing?.delivery ?? "");
  const [consent, setConsent] = useState(false);
  const feedback = useFormFeedback();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<ChecklistLead | null>(null);
  const [website, setWebsite] = useState("");

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

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    const form = e.currentTarget;
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Enter your full name";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) next.email = "Enter a valid email address, or leave it empty";
    if (!/^[6-9]\d{9}$/.test(phone)) next.phone = "Enter a valid 10-digit mobile number";
    if (!brand) next.brand = "Choose your car's brand";
    else if (otherBrand && brandOther.trim().length < 2) next.brandOther = "Enter the brand name";
    if (brand && !otherBrand && !model) next.model = "Choose your model";
    else if (brand && typedModel && !modelOther.trim()) next.modelOther = "Enter the model name";
    if (!fuel) next.fuel = "Choose the fuel type";
    if (!delivery) next.delivery = "Choose your delivery date";
    else if (delivery < todayISO()) next.delivery = "Pick a date from today onwards";
    if (!consent) next.consent = CONSENT_REQUIRED;
    setErrors(next);
    if (feedback.report(next, form) || !fuel) return;

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

    // The lead is stored server-side; the PDF itself is generated and downloaded here.
    try {
      const res = await submitLeadAction({
        type: "pdi_checklist",
        name: saved.name,
        email: saved.email || undefined,
        phone: saved.phone,
        subject: `${saved.car} (${saved.fuel})`,
        carSlug: knownCar?.slug,
        source: pathname,
        consent: true,
        website,
        details: { brand: saved.brand, model: saved.model, fuel: saved.fuel, deliveryDate: saved.delivery },
      });
      if (!res.ok) {
        setSending(false);
        // Server field paths → this form's error slots.
        const slot: Record<string, string> = {
          name: "name",
          email: "email",
          phone: "phone",
          "details.brand": otherBrand ? "brandOther" : "brand",
          "details.model": typedModel ? "modelOther" : "model",
          "details.fuel": "fuel",
          "details.deliveryDate": "delivery",
          consent: "consent",
        };
        const mapped: Record<string, string> = {};
        let unplaced: string | undefined;
        for (const [key, msg] of Object.entries(res.fieldErrors ?? {})) {
          if (slot[key]) mapped[slot[key]] ??= msg;
          else unplaced ??= msg;
        }
        setErrors(mapped);
        const note = unplaced ?? res.error;
        feedback.report(mapped, form, unplaced);
        if (note) toast(note, { tone: "error" });
        return;
      }
    } catch {
      setSending(false);
      toast(NETWORK_ERROR, { tone: "error" });
      return;
    }

    pdiLeadStore.set(saved);
    setSent(saved);
    setSending(false);
    toast("Checklist ready — the PDF is downloading", { tone: "success" });
    try {
      await downloadChecklistPdf(pdf, saved);
    } catch {
      toast("Couldn't create the PDF — use the download button to try again", { tone: "error" });
    }
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
          <ClipboardCheck className="size-7" aria-hidden />
        </motion.span>
        <h2 id="gate-title" className="type-h2 mt-6">
          Your checklist is ready
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-[15px] text-muted">
          The {pdfCheckCount(pdf.checklist, sent.fuel)}-point PDI checklist for your{" "}
          <span className="font-medium text-ink">
            {sent.car} ({sent.fuel})
          </span>{" "}
          has been downloaded to this device.
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
          <Button variant="outline" icon={<Download className="size-4" aria-hidden />} onClick={() => downloadChecklistPdf(pdf, sent)}>
            Download PDF again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <Honeypot value={website} onChange={setWebsite} />
      {feedback.live}
      <div className="border-b border-line px-6 py-5 sm:px-8">
        <p className="type-eyebrow text-red">Free download</p>
        <h2 id="gate-title" className="type-h3 mt-2">
          Get the free PDI checklist
        </h2>
        <p className="mt-1.5 text-[14px] text-muted">
          A ready-to-print PDF of every check to do before you accept your new car — with extra checks for your car&apos;s fuel type. It downloads straight to this device. Email is optional.
        </p>
      </div>

      <div className="space-y-6 px-6 py-6 sm:px-8">
        <fieldset>
          <legend className="type-eyebrow text-muted">Your details</legend>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField data-autofocus label="Full name" autoComplete="name" value={name} onChange={(e) => { fix("name"); setName(e.target.value); }} error={errors.name} placeholder="Your name" className="sm:col-span-2" />
            <TextField label="Email (optional)" type="email" autoComplete="email" value={email} onChange={(e) => { fix("email"); setEmail(e.target.value); }} error={errors.email} placeholder="you@example.com" />
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
                  options={brand ? modelOptions(brand, cars) : []}
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

        <ConsentCheckbox
          id="gate-consent"
          checked={consent}
          onChange={(v) => {
            fix("consent");
            setConsent(v);
          }}
          error={errors.consent}
        >
          I agree that MarchGear may contact me by phone, WhatsApp or email about my car&apos;s delivery and its PDI inspection service, using the details I&apos;ve entered here. We
          don&apos;t share them with the dealer. See the <PrivacyLink />.
        </ConsentCheckbox>
      </div>

      <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-line bg-mist px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <button type="button" onClick={onClose} className="text-[13px] font-medium text-muted hover:text-ink">
          Not now
        </button>
        <Button type="submit" disabled={sending} icon={sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}>
          {sending ? "Preparing…" : "Get the checklist PDF"}
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
      <div
        role="radiogroup"
        aria-labelledby={id}
        aria-describedby={error ? `${id}-msg` : undefined}
        aria-invalid={error ? true : undefined}
        aria-required="true"
        onKeyDown={radioGroupKeyDown}
        className="flex flex-wrap gap-2"
      >
        {options.map((f, i) => {
          const on = f === value;
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={rovingTabIndex(on, i, Boolean(value))}
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
