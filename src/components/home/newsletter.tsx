"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { EASE } from "@/lib/motion";
import { Chip } from "@/components/ui/chip";
import { useUI } from "@/components/providers/app-provider";

const TOPICS = ["New launches", "Electric", "Reviews", "Used car deals"];

export function Newsletter() {
  const { toast } = useUI();
  const [email, setEmail] = useState("");
  const [topics, setTopics] = useState<string[]>(["New launches", "Reviews"]);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }
    setError("");
    setDone(true);
    toast("You're subscribed to The Briefing", { tone: "success" });
  };

  return (
    <section aria-labelledby="newsletter-title" className="border-t border-line py-20 md:py-28">
      <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-end">
        <div>
          <p className="type-eyebrow text-muted">The Briefing · every Friday</p>
          <h2 id="newsletter-title" className="mt-5 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.04em] [font-stretch:110%] md:text-7xl">
            Five minutes.
            <br />
            <span className="type-editorial font-normal">Everything that matters.</span>
          </h2>
        </div>

        <div className="lg:pb-2">
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="flex items-start gap-4">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-red text-white">
                  <Check className="size-5" strokeWidth={2.5} />
                </span>
                <div>
                  <p className="type-h3">You&apos;re on the list.</p>
                  <p className="mt-1 text-[15px] text-muted">
                    The next issue lands in <span className="text-ink">{email}</span> on Friday morning. (Demo — no email will be sent.)
                  </p>
                  <button type="button" onClick={() => { setDone(false); setEmail(""); }} className="mt-4 text-[13px] font-medium underline-offset-4 hover:underline">
                    Use a different email
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={submit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "newsletter-error" : undefined}
                    className="h-14 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted/60"
                  />
                  <button type="submit" className="group inline-flex items-center gap-2 pl-4 text-[15px] font-medium transition-colors hover:text-red">
                    Subscribe
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </button>
                </div>
                {error && (
                  <p id="newsletter-error" className="mt-2 text-[13px] text-red">
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
