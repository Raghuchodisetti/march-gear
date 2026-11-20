"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, Send, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { TextField } from "@/components/ui/field";
import { PATTERNS } from "@/partner/application";
import { normaliseMobile } from "@/partner/schemas";
import { sendApplicationOtpAction, verifyApplicationOtpAction } from "@/server/actions/partner-application";
import { Note } from "./controls";

/* ──────────────────────────────────────────────────────────────
   A mobile number / email with one-time-code verification.
   Codes are real (generated, hashed and checked on the server).
   No SMS or email provider is configured, so in development the
   code is shown on screen, clearly labelled; in production the
   field says so and the team verifies the number during review.
   ────────────────────────────────────────────────────────────── */

type Sent = { target: string; devCode?: string; resendAt: number; expiresAt: number };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const fmtMobile = (v: string) => `+91 ${v.slice(0, 5)} ${v.slice(5)}`;

export function VerifyField({
  channel,
  label,
  value,
  verified,
  onChange,
  onVerified,
  error,
  mode,
  required = true,
}: {
  channel: "mobile" | "email";
  label: string;
  value: string;
  verified: boolean;
  onChange: (v: string) => void;
  onVerified: (target: string) => void;
  error?: string;
  mode: "screen" | "none";
  required?: boolean;
}) {
  const [sent, setSent] = useState<Sent | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const target = channel === "mobile" ? normaliseMobile(value) : value.trim().toLowerCase();
  const valid = channel === "mobile" ? PATTERNS.mobile.test(target) : EMAIL.test(target);
  const active = sent && sent.target === target ? sent : null;

  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [active]);

  const wait = active && now ? Math.max(0, Math.ceil((active.resendAt - now) / 1000)) : 0;
  const expired = Boolean(active && now && now >= active.expiresAt);

  const send = async () => {
    setBusy("send");
    setProblem(null);
    try {
      const res = await sendApplicationOtpAction({ channel, target: value });
      if (!res.ok) {
        setProblem(res.error ?? "Couldn't send a code.");
        return;
      }
      setSent({ target: res.target, devCode: res.devCode, resendAt: Date.parse(res.resendAt), expiresAt: Date.parse(res.expiresAt) });
      setCode("");
    } catch {
      setProblem("Couldn't reach the server. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setProblem("Enter the 6-digit code");
      return;
    }
    setBusy("verify");
    setProblem(null);
    try {
      const res = await verifyApplicationOtpAction({ channel, code });
      if (!res.ok) {
        setProblem(res.fieldErrors?.code ?? res.error ?? "That code didn't work.");
        return;
      }
      setSent(null);
      setCode("");
      onVerified(res.target);
    } catch {
      setProblem("Couldn't reach the server. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const noun = channel === "mobile" ? "number" : "email";
  return (
    <div>
      <div className="flex items-start gap-2">
        <TextField
          className="min-w-0 flex-1"
          label={label}
          type={channel === "mobile" ? "tel" : "email"}
          inputMode={channel === "mobile" ? "numeric" : "email"}
          autoComplete={channel === "mobile" ? "tel-national" : "email"}
          prefix={channel === "mobile" ? "+91" : undefined}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setProblem(null);
          }}
          error={error}
          placeholder={channel === "mobile" ? "98480 12345" : "you@yourdealership.in"}
        />
        <div className="pt-[28px]">
          {verified ? (
            <span className="inline-flex h-12 items-center gap-1.5 whitespace-nowrap rounded-[3px] bg-[#e8f5ec] px-3 text-[13px] font-semibold text-[#1e7a3c]">
              <BadgeCheck aria-hidden className="size-4" /> Verified
            </span>
          ) : mode === "screen" ? (
            <button
              type="button"
              onClick={() => void send()}
              disabled={!valid || busy !== null || wait > 0}
              className="inline-flex h-12 items-center gap-1.5 whitespace-nowrap rounded-[3px] border border-ink/15 bg-white px-3.5 text-[13px] font-medium transition-colors duration-300 hover:border-ink disabled:cursor-not-allowed disabled:opacity-45 sm:px-4"
            >
              {busy === "send" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
              {active ? (wait > 0 ? `Resend ${wait}s` : "Resend") : "Send code"}
            </button>
          ) : null}
        </div>
      </div>

      {!verified && mode === "none" && channel === "mobile" && (
        <Note tone="info" className="mt-3">
          SMS isn&apos;t set up yet — your number will be verified by our team during review. You can continue without a code.
        </Note>
      )}
      {!verified && mode === "none" && channel === "email" && <p className="mt-1.5 text-xs text-muted">Email delivery isn&apos;t set up yet — our team will confirm this address during review.</p>}

      {!verified && mode === "screen" && !active && !problem && (
        <p className="mt-1.5 text-xs text-muted">
          {required ? `Verify your ${noun} with a one-time code to continue.` : `Optional — verify this ${noun} with a one-time code.`}
        </p>
      )}

      {!verified && active && (
        <div className="mt-3 animate-rise space-y-3 border border-line bg-[#FAFAFA] p-4">
          {active.devCode && (
            <div className="flex flex-col gap-2 border border-dashed border-ink/30 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Development code</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                  {channel === "mobile" ? "SMS" : "Email"} delivery isn&apos;t configured on this server, so the code for {channel === "mobile" ? fmtMobile(active.target) : active.target} is shown here instead of being sent.
                </p>
              </div>
              <p className="shrink-0 font-mono text-[22px] font-semibold tracking-[0.28em] text-ink" data-testid={`dev-code-${channel}`}>
                {active.devCode}
              </p>
            </div>
          )}
          <div className="flex items-start gap-2">
            <TextField
              className="min-w-0 flex-1"
              label="Enter the 6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setProblem(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void verify();
                }
              }}
              error={problem ?? undefined}
              placeholder="••••••"
            />
            <div className="pt-[28px]">
              <button
                type="button"
                onClick={() => void verify()}
                disabled={busy !== null || code.length !== 6}
                className="inline-flex h-12 items-center gap-1.5 whitespace-nowrap rounded-[3px] bg-ink px-4 text-[13px] font-medium text-white transition-colors duration-300 hover:bg-ink-3 disabled:opacity-40"
              >
                {busy === "verify" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ShieldCheck aria-hidden className="size-4" />}
                Verify
              </button>
            </div>
          </div>
          <p className={cn("text-[12px]", expired ? "text-red" : "text-muted")}>
            {expired ? "This code has expired — request a new one." : "The code is valid for 10 minutes. You have 5 attempts."}
          </p>
        </div>
      )}

      {problem && !active && <p className="mt-1.5 text-xs text-red">{problem}</p>}
    </div>
  );
}
