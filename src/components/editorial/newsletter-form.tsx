"use client";

import { useId, useState, type FormEvent } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useUI } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Compact newsletter sign-up for "The Weekly Gear". */
export function NewsletterForm({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  const id = useId();
  const { toast } = useUI();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const light = tone === "light";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return setError("Enter your email address");
    if (!EMAIL_RE.test(value)) return setError("That doesn’t look like a valid email address");
    setError(null);
    setDone(value);
    toast("You’re on the list — the next Weekly Gear arrives Friday", { tone: "success" });
  };

  if (done) {
    return (
      <div className={cn("flex items-start gap-3", className)} role="status">
        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-red text-white">
          <Check className="size-3.5" aria-hidden />
        </span>
        <div>
          <p className={cn("text-[14px] font-medium", light ? "text-white" : "text-ink")}>Subscribed as {done}</p>
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
          aria-label="Subscribe"
          className="group/nl inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-[250ms] hover:bg-red hover:text-white"
        >
          <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/nl:translate-x-0.5" aria-hidden />
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
    </form>
  );
}
