"use client";

import { usePathname } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { subscribeAction } from "@/server/actions/leads";
import { Honeypot } from "@/components/forms/honeypot";
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
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const light = tone === "light";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const value = email.trim();
    if (!value) return setError("Enter your email address");
    if (!EMAIL_RE.test(value)) return setError("That doesn’t look like a valid email address");
    setError(null);
    // Bots fill the hidden field: pretend it worked and send nothing.
    if (website) return setDone(value);

    setBusy(true);
    try {
      const res = await subscribeAction({ email: value, source: (source ?? `page: ${pathname}`).slice(0, 200) });
      if (!res.ok) {
        setError(res.fieldErrors?.email ?? res.error ?? "We couldn’t subscribe you. Please try again.");
        return;
      }
      setDone(value);
      toast("You’re on the list — the next Weekly Gear arrives Friday", { tone: "success" });
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
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setEmail("");
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
          className={cn(
            "h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none focus-visible:outline-none",
            light ? "placeholder:text-white/40" : "placeholder:text-muted/70",
          )}
        />
        <button
          type="submit"
          aria-label={busy ? "Subscribing" : "Subscribe"}
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
        <p id={`${id}-error`} role="alert" className="mt-2 text-xs text-red">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className={cn("mt-2 text-[11.5px]", light ? "text-white/45" : "text-muted")}>
          One email every Friday. Unsubscribe any time.
        </p>
      )}
    </form>
  );
}
