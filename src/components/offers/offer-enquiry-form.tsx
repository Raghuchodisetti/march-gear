"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { submitLeadAction } from "@/server/actions/leads";
import { Segmented, SelectField, TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Honeypot } from "@/components/forms/honeypot";
import { useCity, useUI, useUser } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { Countdown } from "./countdown";

/** "Get this offer" — a best-price lead for the offering dealership, tagged with the offer reference. */
export function OfferEnquiryForm({
  offer,
  models,
  renderedAt,
}: {
  offer: { reference: string; title: string; headline: string; dealerId: string; dealerName: string; dealerCity: string; startsAt: string; endsAt: string };
  models: { slug: string; name: string }[];
  renderedAt: number;
}) {
  const { toast } = useUI();
  const { user } = useUser();
  const { city } = useCity();
  const { cities } = useCatalog();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [citySlug, setCitySlug] = useState(() => cities.find((c) => c.name === offer.dealerCity)?.slug ?? city.slug);
  const [model, setModel] = useState(models.length === 1 ? models[0].slug : "");
  const [timeline, setTimeline] = useState<"week" | "month" | "later">("month");
  const [consent, setConsent] = useState(true);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [ref, setRef] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Please enter your full name";
    if (!/^[6-9]\d{9}$/.test(phone)) next.phone = "Enter a valid 10-digit mobile number";
    if (!consent) next.consent = "Please accept to continue";
    setErrors(next);
    if (Object.keys(next).length) return;

    const modelName = models.find((m) => m.slug === model)?.name;
    setStatus("sending");
    try {
      const res = await submitLeadAction({
        type: "best_price",
        name: name.trim(),
        phone,
        city: cities.find((c) => c.slug === citySlug)?.name,
        subject: offer.title.slice(0, 200),
        carSlug: model || undefined,
        dealerId: offer.dealerId,
        message: `Offer ${offer.reference} — ${offer.title}${modelName ? ` · Interested in the ${modelName}` : ""}`.slice(0, 2000),
        source: `/offers/${offer.reference}`,
        details: { timeline },
        website,
      });
      if (!res.ok) {
        setStatus("idle");
        const fe = res.fieldErrors ?? {};
        setErrors({ name: fe.name, phone: fe.phone, city: fe.city } as Record<string, string>);
        toast(res.error ?? "Please check the highlighted fields.", { tone: "error" });
        return;
      }
      setRef(res.reference);
      setStatus("done");
      toast("Request sent to the showroom", { tone: "success" });
    } catch {
      setStatus("idle");
      toast("Couldn't send — check your connection and try again.", { tone: "error" });
    }
  };

  if (status === "done")
    return (
      <div className="p-6 text-center sm:p-8">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 20 }}
          className="mx-auto flex size-14 items-center justify-center rounded-full bg-red text-white"
        >
          <Check className="size-6" strokeWidth={2.5} aria-hidden />
        </motion.div>
        <h2 className="type-h3 mt-5">Request received</h2>
        <p className="mx-auto mt-2 max-w-xs text-[14px] text-muted">
          {offer.dealerName} will call you about this offer. Quote the reference when you visit.
        </p>
        <div className="mx-auto mt-5 inline-flex items-center gap-3 border border-line px-4 py-2.5 text-[13px]">
          <span className="text-muted">Reference</span>
          <span className="font-mono font-semibold tracking-wider">{ref}</span>
        </div>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="relative">
      <Honeypot value={website} onChange={setWebsite} />
      <div className="border-b border-line px-6 py-5">
        <p className="type-eyebrow text-muted">Get this offer</p>
        <p className="mt-2 font-display text-[24px] font-semibold leading-tight tracking-[-0.02em] text-red">{offer.headline}</p>
        <div className="mt-2">
          <Countdown startsAt={offer.startsAt} endsAt={offer.endsAt} renderedAt={renderedAt} />
        </div>
      </div>
      <div className="space-y-4 px-6 py-5">
        <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="name" placeholder="Your name" />
        <TextField
          label="Mobile number"
          prefix="+91"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          error={errors.phone}
          autoComplete="tel-national"
          placeholder="98765 43210"
        />
        <SelectField label="City" value={citySlug} onChange={(e) => setCitySlug(e.target.value)} options={cities.map((c) => ({ value: c.slug, label: c.name }))} error={errors.city} />
        {models.length > 1 && (
          <SelectField label="Car you're interested in (optional)" placeholder="Not sure yet" value={model} onChange={(e) => setModel(e.target.value)} options={models.map((m) => ({ value: m.slug, label: m.name }))} />
        )}
        <div>
          <p className="mb-2 text-[12.5px] font-medium">When are you planning to buy?</p>
          <Segmented
            className="flex w-full"
            ariaLabel="Purchase timeline"
            value={timeline}
            onChange={setTimeline}
            options={[
              { value: "week", label: "This week" },
              { value: "month", label: "This month" },
              { value: "later", label: "Later" },
            ]}
          />
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-[12.5px] text-muted">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-red)]" />
          <span>
            I agree to be contacted by {offer.dealerName} and MarchGear about this offer.
            {errors.consent && <span className="block text-red">{errors.consent}</span>}
          </span>
        </label>
        <Button type="submit" className="w-full" disabled={status === "sending"} icon={status === "sending" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
          {status === "sending" ? "Sending…" : "Request a call back"}
        </Button>
        <p className="flex items-center justify-center gap-2 text-[12px] text-muted">
          <ShieldCheck aria-hidden className="size-4 text-ink" /> Shared only with this showroom and MarchGear.
        </p>
      </div>
    </form>
  );
}
