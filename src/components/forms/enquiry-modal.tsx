"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { CalendarCheck, Check, Loader2, PhoneCall, ShieldCheck, Tag, Wrench } from "lucide-react";
import { cities, getCity } from "@/data/cities";
import { submitLeadAction, type LeadInput } from "@/server/actions/leads";
import { Modal } from "@/components/ui/overlay";
import { SelectField, TextArea, TextField, Segmented } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Honeypot } from "@/components/forms/honeypot";
import { useCity, useUI, useUser, type EnquiryKind } from "@/components/providers/app-provider";

const COPY: Record<EnquiryKind, { title: string; intro: string; cta: string; icon: React.ReactNode; done: string }> = {
  "test-drive": {
    title: "Book a test drive",
    intro: "Choose a slot and a product expert will confirm within two working hours.",
    cta: "Request test drive",
    icon: <CalendarCheck className="size-5" />,
    done: "A dealer will call to confirm your slot and location.",
  },
  "best-price": {
    title: "Get the best price",
    intro: "Receive the lowest on-road quote from up to three verified dealers.",
    cta: "Get my quote",
    icon: <Tag className="size-5" />,
    done: "Expect quotes by SMS and email within 24 hours.",
  },
  "contact-dealer": {
    title: "Contact the dealer",
    intro: "Share your details and the dealership will reach out directly.",
    cta: "Send enquiry",
    icon: <PhoneCall className="size-5" />,
    done: "The dealer has been notified and will call you shortly.",
  },
  callback: {
    title: "Request a callback",
    intro: "One of our advisors will call you at a time that suits you.",
    cta: "Request callback",
    icon: <PhoneCall className="size-5" />,
    done: "An advisor will call you within your preferred window.",
  },
  inspection: {
    title: "Book a free inspection",
    intro: "Our engineer will visit you for a 200-point inspection and an instant offer.",
    cta: "Book inspection",
    icon: <Wrench className="size-5" />,
    done: "Your inspection is booked. We'll send the engineer's details on the day.",
  },
};

/** `YYYY-MM-DD` in the visitor's own calendar (toISOString would shift it to UTC). */
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function nextDays(n: number) {
  const out: { value: string; label: string }[] = [];
  const d = new Date();
  for (let i = 1; i <= n; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    out.push({
      value: isoDay(x),
      label: x.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
    });
  }
  return out;
}

const LEAD_TYPE = {
  "test-drive": "test_drive",
  "best-price": "best_price",
  "contact-dealer": "contact_dealer",
  callback: "callback",
  inspection: "inspection",
} as const satisfies Record<EnquiryKind, LeadInput["type"]>;

/** Server field paths → this form's error slots. */
const FIELD_FOR: Record<string, string> = { name: "name", phone: "phone", city: "city", "details.date": "date" };

const NETWORK_ERROR = "Couldn't send — check your connection and try again.";

export function EnquiryModal() {
  const { enquiry, closeEnquiry } = useUI();
  const open = enquiry !== null;
  return (
    <Modal open={open} onClose={closeEnquiry} bare size="md" labelledBy="enquiry-title">
      {/* Keyed so each opening starts from a fresh form */}
      {enquiry && <EnquiryForm key={`${enquiry.kind}-${enquiry.subject}`} onClose={closeEnquiry} />}
    </Modal>
  );
}

