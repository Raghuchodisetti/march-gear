"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { AlertTriangle, Check, Headset, Loader2, PhoneCall } from "lucide-react";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { submitInsuranceLeadAction, type InsuranceLeadInput } from "@/server/actions/insurance-leads";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { Honeypot } from "@/components/forms/honeypot";
import { CONSENT_REQUIRED, ConsentCheckbox, PrivacyLink } from "@/components/forms/consent";
import { radioGroupKeyDown, rovingTabIndex, useFormFeedback } from "@/components/forms/form-a11y";
import { useUI, useUser } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import {
  CALL_TIMES,
  CALL_TIME_LABEL,
  CAR_WHERE,
  CAR_WHERE_LABEL,
  CLAIM_KINDS,
  CLAIM_KIND_LABEL,
  HELP_TOPICS,
  HELP_TOPIC_LABEL,
  type CallTime,
  type CarWhere,
  type ClaimKind,
  type HelpTopic,
} from "./lead-options";

/* ──────────────────────────────────────────────────────────────
   Callback requests from the insurance pages → leads table
   (insurance_help / insurance_claim). MarchGear explains; it
   never files, approves or settles a claim.
   ────────────────────────────────────────────────────────────── */

const NETWORK_ERROR = "Couldn't send — check your connection and try again.";
const PLACE = /^[\p{L}\p{M} .'()&-]{2,64}$/u;

/** Server field paths → this form's error slots. */
const FIELD_FOR: Record<string, string> = {
  name: "name",
  phone: "phone",
  email: "email",
  city: "city",
  message: "message",
  consent: "consent",
  "details.kind": "kind",
  "details.where": "where",
  "details.incidentDate": "incidentDate",
  "details.insurer": "insurer",
  "details.policyNumber": "policyNumber",
  "details.topic": "topic",
  "details.callTime": "callTime",
  "details.car": "car",
};

const localISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Contact fields shared by both forms. */
function useContact() {
  const { user } = useUser();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState(user?.city ?? "");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  return { name, setName, phone, setPhone, email, setEmail, city, setCity, consent, setConsent, website, setWebsite };
}
type Contact = ReturnType<typeof useContact>;

function checkContact(c: Contact, e: Record<string, string>) {
  if (c.name.trim().length < 2) e.name = "Enter your full name";
  if (!/^[6-9]\d{9}$/.test(c.phone)) e.phone = "Enter a valid 10-digit mobile number";
  if (c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) e.email = "Enter a valid email address";
  if (c.city.trim() && !PLACE.test(c.city.trim())) e.city = "Enter a valid city name";
  if (!c.consent) e.consent = CONSENT_REQUIRED;
}

/** Sends the request and maps server errors back onto the form. */
function useSubmit() {
  const { toast } = useUI();
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const feedback = useFormFeedback();
  const send = async (input: InsuranceLeadInput, success: string, form: HTMLFormElement) => {
    setStatus("sending");
    try {
      const res = await submitInsuranceLeadAction(input);
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
        feedback.report(mapped, form, unplaced);
        if (note) toast(note, { tone: "error" });
        return;
      }
      setReference(res.reference);
      setStatus("done");
      toast(success, { tone: "success" });
    } catch {
      setStatus("idle");
      toast(NETWORK_ERROR, { tone: "error" });
    }
  };
  return { status, setStatus, reference, errors, setErrors, send, feedback };
}

function ContactFields({ c, errors, clear, idPrefix, withEmail = false }: { c: Contact; errors: Record<string, string>; clear: (k: string) => void; idPrefix: string; withEmail?: boolean }) {
  return (
    <>
      <TextField
        id={`${idPrefix}-name`}
        label="Your name"
        autoComplete="name"
        value={c.name}
        onChange={(e) => {
          c.setName(e.target.value);
          clear("name");
        }}
        error={errors.name}
        placeholder="Full name"
        maxLength={120}
      />
      <TextField
        id={`${idPrefix}-phone`}
        label="Mobile number"
        prefix="+91"
        inputMode="numeric"
        autoComplete="tel-national"
        value={c.phone}
        onChange={(e) => {
          c.setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
          clear("phone");
        }}
        error={errors.phone}
        placeholder="98765 43210"
      />
      {withEmail && (
        <TextField
          id={`${idPrefix}-email`}
          label="Email (optional)"
          type="email"
          autoComplete="email"
          value={c.email}
          onChange={(e) => {
            c.setEmail(e.target.value);
            clear("email");
          }}
          error={errors.email}
          placeholder="you@example.com"
        />
      )}
      <TextField
        id={`${idPrefix}-city`}
        label="City (optional)"
        autoComplete="address-level2"
        value={c.city}
        onChange={(e) => {
          c.setCity(e.target.value);
          clear("city");
        }}
        error={errors.city}
        placeholder="e.g. Pune"
        maxLength={64}
      />
    </>
  );
}

