"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { contactTopics } from "@/data/editorial-company";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useUI, useUser } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";
import { EMAIL_RE } from "./newsletter-form";

type Field = "name" | "email" | "phone" | "topic" | "message";
const MIN_MESSAGE = 20;
const ORDER: Field[] = ["name", "email", "phone", "topic", "message"];

/** Indian mobile: optional +91 / 0 prefix, then 10 digits starting 6–9. */
function validPhone(value: string) {
  const digits = value.replace(/[\s()-]/g, "").replace(/^(\+91|0091|0)/, "");
  return /^[6-9]\d{9}$/.test(digits);
}

/** Event-time only: a short human-readable reference. */
function makeReference() {
  return `MG-${Date.now().toString(36).slice(-6).toUpperCase()}`;
}

export function ContactForm() {
  const { toast } = useUI();
  const { user } = useUser();
  const [values, setValues] = useState<Record<Field, string>>({ name: "", email: "", phone: "", topic: "", message: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [sent, setSent] = useState<{ ref: string; name: string; email: string; topic: string } | null>(null);

  const set = (field: Field, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const prefill = () => {
    if (!user) return;
    setValues((v) => ({ ...v, name: v.name || user.name, email: v.email || user.email, phone: v.phone || user.phone }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<Field, string>> = {};
    if (values.name.trim().length < 2) next.name = "Please tell us your name";
    if (!EMAIL_RE.test(values.email.trim())) next.email = "Enter a valid email address so we can reply";
    if (values.phone.trim() && !validPhone(values.phone)) next.phone = "Enter a 10-digit Indian mobile number, or leave blank";
    if (!values.topic) next.topic = "Choose what your message is about";
    if (values.message.trim().length < MIN_MESSAGE) next.message = `A little more detail helps — at least ${MIN_MESSAGE} characters`;
    setErrors(next);
    const first = ORDER.find((f) => next[f]);
    if (first) {
      document.getElementById(`contact-${first}`)?.focus();
      return;
    }
    const ref = makeReference();
    setSent({
      ref,
      name: values.name.trim().split(" ")[0],
      email: values.email.trim(),
      topic: contactTopics.find((t) => t.value === values.topic)?.label ?? "General",
    });
    toast(`Message sent — reference ${ref}`, { tone: "success" });
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
              setValues({ name: "", email: "", phone: "", topic: "", message: "" });
            }}
          >
            Send another message
          </Button>
          <Button href="/news" variant="ghost" arrow>
            Read the latest news
          </Button>
        </div>
        <p className="mt-8 text-[12px] text-muted">Demo only — no message has been sent.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="contact-form-heading">
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
        <div>
          <SelectField
            id="contact-topic"
            label="Topic"
            placeholder="Choose a topic"
            options={contactTopics}
            value={values.topic}
            onChange={(e) => set("topic", e.target.value)}
            aria-invalid={errors.topic ? true : undefined}
            aria-describedby={errors.topic ? "contact-topic-msg" : undefined}
          />
          {errors.topic && (
            <p id="contact-topic-msg" className="mt-1.5 text-xs text-red">
              {errors.topic}
            </p>
          )}
        </div>
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
        <Button type="submit" variant="primary" size="lg" arrow className="shrink-0">
          Send message
        </Button>
      </div>
    </form>
  );
}