function EnquiryForm({ onClose }: { onClose: () => void }) {
  const { enquiry, toast } = useUI();
  const { city } = useCity();
  const { user } = useUser();
  const pathname = usePathname();
  const kind = enquiry?.kind ?? "callback";
  const copy = COPY[kind];

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [citySlug, setCitySlug] = useState(city.slug);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<"morning" | "afternoon" | "evening">("morning");
  const [timeline, setTimeline] = useState<"week" | "month" | "later">("month");
  const [message, setMessage] = useState(enquiry?.subject ? `I'm interested in the ${enquiry.subject}.` : "");
  const [consent, setConsent] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [reference, setReference] = useState("");
  const [website, setWebsite] = useState("");
  const days = useState(() => nextDays(7))[0];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Please enter your full name";
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, "").slice(-10))) next.phone = "Enter a valid 10-digit mobile number";
    if ((kind === "test-drive" || kind === "inspection") && !date) next.date = "Pick a preferred date";
    if (!consent) next.consent = "Please accept to continue";
    setErrors(next);
    if (Object.keys(next).length) return;

    const subject = enquiry?.subject ? `${enquiry.subject}${enquiry.detail ? ` · ${enquiry.detail}` : ""}`.slice(0, 200) : undefined;
    const common = {
      name: name.trim(),
      phone,
      city: getCity(citySlug).name,
      subject,
      carSlug: enquiry?.carSlug,
      usedCarId: enquiry?.usedCarId,
      dealerId: enquiry?.dealerId,
      source: pathname,
      website,
    };
    const type = LEAD_TYPE[kind];
    const input: LeadInput =
      type === "test_drive" || type === "inspection"
        ? { ...common, type, details: { date, slot } }
        : type === "best_price"
          ? { ...common, type, details: { timeline } }
          : { ...common, type, message: message.trim() || undefined };

    setStatus("sending");
    try {
      const res = await submitLeadAction(input);
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
      toast(`${copy.title} — request received`, { tone: "success" });
    } catch {
      setStatus("idle");
      toast(NETWORK_ERROR, { tone: "error" });
    }
  };

  if (status === "done") {
    return (
      <div className="p-8 text-center sm:p-10">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="mx-auto flex size-16 items-center justify-center rounded-full bg-red text-white"
        >
          <Check className="size-7" strokeWidth={2.5} />
        </motion.div>
        <h2 id="enquiry-title" className="type-h2 mt-6">
          Request received
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-muted">{copy.done}</p>
        <div className="mx-auto mt-6 inline-flex items-center gap-3 border border-line px-4 py-2.5 text-[13px]">
          <span className="text-muted">Reference</span>
          <span className="font-mono font-semibold tracking-wider">{reference}</span>
        </div>
        <Button variant="dark" className="mt-8 w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <Honeypot value={website} onChange={setWebsite} />
      <div className="flex items-start justify-between gap-6 border-b border-line px-6 py-5 sm:px-8">
        <div className="flex gap-4">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-mist text-ink">{copy.icon}</span>
          <div>
            <h2 id="enquiry-title" className="type-h3">
              {copy.title}
            </h2>
            {enquiry?.subject && (
              <p className="mt-1 text-[14px] font-medium">
                {enquiry.subject}
                {enquiry.detail && <span className="font-normal text-muted"> · {enquiry.detail}</span>}
              </p>
            )}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-mist">
          <span aria-hidden className="text-xl leading-none">×</span>
        </button>
      </div>

      <div className="space-y-5 px-6 py-6 sm:px-8">
        <p className="text-[14px] text-muted">{copy.intro}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField data-autofocus label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="name" placeholder="Your name" />
          <TextField
            label="Mobile number"
            prefix="+91"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
            error={errors.phone}
            autoComplete="tel-national"
            placeholder="98765 43210"
          />
        </div>
        <SelectField label="City" value={citySlug} onChange={(e) => setCitySlug(e.target.value)} options={cities.map((c) => ({ value: c.slug, label: c.name }))} error={errors.city} />

        {(kind === "test-drive" || kind === "inspection") && (
          <>
            <SelectField label="Preferred date" placeholder="Select a date" value={date} onChange={(e) => setDate(e.target.value)} options={days} />
            {errors.date && <p className="-mt-3 text-xs text-red">{errors.date}</p>}
            <div>
              <p className="mb-2 text-[12.5px] font-medium">Preferred time</p>
              <Segmented
                className="flex w-full"
                ariaLabel="Preferred time"
                value={slot}
                onChange={setSlot}
                options={[
                  { value: "morning", label: "Morning" },
                  { value: "afternoon", label: "Afternoon" },
                  { value: "evening", label: "Evening" },
                ]}
              />
            </div>
          </>
        )}

        {kind === "best-price" && (
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
        )}

        {(kind === "contact-dealer" || kind === "callback") && (
          <TextArea label="Message (optional)" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
        )}

        <label className="flex cursor-pointer items-start gap-3 text-[12.5px] text-muted">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-red)]" />
          <span>
            I agree to be contacted by March Gear and its partners about this enquiry.
            {errors.consent && <span className="block text-red">{errors.consent}</span>}
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-3 border-t border-line bg-mist/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="flex items-center gap-2 text-[12px] text-muted">
          <ShieldCheck className="size-4 text-ink" aria-hidden /> Your number is never shared without consent.
        </p>
        <Button type="submit" variant="primary" disabled={status === "sending"} className="sm:min-w-44">
          {status === "sending" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {status === "sending" ? "Sending…" : copy.cta}
        </Button>
      </div>
    </form>
  );
}