function Consent({ id, c, error, clear, children }: { id: string; c: Contact; error?: string; clear: () => void; children: ReactNode }) {
  return (
    <ConsentCheckbox
      id={id}
      className="sm:col-span-2"
      checked={c.consent}
      onChange={(v) => {
        c.setConsent(v);
        clear();
      }}
      error={error}
    >
      {children} See the <PrivacyLink />.
    </ConsentCheckbox>
  );
}

function Done({ reference, phone, title, children, onReset, resetLabel }: { reference: string; phone: string; title: string; children: ReactNode; onReset: () => void; resetLabel: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="p-6 sm:p-8" role="status">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-red text-white">
        <Check className="size-6" strokeWidth={2.5} aria-hidden />
      </span>
      <h3 className="type-h3 mt-5">{title}</h3>
      <div className="mt-3 max-w-lg space-y-3 text-[14.5px] leading-relaxed text-muted">{children}</div>
      <dl className="mt-6 grid grid-cols-1 gap-x-10 gap-y-3 border-t border-line pt-5 text-[14px] sm:grid-cols-2">
        <div>
          <dt className="text-[12px] text-muted">Reference</dt>
          <dd className="mt-0.5 font-mono font-semibold tracking-wider">{reference}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">We&apos;ll call</dt>
          <dd className="mt-0.5 font-medium num">+91 {phone.replace(/(\d{5})(\d{5})/, "$1 $2")}</dd>
        </div>
      </dl>
      <Button variant="outline" className="mt-6" onClick={onReset}>
        {resetLabel}
      </Button>
    </motion.div>
  );
}

/* ── Talk to an expert (insurance_help) ─────────────────────── */

