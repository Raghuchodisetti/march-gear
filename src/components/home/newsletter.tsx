"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { EASE } from "@/lib/motion";
import { subscribeAction } from "@/server/actions/leads";
import { Chip } from "@/components/ui/chip";
import { Honeypot } from "@/components/forms/honeypot";
import { useUI } from "@/components/providers/app-provider";

const TOPICS = ["New launches", "Electric", "Reviews", "Used car deals"];

export function Newsletter() {
  const { toast } = useUI();
  const [email, setEmail] = useState("");
  const [topics, setTopics] = useState<string[]>(["New launches", "Reviews"]);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setError("Please enter a valid email address");
      return;
    }
    setError("");
    // Bots fill the hidden field: pretend it worked and send nothing.
    if (website) return setDone(true);

    const chosen = TOPICS.filter((t) => topics.includes(t));
    setBusy(true);
    try {
      const res = await subscribeAction({ email: value, source: `home${chosen.length ? `: ${chosen.join(", ")}` : ""}`.slice(0, 200) });
      if (!res.ok) {
        setError(res.fieldErrors?.email ?? res.error ?? "We couldn't subscribe you. Please try again.");
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
                  <Check className="size-5" strokeWidth={2.5} />
                </span>
                <div className="min-w-0">
                  <p className="type-h3">You&apos;re on the list.</p>
                  <p className="mt-1 break-words text-[15px] text-muted">
                    The next issue lands in <span className="text-ink">{email.trim()}</span> on Friday morning.
                  </p>
                  <button type="button" onClick={() => { setDone(false); setEmail(""); }} className="mt-4 text-[13px] font-medium underline-offset-4 hover:underline">
                    Use a different email
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={submit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Honeypot value={website} onChange={setWebsite} />
                <p className="max-w-md text-[15px] leading-relaxed text-muted">
                  Launches, first drives, price moves and the occasional long read — curated by our editors, never sponsored.
                </p>
                <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Topics">
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
                    className="h-14 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted/60"
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
                  <p id="newsletter-error" role="alert" className="mt-2 text-[13px] text-red">
                    {error}
                  </p>
                )}
                <p className="mt-4 text-[12px] text-muted">Unsubscribe anytime. We never share your email.</p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
