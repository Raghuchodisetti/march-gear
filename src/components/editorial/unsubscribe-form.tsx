"use client";

import { useId, useState, type FormEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import { unsubscribeAction } from "@/server/actions/leads";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { LiveRegion } from "@/components/forms/form-a11y";
import { EMAIL_RE } from "./newsletter-form";

/** Withdraw newsletter consent: removes the address from The Weekly Gear list. Same answer whether or not it was on it. */
export function UnsubscribeForm() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError("Enter the email address you subscribed with");
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const res = await unsubscribeAction({ email: value });
      if (!res.ok) {
        setError(res.fieldErrors?.email ?? res.error ?? "We couldn't do that just now. Please try again.");
        return;
      }
      setDone(value);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div role="status" className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-white">
          <Check aria-hidden className="size-3.5" />
        </span>
        <div className="min-w-0 text-[13.5px] leading-relaxed">
          <p className="break-words font-medium text-ink">{done} won&apos;t receive The Weekly Gear any more.</p>
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setEmail("");
            }}
            className="mt-1 text-[12.5px] text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Unsubscribe another address
          </button>
        </div>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <LiveRegion message={error ?? ""} />
      <TextField
        id={`${id}-email`}
        className="min-w-0 flex-1"
        label="Email address"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setError(undefined);
        }}
        error={error}
      />
      <Button type="submit" variant="dark" className="shrink-0 sm:mt-[30px]" disabled={busy} icon={busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : undefined}>
        {busy ? "Unsubscribing…" : "Unsubscribe me"}
      </Button>
    </form>
  );
}
