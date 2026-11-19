"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { CalendarCheck, Check, Loader2, ShieldCheck } from "lucide-react";
import { cities } from "@/data/cities";
import { pdiPlans, type PdiPlanId } from "@/data/pdi";
import { formatINR } from "@/lib/format";
import { useStore } from "@/lib/store";
import { EASE } from "@/lib/motion";
import { submitLeadAction } from "@/server/actions/leads";
import { Button } from "@/components/ui/button";
import { Label, Segmented, SelectField, TextField } from "@/components/ui/field";
import { Honeypot } from "@/components/forms/honeypot";
import { useCity, useUI, useUser } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { pdiPlanStore } from "./pdi-plans";

/** Server field paths → this form's error slots. */
const FIELD_FOR: Record<string, string> = {
  name: "name",
  phone: "phone",
  city: "city",
  subject: "car",
  carSlug: "car",
  "details.dealer": "dealer",
  "details.deliveryDate": "date",
};

const NETWORK_ERROR = "Couldn't send — check your connection and try again.";

export function PdiBooking() {
  const plan = useStore(pdiPlanStore);
  const { city } = useCity();
  const { user } = useUser();
  const { toast } = useUI();
  const pathname = usePathname();
  const { cars, brandName } = useCatalog();
  const carOptions = useMemo(
    () => cars.map((c) => ({ value: c.slug, label: `${brandName(c.brand)} ${c.name}` })).sort((a, b) => a.label.localeCompare(b.label)),
    [cars, brandName],
  );

  const [car, setCar] = useState("");
  const [citySlug, setCitySlug] = useState(city.slug);
  const [dealer, setDealer] = useState("");
  const [date, setDate] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [consent, setConsent] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [reference, setReference] = useState("");
  const [website, setWebsite] = useState("");

  const selectedPlan = pdiPlans.find((p) => p.id === plan) ?? pdiPlans[1];
  const carLabel = carOptions.find((c) => c.value === car)?.label;
  const cityName = cities.find((c) => c.slug === citySlug)?.name;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    const next: Record<string, string> = {};
    if (!car) next.car = "Choose the car you're buying";
    if (dealer.trim().length < 2) next.dealer = "Enter the dealership name";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!date) next.date = "Choose your delivery date";
    else if (new Date(`${date}T00:00:00`) < today) next.date = "Pick a date from today onwards";
    if (name.trim().length < 2) next.name = "Enter your full name";
    if (!/^[6-9]\d{9}$/.test(phone)) next.phone = "Enter a valid 10-digit mobile number";
    if (!consent) next.consent = "Please accept to continue";
    setErrors(next);
    if (Object.keys(next).length) return;

    setStatus("sending");
    try {
      const res = await submitLeadAction({
        type: "pdi_booking",
        name: name.trim(),
        phone,
        city: cityName ?? "",
        subject: carLabel ?? "",
        carSlug: car,
        source: pathname,
        website,
        details: { plan: selectedPlan.name, dealer: dealer.trim(), deliveryDate: date },
      });
      if (!res.ok) {
        setStatus("idle");
        const mapped: Record<string, string> = {};
        let unplaced: string | undefined;
        for (const [key, msg] of Object.entries(res.fieldErrors ?? {})) {
          if (FIELD_FOR[key]) mapped[FIELD_FOR[key]] ??= msg;
          else unplaced ??= msg;
        }
        setErrors(mapped);
        const note = unplaced ?? res.error;
        if (note) toast(note, { tone: "error" });
        return;
      }
      setReference(res.reference);
      setStatus("done");
      toast("PDI booked — an expert will call to confirm", { tone: "success" });
    } catch {
      setStatus("idle");
      toast(NETWORK_ERROR, { tone: "error" });
    }
  };

  if (status === "done") {
    const deliveryDate = new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="border border-line bg-white p-7 md:p-10">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-red text-white">
          <Check className="size-7" strokeWidth={2.5} />
        </span>
        <h3 className="type-h2 mt-6">Your PDI is booked</h3>
        <p className="mt-3 max-w-lg text-[15px] text-muted">
          A March Gear inspector will call you within 2 working hours to confirm the time and meet you at the dealership.
        </p>
        <dl className="mt-8 grid grid-cols-1 gap-x-10 gap-y-4 border-t border-line pt-6 text-[14px] sm:grid-cols-2">
          <Row label="Reference" value={<span className="font-mono font-semibold tracking-wider">{reference}</span>} />
          <Row label="Plan" value={`${selectedPlan.name} · ${formatINR(selectedPlan.price)}`} />
          <Row label="Car" value={carLabel} />
          <Row label="Dealership" value={`${dealer}, ${cityName}`} />
          <Row label="Delivery date" value={deliveryDate} />
          <Row label="Contact" value={`${name} · +91 ${phone}`} />
        </dl>
        <p className="mt-6 text-[12px] text-muted">No payment has been taken — you pay after the inspection.</p>
        <Button variant="outline" className="mt-6" onClick={() => setStatus("idle")}>
          Book another PDI
        </Button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="border border-line bg-white">
      <Honeypot value={website} onChange={setWebsite} />
      <div className="border-b border-line p-6 md:p-8">
        <Label>Choose a plan</Label>
        <Segmented<PdiPlanId>
          className="flex w-full"
          ariaLabel="PDI plan"
          value={plan}
          onChange={(v) => pdiPlanStore.set(v)}
          options={pdiPlans.map((p) => ({ value: p.id, label: p.name.replace(" PDI", "") }))}
        />
        <p className="mt-3 text-[13px] text-muted num">
          {selectedPlan.name}: {formatINR(selectedPlan.price)} · {selectedPlan.checks}+ checks · {selectedPlan.duration}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2 md:p-8">
        <div>
          <SelectField label="Car you're buying" placeholder="Select your car" value={car} onChange={(e) => setCar(e.target.value)} options={carOptions} aria-invalid={errors.car ? true : undefined} />
          {errors.car && <p className="mt-1.5 text-xs text-red">{errors.car}</p>}
        </div>
        <SelectField label="City" value={citySlug} onChange={(e) => setCitySlug(e.target.value)} options={cities.map((c) => ({ value: c.slug, label: c.name }))} error={errors.city} />
        <TextField label="Dealership name" placeholder="e.g. Torque Motors, Indiranagar" value={dealer} onChange={(e) => setDealer(e.target.value)} error={errors.dealer} />
        <TextField label="Delivery date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
        <TextField label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="Full name" />
        <TextField
          label="Mobile number"
          prefix="+91"
          inputMode="numeric"
          autoComplete="tel-national"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          error={errors.phone}
          placeholder="98765 43210"
        />
        <label className="flex cursor-pointer items-start gap-3 text-[12.5px] text-muted sm:col-span-2">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-red)]" />
          <span>
            I agree to be contacted by March Gear about this inspection.
            {errors.consent && <span className="block text-red">{errors.consent}</span>}
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-4 border-t border-line bg-mist/60 p-6 sm:flex-row sm:items-center sm:justify-between md:px-8">
        <p className="flex items-center gap-2 text-[12.5px] text-muted">
          <ShieldCheck aria-hidden className="size-4 text-ink" /> Pay after the inspection. Free rescheduling.
        </p>
        <Button type="submit" size="lg" disabled={status === "sending"} icon={status === "sending" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CalendarCheck className="size-4" aria-hidden />}>
          {status === "sending" ? "Booking…" : `Book PDI · ${formatINR(selectedPlan.price)}`}
        </Button>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
