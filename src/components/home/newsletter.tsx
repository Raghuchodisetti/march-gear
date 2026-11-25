"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { EASE } from "@/lib/motion";
import { subscribeAction } from "@/server/actions/leads";
import { Chip } from "@/components/ui/chip";
import { Honeypot } from "@/components/forms/honeypot";
import { ConsentCheckbox, PolicyLink, PrivacyLink } from "@/components/forms/consent";
import { LiveRegion } from "@/components/forms/form-a11y";
import { useUI } from "@/components/providers/app-provider";

const TOPICS = ["New launches", "Electric", "Reviews", "Used car deals"];

export function Newsletter() {
  const { toast } = useUI();
  const [email, setEmail] = useState("");
  const [topics, setTopics] = useState<string[]>(["New launches", "Reviews"]);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const value = email.trim();
    const emailError = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? "" : "Please enter a valid email address";
    const optInError = consent ? "" : "Tick the box to confirm you'd like the newsletter";
    setError(emailError);
    setConsentError(optInError);
    if (emailError || optInError) {
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    // Bots fill the hidden field: pretend it worked and send nothing.
    if (website) return setDone(true);

    const chosen = TOPICS.filter((t) => topics.includes(t));
    setBusy(true);
    try {
      const res = await subscribeAction({ email: value, consent: true, source: `home${chosen.length ? `: ${chosen.join(", ")}` : ""}`.slice(0, 200) });
      if (!res.ok) {
        if (res.fieldErrors?.consent) setConsentError(res.fieldErrors.consent);
        setError(res.fieldErrors?.email ?? (res.fieldErrors?.consent ? "" : (res.error ?? "We couldn't subscribe you. Please try again.")));
        return;
      }
      setDone(true);
      toast("You're subscribed to The Weekly Gear", { tone: "success" });
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="newsletter-title" className="border-t border-line py-14 md:py-20">
      <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-end">
        <div>
          <p className="type-eyebrow text-muted">The Weekly Gear · every Friday</p>
          <h2 id="newsletter-title" className="mt-5 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.04em] [font-stretch:110%] md:text-7xl">
            Five minutes.
            <br />
            <span className="type-editorial font-normal">Everything that matters.</span>
          </h2>
        </div>

        <div className="lg:pb-2">
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.div key="done" role="status" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="flex items-start gap-4">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-red text-white">
                  <Check className="size-5" strokeWidth={2.5} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="type-h3">You&apos;re on the list.</p>
                  <p className="mt-1 break-words text-[15px] text-muted">
                    We&apos;ve added <span className="text-ink">{email.trim()}</span> to The Weekly Gear. Change your mind?{" "}
                    <PolicyLink href="/privacy#your-choices">Unsubscribe here</PolicyLink>.
                  </p>
                  <button type="button" onClick={() => { setDone(false); setEmail(""); setConsent(false); }} className="mt-4 text-[13px] font-medium underline-offset-4 hover:underline">
                    Use a different email
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={submit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Honeypot value={website} onChange={setWebsite} />
                <LiveRegion message={[error, consentError].filter(Boolean).join(" ")} />
                <p className="max-w-md text-[15px] leading-relaxed text-muted">
                  Launches, first drives, price moves and the occasional long read — curated by our editors, never sponsored.
                </p>
                <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Topics you'd like to hear about">
                  {TOPICS.map((t) => (
                    <Chip key={t} showCheck selected={topics.includes(t)} onClick={() => setTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}>
                      {t}
                    </Chip>
                  ))}
                </div>
                <div className="mt-6 flex border-b-2 border-ink focus-within:border-red">
                  <label htmlFor="newsletter-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="newsletter-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "newsletter-error" : undefined}
                    required
                    className="h-14 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="group inline-flex items-center gap-2 pl-4 text-[15px] font-medium transition-colors hover:text-red disabled:pointer-events-none disabled:opacity-60"
                  >
                    {busy ? "Subscribing…" : "Subscribe"}
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    )}
                  </button>
                </div>
                {error && (
                  <p id="newsletter-error" className="mt-2 text-[13px] text-red">
                    {error}
                  </p>
                )}
                <ConsentCheckbox
                  id="newsletter-consent"
                  className="mt-5"
                  checked={consent}
                  onChange={(v) => {
                    setConsent(v);
                    if (consentError) setConsentError("");
                  }}
                  error={consentError}
                >
                  Yes, email me The Weekly Gear newsletter. I can unsubscribe at any time. We never sell or share your email — see the <PrivacyLink />.
                </ConsentCheckbox>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
