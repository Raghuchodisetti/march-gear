"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Note } from "@/components/portal/register/controls";
import { insurerSignInAction } from "@/server/actions/insurer-auth";

/** Only same-origin /insurance-vendor paths are allowed after sign-in. */
function safeNext(v: string | null, fallback: string) {
  if (!v) return fallback;
  try {
    const url = new URL(v, window.location.origin);
    const ok = url.origin === window.location.origin && (url.pathname === "/insurance-vendor" || url.pathname.startsWith("/insurance-vendor/")) && !url.pathname.startsWith("/insurance-vendor/login");
    return ok ? `${url.pathname}${url.search}` : fallback;
  } catch {
    return fallback;
  }
}

export function InsLoginForm({ supportEmail }: { supportEmail: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [forgot, setForgot] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await insurerSignInAction({ email, password });
      if (!res.ok) {
        setFieldErrors(res.fieldErrors ?? {});
        setError(res.fieldErrors ? null : (res.error ?? "Couldn't sign in."));
        return;
      }
      router.replace(safeNext(params.get("next"), res.next));
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-8 space-y-4">
      {error && (
        <p role="alert" className="border-l-2 border-red bg-red-50 px-3 py-2.5 text-[13.5px] text-red">
          {error}
        </p>
      )}
      <TextField
        label="Work email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setFieldErrors((f) => ({ ...f, email: "" }));
        }}
        error={fieldErrors.email || undefined}
        autoFocus
      />
      <div>
        <div className="relative">
          <TextField
            label="Password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((f) => ({ ...f, password: "" }));
            }}
            error={fieldErrors.password || undefined}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-[34px] inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-mist hover:text-ink"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={() => setForgot((f) => !f)} aria-expanded={forgot} className="text-[12.5px] text-muted underline-offset-4 transition-colors hover:text-ink hover:underline">
            Forgot password?
          </button>
        </div>
      </div>
      {forgot && (
        <Note tone="info" title="Resetting your password" className="animate-rise">
          <p>Password reset by email isn&apos;t set up yet, so we can&apos;t send you a link.</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>Team members: ask your company&apos;s owner or an administrator to reset it under Settings → Team. You&apos;ll get a new temporary password.</li>
            <li>
              Owners: email{" "}
              {supportEmail ? (
                <a href={`mailto:${supportEmail}?subject=${encodeURIComponent("Insurance vendor portal — password reset")}`} className="font-medium underline underline-offset-4">
                  {supportEmail}
                </a>
              ) : (
                "MarchGear support"
              )}{" "}
              from your registered address and our vendor team will help you back in.
            </li>
          </ul>
        </Note>
      )}
      <Button type="submit" className="w-full" disabled={pending} icon={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogIn className="size-4" aria-hidden />}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
