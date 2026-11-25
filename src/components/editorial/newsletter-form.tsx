"use client";

import { usePathname } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { subscribeAction } from "@/server/actions/leads";
import { Honeypot } from "@/components/forms/honeypot";
import { ConsentCheckbox, PolicyLink, PrivacyLink } from "@/components/forms/consent";
import { LiveRegion } from "@/components/forms/form-a11y";
import { useUI } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Compact newsletter sign-up for "The Weekly Gear".
 * `source` is stored with the subscriber so the team can see where sign-ups come from (defaults to the current page).
 */
export function NewsletterForm({ tone = "dark", className, source }: { tone?: "dark" | "light"; className?: string; source?: string }) {
  const id = useId();
  const pathname = usePathname();
  const { toast } = useUI();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const light = tone === "light";

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const value = email.trim();
    const emailError = !value ? "Enter your email address" : EMAIL_RE.test(value) ? null : "That doesn’t look like a valid email address";
    const optInError = consent ? null : "Tick the box to confirm you’d like the newsletter";
    setError(emailError);
    setConsentError(optInError);
    if (emailError || optInError) {
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    // Bots fill the hidden field: pretend it worked and send nothing.
    if (website) return setDone(value);

    setBusy(true);
    try {
      const res = await subscribeAction({ email: value, consent: true, source: (source ?? `page: ${pathname}`).slice(0, 200) });
      if (!res.ok) {
        if (res.fieldErrors?.consent) setConsentError(res.fieldErrors.consent);
        setError(res.fieldErrors?.email ?? (res.fieldErrors?.consent ? null : (res.error ?? "We couldn’t subscribe you. Please try again.")));
        return;
      }
      setDone(value);
      toast("You’re on The Weekly Gear list", { tone: "success" });
    } catch {
      setError("Couldn’t reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className={cn("flex items-start gap-3", className)} role="status">
        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-red text-white">
          <Check className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className={cn("break-words text-[14px] font-medium", light ? "text-white" : "text-ink")}>Subscribed as {done}</p>
          <p className={cn("mt-1 text-[12.5px]", light ? "text-white/60" : "text-muted")}>
            Changed your mind?{" "}
            <PolicyLink href="/privacy#your-choices" tone={tone}>
              Unsubscribe
            </PolicyLink>
          </p>
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setEmail("");
              setConsent(false);
            }}
            className={cn("mt-1 text-[12.5px] underline-offset-4 hover:underline", light ? "text-white/60" : "text-muted")}
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={className}>
      <Honeypot value={website} onChange={setWebsite} />
      <LiveRegion message={[error, consentError].filter(Boolean).join(" ")} />
      <label htmlFor={`${id}-email`} className="sr-only">
        Email address
      </label>
      <div
        className={cn(
          "flex h-12 items-center border-b transition-colors duration-[250ms] focus-within:border-current",
          light ? "border-white/30 text-white" : "border-ink/20 text-ink",
          error && "border-red focus-within:border-red",
        )}
      >
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          required
          className={cn(
            "h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none focus-visible:outline-none",
            light ? "placeholder:text-white/60" : "placeholder:text-muted",
          )}
        />
        <button
          type="submit"
          aria-label={busy ? "Subscribing" : "Subscribe to the newsletter"}
          disabled={busy}
          className="group/nl inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-[250ms] hover:bg-red hover:text-white disabled:pointer-events-none"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/nl:translate-x-0.5" aria-hidden />
          )}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-xs text-red">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className={cn("mt-2 text-[11.5px]", light ? "text-white/45" : "text-muted")}>
          One email every Friday. Unsubscribe any time.
        </p>
      )}
      <ConsentCheckbox
        id={`${id}-consent`}
        className="mt-3"
        tone={tone}
        checked={consent}
        onChange={(v) => {
          setConsent(v);
          if (consentError) setConsentError(null);
        }}
        error={consentError ?? undefined}
      >
        Email me The Weekly Gear. See the <PrivacyLink tone={tone} />.
      </ConsentCheckbox>
    </form>
  );
}
