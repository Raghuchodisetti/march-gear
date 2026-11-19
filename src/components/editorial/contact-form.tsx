"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import { contactTopics } from "@/data/editorial-company";
import { submitLeadAction } from "@/server/actions/leads";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Honeypot } from "@/components/forms/honeypot";
import { useUI, useUser } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";
import { EMAIL_RE } from "./newsletter-form";

type Field = "name" | "email" | "phone" | "topic" | "message";
const MIN_MESSAGE = 10;
const ORDER: Field[] = ["name", "email", "phone", "topic", "message"];
const EMPTY: Record<Field, string> = { name: "", email: "", phone: "", topic: "", message: "" };
/** Server field → form field. */
const FIELD_FOR: Record<string, Field> = { name: "name", email: "email", phone: "phone", subject: "topic", message: "message" };
const NETWORK_ERROR = "Couldn't reach the server. Check your connection and try again.";

/** "+91 98765 43210" / "098765 43210" → "9876543210" */
function phoneDigits(value: string) {
  return value.replace(/\D/g, "").replace(/^(0091|91|0)(?=\d{10}$)/, "");
}

/** Indian mobile: optional +91 / 0 prefix, then 10 digits starting 6–9. */
function validPhone(value: string) {
  return /^[6-9]\d{9}$/.test(phoneDigits(value));
}

export function ContactForm() {
  const pathname = usePathname();
  const { toast } = useUI();
  const { user } = useUser();
  const [values, setValues] = useState<Record<Field, string>>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ ref: string; name: string; email: string; topic: string } | null>(null);

  const set = (field: Field, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const prefill = () => {
    if (!user) return;
    setValues((v) => ({ ...v, name: v.name || user.name, email: v.email || user.email, phone: v.phone || user.phone }));
  };

  const focusFirst = (errs: Partial<Record<Field, string>>) => {
    const first = ORDER.find((f) => errs[f]);
    if (first) document.getElementById(`contact-${first}`)?.focus();
    return Boolean(first);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const next: Partial<Record<Field, string>> = {};
    if (values.name.trim().length < 2) next.name = "Please tell us your name";
    if (!EMAIL_RE.test(values.email.trim())) next.email = "Enter a valid email address so we can reply";
    if (values.phone.trim() && !validPhone(values.phone)) next.phone = "Enter a 10-digit Indian mobile number, or leave blank";
    if (!values.topic) next.topic = "Choose what your message is about";
    if (values.message.trim().length < MIN_MESSAGE) next.message = `A little more detail helps — at least ${MIN_MESSAGE} characters`;
    setErrors(next);
    setFormError(null);
    if (focusFirst(next)) return;

    const topic = contactTopics.find((t) => t.value === values.topic)?.label ?? "Something else";
    setBusy(true);
    try {
      const res = await submitLeadAction({
        type: "contact",
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim() ? phoneDigits(values.phone) : undefined,
        subject: topic,
        message: values.message.trim(),
        source: pathname,
        website,
      });
      if (!res.ok) {
        const mapped: Partial<Record<Field, string>> = {};
        let unplaced: string | undefined;
        for (const [key, msg] of Object.entries(res.fieldErrors ?? {})) {
          if (FIELD_FOR[key]) mapped[FIELD_FOR[key]] ??= msg;
          else unplaced ??= msg;
        }
        setErrors(mapped);
        if (!focusFirst(mapped) || unplaced) setFormError(unplaced ?? res.error ?? "We couldn't send your message. Please try again.");
        return;
      }
      setSent({ ref: res.reference, name: values.name.trim().split(" ")[0], email: values.email.trim(), topic });
      toast(`Message sent — reference ${res.reference}`, { tone: "success" });
    } catch {
      setFormError(NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="border border-line p-8 md:p-12" role="status">
        <span className="flex size-12 items-center justify-center rounded-full bg-ink text-white">
          <Check className="size-5" aria-hidden />
        </span>
        <h2 className="type-h2 mt-8 text-balance">
          Thank you, {sent.name}. <span className="type-editorial">We&apos;re on it.</span>
        </h2>
        <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted">
          We&apos;ve received your message about <span className="text-ink">{sent.topic.toLowerCase()}</span> and will reply to{" "}
          <span className="text-ink">{sent.email}</span> within one working day.
        </p>
        <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4 border-t border-line pt-6 text-[13px]">
          <div>
            <dt className="text-muted">Reference</dt>
            <dd className="mt-1 font-mono font-medium">{sent.ref}</dd>
          </div>
          <div>
            <dt className="text-muted">Expected reply</dt>
            <dd className="mt-1 font-medium">Within 1 working day</dd>
          </div>
        </dl>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setSent(null);
              setValues(EMPTY);
              setWebsite("");
            }}
          >
            Send another message
          </Button>
          <Button href="/news" variant="ghost" arrow>
            Read the latest news
          </Button>
        </div>
        {user && (
          <p className="mt-8 text-[12px] text-muted">
            You can follow this request in{" "}
            <Link href="/profile" className="text-ink underline underline-offset-4 hover:text-red">
              your profile
            </Link>
            .
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="contact-form-heading">
      <Honeypot value={website} onChange={setWebsite} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="contact-form-heading" className="type-h3">
          Send us a message
        </h2>
        {user && (
          <button type="button" onClick={prefill} className="text-[13px] font-medium text-ink underline underline-offset-4 hover:text-red">
            Use my profile details
          </button>
        )}
      </div>

      {formError && (
        <p role="alert" className="mt-6 border-l-2 border-red bg-red-50 px-3 py-2.5 text-[13.5px] text-red">
          {formError}
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextField
          id="contact-name"
          label="Full name"
          autoComplete="name"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          error={errors.name}
        />
        <TextField
          id="contact-email"
          type="email"
          inputMode="email"
          label="Email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          error={errors.email}
        />
        <TextField
          id="contact-phone"
          type="tel"
          inputMode="tel"
          label="Phone (optional)"
          autoComplete="tel"
          prefix="+91"
          value={values.phone}
          onChange={(e) => set("phone", e.target.value)}
          error={errors.phone}
          hint="Only if you'd prefer a call back"
        />
        <SelectField
          id="contact-topic"
          label="Topic"
          placeholder="Choose a topic"
          options={contactTopics}
          value={values.topic}
          onChange={(e) => set("topic", e.target.value)}
          error={errors.topic}
        />
        <div className="sm:col-span-2">
          <TextArea
            id="contact-message"
            label="Message"
            rows={6}
            placeholder="How can we help?"
            value={values.message}
            onChange={(e) => set("message", e.target.value)}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby="contact-message-msg"
          />
          <p id="contact-message-msg" className={cn("mt-1.5 flex justify-between gap-4 text-xs", errors.message ? "text-red" : "text-muted")}>
            <span>{errors.message ?? "Include a car, listing or story link if it's relevant."}</span>
            <span className="shrink-0 num">{values.message.trim().length}</span>
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-col-reverse gap-5 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-[12px] leading-relaxed text-muted">
          We use your details only to reply. See our{" "}
          <Link href="/privacy" className="text-ink underline underline-offset-4 hover:text-red">
            privacy policy
          </Link>
          .
        </p>
        <Button type="submit" variant="primary" size="lg" arrow={!busy} className="shrink-0" disabled={busy}>
          {busy ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" /> Sending…
            </>
          ) : (
            "Send message"
          )}
        </Button>
      </div>
    </form>
  );
}