export function HelpCallbackForm({ defaultTopic = "new", onDone }: { defaultTopic?: HelpTopic; onDone?: () => void }) {
  const pathname = usePathname();
  const { hours } = useCatalog().content.site;
  const c = useContact();
  const { status, setStatus, reference, errors, setErrors, send, feedback } = useSubmit();
  const [topic, setTopic] = useState<HelpTopic>(defaultTopic);
  const [callTime, setCallTime] = useState<CallTime>("anytime");
  const [car, setCar] = useState("");
  const [message, setMessage] = useState("");
  const clear = (k: string) => setErrors((e) => (e[k] ? Object.fromEntries(Object.entries(e).filter(([x]) => x !== k)) : e));

  const submit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (status === "sending") return;
    const form = ev.currentTarget;
    const e: Record<string, string> = {};
    checkContact(c, e);
    setErrors(e);
    if (feedback.report(e, form)) return;
    await send(
      {
        type: "insurance_help",
        name: c.name.trim(),
        phone: c.phone,
        city: c.city.trim(),
        message: message.trim(),
        source: pathname,
        consent: true,
        website: c.website,
        details: { topic, callTime, car: car.trim() },
      },
      "Request sent — we'll call you back",
      form,
    );
  };

  if (status === "done")
    return (
      <Done
        reference={reference}
        phone={c.phone}
        title="We'll call you back"
        resetLabel={onDone ? "Close" : "Send another request"}
        onReset={() => (onDone ? onDone() : setStatus("idle"))}
      >
        <p>
          A MarchGear team member will call you {callTime === "anytime" ? "" : `in the ${CALL_TIME_LABEL[callTime].toLowerCase()} `}during our working hours ({hours}) to talk through{" "}
          {HELP_TOPIC_LABEL[topic].toLowerCase()}.
        </p>
        <p>We explain options and how cover works; we don&apos;t sell or issue policies. Quotes always come from the insurers you choose.</p>
      </Done>
    );

  return (
    <form onSubmit={submit} noValidate className="relative">
      <Honeypot value={c.website} onChange={c.setWebsite} />
      {feedback.live}
      <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2 sm:p-8">
        <div className="sm:col-span-2">
          <p id="help-topic-label" className="mb-2 block text-[12.5px] font-medium text-ink">
            What would you like help with?
          </p>
          <div role="radiogroup" aria-labelledby="help-topic-label" onKeyDown={radioGroupKeyDown} className="flex flex-wrap gap-2">
            {HELP_TOPICS.map((t, i) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={topic === t}
                tabIndex={rovingTabIndex(topic === t, i, true)}
                onClick={() => setTopic(t)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors duration-[250ms]",
                  topic === t ? "border-ink bg-ink text-white" : "border-line text-ink hover:border-ink",
                )}
              >
                {HELP_TOPIC_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        <ContactFields c={c} errors={errors} clear={clear} idPrefix="help" />
        <SelectField
          label="Best time to call"
          options={CALL_TIMES.map((t) => ({ value: t, label: CALL_TIME_LABEL[t] }))}
          value={callTime}
          onChange={(e) => setCallTime(e.target.value as CallTime)}
          error={errors.callTime}
        />
        <TextField className="sm:col-span-2" label="Your car (optional)" value={car} onChange={(e) => setCar(e.target.value)} placeholder="e.g. 2022 Hyundai Creta SX petrol" maxLength={160} error={errors.car} />
        <TextArea className="sm:col-span-2" label="Anything we should know? (optional)" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
        <Consent id="help-consent" c={c} error={errors.consent} clear={() => clear("consent")}>
          I agree that MarchGear may call me about this request, using the details I&apos;ve entered here. MarchGear doesn&apos;t sell or issue policies.
        </Consent>
      </div>
      <div className="flex flex-col gap-3 border-t border-line bg-mist/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="text-[12.5px] text-muted">Calls during working hours ({hours}).</p>
        <Button type="submit" size="lg" disabled={status === "sending"} icon={status === "sending" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PhoneCall className="size-4" aria-hidden />}>
          {status === "sending" ? "Sending…" : "Request a callback"}
        </Button>
      </div>
    </form>
  );
}

/** A button that opens the "talk to an expert" form in a modal. */
export function ExpertCallbackButton({
  topic = "new",
  label = "Talk to an expert",
  variant = "outline",
  className,
}: {
  topic?: HelpTopic;
  label?: string;
  variant?: "outline" | "outline-light" | "dark" | "primary" | "light";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Remount the form each time so a finished request starts fresh next time.
  const [round, setRound] = useState(0);
  return (
    <>
      <Button
        variant={variant}
        size="lg"
        className={className}
        icon={<Headset className="size-4" aria-hidden />}
        onClick={() => {
          setRound((r) => r + 1);
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} size="lg" title="Talk to an insurance expert" description="Free, no obligation. We'll explain your options in plain language.">
        <HelpCallbackForm key={round} defaultTopic={topic} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

/* ── Claim assistance (insurance_claim) ─────────────────────── */

export function ClaimCallbackForm() {
  const pathname = usePathname();
  const { hours } = useCatalog().content.site;
  const c = useContact();
  const { status, setStatus, reference, errors, setErrors, send, feedback } = useSubmit();
  const [kind, setKind] = useState<ClaimKind | "">("");
  const [where, setWhere] = useState<CarWhere | "">("");
  const [incidentDate, setIncidentDate] = useState("");
  const [informed, setInformed] = useState<"yes" | "no" | "">("");
  const [insurer, setInsurer] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [message, setMessage] = useState("");
  const clear = (k: string) => setErrors((e) => (e[k] ? Object.fromEntries(Object.entries(e).filter(([x]) => x !== k)) : e));
  const today = localISO();

  const submit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (status === "sending") return;
    const form = ev.currentTarget;
    const e: Record<string, string> = {};
    if (!kind) e.kind = "Choose what happened";
    if (!where) e.where = "Tell us where the car is now";
    if (!incidentDate) e.incidentDate = "Choose the date it happened";
    else if (incidentDate > today) e.incidentDate = "The date can't be in the future";
    if (!informed) e.informed = "Let us know";
    checkContact(c, e);
    setErrors(e);
    if (feedback.report(e, form)) return;
    await send(
      {
        type: "insurance_claim",
        name: c.name.trim(),
        phone: c.phone,
        email: c.email.trim(),
        city: c.city.trim(),
        message: message.trim(),
        source: pathname,
        consent: true,
        website: c.website,
        details: { kind: kind as ClaimKind, where: where as CarWhere, incidentDate, insurer: insurer.trim(), policyNumber: policyNumber.trim(), informedInsurer: informed === "yes" },
      },
      "Request sent — we'll call you back",
      form,
    );
  };

  if (status === "done")
    return (
      <div className="border border-line bg-white">
        <Done reference={reference} phone={c.phone} title="We'll call you to talk it through" resetLabel="Send another request" onReset={() => setStatus("idle")}>
          <p>A MarchGear team member will call you during working hours ({hours}) to explain the claim process and the documents you&apos;ll need.</p>
          {informed !== "yes" && (
            <p className="flex items-start gap-2 border-l-2 border-red bg-red-50 px-3 py-2 text-[13.5px] text-ink">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
              This is not a claim. Please inform your insurer directly as soon as possible — most policies set a time limit for reporting.
            </p>
          )}
        </Done>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="relative border border-line bg-white">
      <Honeypot value={c.website} onChange={c.setWebsite} />
      {feedback.live}
      <div className="flex items-start gap-3 border-b border-line bg-mist/60 px-6 py-4 text-[13px] leading-relaxed text-muted sm:px-8">
        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
        <p>
          <strong className="font-semibold text-ink">This doesn&apos;t register a claim.</strong> MarchGear can&apos;t file, approve or settle claims — only your insurer can. Inform your insurer directly, then ask us for help understanding the process.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2 sm:p-8">
        <SelectField
          id="claim-kind"
          label="What happened?"
          placeholder="Choose one"
          options={CLAIM_KINDS.map((k) => ({ value: k, label: CLAIM_KIND_LABEL[k] }))}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as ClaimKind | "");
            clear("kind");
            if (e.target.value === "theft") setWhere("stolen");
          }}
          error={errors.kind}
        />
        <TextField
          id="claim-date"
          label="When did it happen?"
          type="date"
          max={today}
          value={incidentDate}
          onChange={(e) => {
            setIncidentDate(e.target.value);
            clear("incidentDate");
          }}
          error={errors.incidentDate}
        />
        <SelectField
          id="claim-where"
          label="Where is the car now?"
          placeholder="Choose one"
          options={CAR_WHERE.map((k) => ({ value: k, label: CAR_WHERE_LABEL[k] }))}
          value={where}
          onChange={(e) => {
            setWhere(e.target.value as CarWhere | "");
            clear("where");
          }}
          error={errors.where}
        />
        <div>
          <p id="claim-informed-label" className="mb-2 block text-[12.5px] font-medium text-ink">
            Have you informed your insurer?
          </p>
          <div
            role="radiogroup"
            aria-labelledby="claim-informed-label"
            aria-invalid={errors.informed ? true : undefined}
            aria-describedby={errors.informed ? "claim-informed-msg" : undefined}
            aria-required="true"
            onKeyDown={radioGroupKeyDown}
            className="grid h-12 grid-cols-2 gap-1 rounded-[3px] bg-mist p-1"
          >
            {(["yes", "no"] as const).map((v, i) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={informed === v}
                tabIndex={rovingTabIndex(informed === v, i, informed !== "")}
                onClick={() => {
                  setInformed(v);
                  clear("informed");
                }}
                className={cn("rounded-[2px] text-[13.5px] font-medium transition-colors duration-[250ms]", informed === v ? "bg-white text-ink shadow-soft" : "text-muted hover:text-ink")}
              >
                {v === "yes" ? "Yes" : "Not yet"}
              </button>
            ))}
          </div>
          {errors.informed && (
            <p id="claim-informed-msg" className="mt-1.5 text-xs text-red">
              {errors.informed}
            </p>
          )}
          {informed === "no" && <p className="mt-1.5 text-xs text-ink">Please call your insurer&apos;s claims line now — the number is on your policy.</p>}
        </div>
        <TextField id="claim-insurer" label="Your insurer (optional)" value={insurer} onChange={(e) => setInsurer(e.target.value)} placeholder="As printed on your policy" maxLength={120} error={errors.insurer} />
        <TextField id="claim-policy" label="Policy number (optional)" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} maxLength={60} error={errors.policyNumber} />
        <ContactFields c={c} errors={errors} clear={clear} idPrefix="claim" withEmail />
        <TextArea className="sm:col-span-2" label="What would you like help with? (optional)" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} placeholder="e.g. The garage says the bumper isn't covered — is that right?" />
        <Consent id="claim-consent" c={c} error={errors.consent} clear={() => clear("consent")}>
          I agree that MarchGear may call me about this request, using the details I&apos;ve entered here. I understand MarchGear doesn&apos;t process claims.
        </Consent>
      </div>
      <div className="flex flex-col gap-3 border-t border-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="text-[12.5px] text-muted">Emergency or injuries? Call 112 first.</p>
        <Button type="submit" size="lg" disabled={status === "sending"} icon={status === "sending" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PhoneCall className="size-4" aria-hidden />}>
          {status === "sending" ? "Sending…" : "Request a callback"}
        </Button>
      </div>
    </form>
  );
}
