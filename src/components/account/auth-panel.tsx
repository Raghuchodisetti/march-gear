"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type SVGProps } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { cities, getCity } from "@/data/cities";
import type { MockUser } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label, Segmented, SelectField, TextField } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { Eyebrow } from "@/components/ui/section-heading";
import { useCity, useUI, useUser } from "@/components/providers/app-provider";
import { OtpInput } from "./otp-input";
import { Avatar } from "./avatar";
import { DEFAULT_MEMBER_NAME, EMAIL_RE, MOBILE_RE, greetingName, prettyMobile } from "./validation";

type Tab = "signin" | "register";

const MEMBER_SINCE = "Nov 2026";

/** "aarav.mehta@…" → "Aarav Mehta" */
function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  const words = local.split(/[._-]+/).filter((w) => /[a-z]/i.test(w));
  if (words.length === 0) return DEFAULT_MEMBER_NAME;
  return words
    .slice(0, 2)
    .map((w) => w.replace(/\d+/g, ""))
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Simulated network latency, cancelled if the component unmounts. */
function useDelay() {
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);
  return (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
}

export function AuthPanel() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, login, logout } = useUser();
  const { toast } = useUI();
  const { city } = useCity();

  const modeParam: Tab = params.get("mode") === "register" ? "register" : "signin";
  const [tab, setTab] = useState<Tab>(modeParam);
  // Follow ?mode when it changes underneath us (e.g. header "Register" link while on /login).
  const [syncedParam, setSyncedParam] = useState<Tab>(modeParam);
  if (syncedParam !== modeParam) {
    setSyncedParam(modeParam);
    setTab(modeParam);
  }
  const [welcome, setWelcome] = useState<string | null>(null);

  const switchTab = (next: string) => {
    const t: Tab = next === "register" ? "register" : "signin";
    setTab(t);
    window.history.replaceState(null, "", t === "register" ? "/login?mode=register" : "/login");
  };

  const complete = (next: MockUser, isNew: boolean) => {
    setWelcome(next.name);
    login(next);
    const first = greetingName(next.name);
    toast(isNew ? `Welcome to March Gear${first ? `, ${first}` : ""}` : `Welcome back${first ? `, ${first}` : ""}`, { tone: "success" });
    router.push("/profile");
  };

  if (welcome) {
    return (
      <div aria-live="polite" className="py-10">
        <Eyebrow>Signed in</Eyebrow>
        <h1 className="type-h2 mt-5">Welcome{greetingName(welcome) ? `, ${greetingName(welcome)}` : ""}.</h1>
        <p className="mt-4 inline-flex items-center gap-2 text-[15px] text-muted">
          <Loader2 aria-hidden className="size-4 animate-spin text-red" /> Taking you to your profile…
        </p>
      </div>
    );
  }

  if (user) {
    return (
      <div>
        <Eyebrow>Members</Eyebrow>
        <h1 className="type-h2 mt-5 text-balance">
          You&apos;re signed in as <span className="type-editorial">{greetingName(user.name) ?? (user.phone || user.name)}</span>.
        </h1>
        <div className="mt-10 flex items-center gap-4 border-y border-line py-5">
          <Avatar name={user.name} className="size-14 text-lg" />
          <div className="min-w-0">
            <p className="type-h4 truncate">{user.name}</p>
            <p className="truncate text-[13px] text-muted">{user.email || user.phone}</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button href="/profile" variant="dark" arrow>
            Go to profile
          </Button>
          <Button href="/wishlist" variant="outline">
            Saved cars
          </Button>
        </div>
        <button
          type="button"
          onClick={() => {
            logout();
            toast("You've been signed out");
          }}
          className="mt-6 text-[13px] text-muted underline-offset-4 transition-colors hover:text-red hover:underline"
        >
          Not you? Sign out
        </button>
      </div>
    );
  }

  return (
    <div>
      <Eyebrow>Members</Eyebrow>
      <h1 className="type-h2 mt-5 text-balance">
        {tab === "signin" ? (
          <>
            Welcome <span className="type-editorial">back.</span>
          </>
        ) : (
          <>
            Join <span className="type-editorial">March Gear.</span>
          </>
        )}
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        {tab === "signin"
          ? "Sign in to sync your saved cars, comparisons and test-drive bookings."
          : "One account for your shortlist, price alerts, bookings and offers."}
      </p>

      <Tabs
        className="mt-10"
        ariaLabel="Sign in or create an account"
        items={[
          { value: "signin", label: "Sign in" },
          { value: "register", label: "Create account" },
        ]}
        value={tab}
        onChange={switchTab}
      />

      <div role="tabpanel" aria-label={tab === "signin" ? "Sign in" : "Create account"} className="pt-8">
        {tab === "signin" ? (
          <SignIn cityName={city.name} onSuccess={(u) => complete(u, false)} />
        ) : (
          <Register defaultCity={city.slug} onSuccess={(u) => complete(u, true)} />
        )}
      </div>

      <div className="mt-10">
        <div className="flex items-center gap-4 text-[12px] text-muted">
          <span aria-hidden className="h-px flex-1 bg-line" />
          or continue with
          <span aria-hidden className="h-px flex-1 bg-line" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            { label: "Google", Icon: GoogleGlyph },
            { label: "Apple", Icon: AppleGlyph },
          ].map(({ label, Icon }) => (
            <Button key={label} variant="outline" icon={<Icon className="size-4" />} onClick={() => toast("Social sign-in is disabled in this demo")}>
              {label}
            </Button>
          ))}
        </div>
      </div>

      <p className="mt-10 text-[12px] leading-relaxed text-muted">
        By continuing you agree to our{" "}
        <Link href="/terms" className="text-ink underline underline-offset-4 hover:text-red">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-ink underline underline-offset-4 hover:text-red">
          Privacy Policy
        </Link>
        . This is a demo — no account or message is actually created or sent.
      </p>
    </div>
  );
}

/* ── Sign in ────────────────────────────────────────────────── */

function SignIn({ cityName, onSuccess }: { cityName: string; onSuccess: (user: MockUser) => void }) {
  const [method, setMethod] = useState<"otp" | "email">("otp");
  return (
    <div>
      <Segmented
        ariaLabel="Sign-in method"
        className="flex w-full"
        options={[
          { value: "otp", label: "Mobile OTP" },
          { value: "email", label: "Email" },
        ]}
        value={method}
        onChange={setMethod}
      />
      <div className="mt-8">{method === "otp" ? <OtpSignIn cityName={cityName} onSuccess={onSuccess} /> : <EmailSignIn cityName={cityName} onSuccess={onSuccess} />}</div>
    </div>
  );
}

function OtpSignIn({ cityName, onSuccess }: { cityName: string; onSuccess: (user: MockUser) => void }) {
  const { toast } = useUI();
  const delay = useDelay();
  const hintId = useId();
  const [step, setStep] = useState<"mobile" | "code">("mobile");
  const [mobile, setMobile] = useState("");
  const [mobileError, setMobileError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [codeError, setCodeError] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (step !== "code" || resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [step, resendIn]);

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    if (!MOBILE_RE.test(mobile)) {
      setMobileError(mobile.length === 10 ? "Indian mobile numbers start with 6, 7, 8 or 9" : "Enter a valid 10-digit mobile number");
      return;
    }
    setMobileError(undefined);
    setSending(true);
    delay(() => {
      setSending(false);
      setStep("code");
      setCode(Array(6).fill(""));
      setResendIn(30);
      toast(`Code sent to ${prettyMobile(mobile)}`, { tone: "success" });
    }, 800);
  };

  const verify = (digits = code.join("")) => {
    if (!/^\d{6}$/.test(digits)) {
      setCodeError("Enter all six digits");
      return;
    }
    setCodeError(undefined);
    setVerifying(true);
    delay(() => onSuccess({ name: DEFAULT_MEMBER_NAME, email: "", phone: prettyMobile(mobile), city: cityName, memberSince: MEMBER_SINCE }), 600);
  };

  if (step === "code") {
    return (
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
      >
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[14px] text-muted">
            Code sent to <span className="font-medium text-ink num">{prettyMobile(mobile)}</span>
          </p>
          <button type="button" onClick={() => setStep("mobile")} className="shrink-0 text-[13px] font-medium underline-offset-4 hover:underline">
            Change
          </button>
        </div>
        <div className="mt-5">
          <OtpInput
            value={code}
            onChange={(next) => {
              setCode(next);
              if (codeError) setCodeError(undefined);
            }}
            onComplete={(c) => verify(c)}
            disabled={verifying}
            invalid={Boolean(codeError)}
            describedBy={hintId}
          />
        </div>
        <p id={hintId} className={cn("mt-3 text-[12px]", codeError ? "text-red" : "text-muted")}>
          {codeError ?? "Demo: any six digits will work."}
        </p>
        <Button type="submit" variant="dark" size="lg" className="mt-6 w-full" disabled={verifying}>
          {verifying ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" /> Verifying…
            </>
          ) : (
            "Verify and sign in"
          )}
        </Button>
        <p className="mt-5 text-center text-[13px] text-muted num">
          {resendIn > 0 ? (
            `Resend code in 0:${String(resendIn).padStart(2, "0")}`
          ) : (
            <button
              type="button"
              onClick={() => {
                setResendIn(30);
                setCode(Array(6).fill(""));
                toast("A new code is on its way");
              }}
              className="font-medium text-ink underline-offset-4 hover:underline"
            >
              Resend code
            </button>
          )}
        </p>
      </form>
    );
  }

  return (
    <form noValidate onSubmit={send}>
      <TextField
        label="Mobile number"
        prefix="+91"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="98765 43210"
        maxLength={10}
        value={mobile}
        error={mobileError}
        hint="We'll text you a six-digit code."
        onChange={(e) => {
          setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
          if (mobileError) setMobileError(undefined);
        }}
      />
      <Button type="submit" variant="dark" size="lg" className="mt-6 w-full" disabled={sending}>
        {sending ? (
          <>
            <Loader2 aria-hidden className="size-4 animate-spin" /> Sending code…
          </>
        ) : (
          "Send OTP"
        )}
      </Button>
    </form>
  );
}

function EmailSignIn({ cityName, onSuccess }: { cityName: string; onSuccess: (user: MockUser) => void }) {
  const { toast } = useUI();
  const delay = useDelay();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = {
      email: EMAIL_RE.test(email.trim()) ? undefined : "Enter a valid email address",
      password: password.length >= 8 ? undefined : password ? "Passwords are at least 8 characters" : "Enter your password",
    };
    setErrors(next);
    if (next.email) return document.getElementById("signin-email")?.focus();
    if (next.password) return document.getElementById("signin-password")?.focus();
    setBusy(true);
    delay(() => onSuccess({ name: nameFromEmail(email.trim()), email: email.trim(), phone: "", city: cityName, memberSince: MEMBER_SINCE }), 700);
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      <TextField
        id="signin-email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        error={errors.email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
        }}
      />
      <PasswordField
        id="signin-password"
        label="Password"
        autoComplete="current-password"
        value={password}
        error={errors.password}
        onChange={(v) => {
          setPassword(v);
          if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
        }}
        aside={
          <button
            type="button"
            onClick={() => {
              if (!EMAIL_RE.test(email.trim())) {
                setErrors((p) => ({ ...p, email: "Enter your email to reset your password" }));
                document.getElementById("signin-email")?.focus();
                return;
              }
              toast(`Reset link sent to ${email.trim()} (demo)`, { tone: "success" });
            }}
            className="text-[12.5px] text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Forgot password?
          </button>
        }
      />
      <Button type="submit" variant="dark" size="lg" className="w-full" disabled={busy}>
        {busy ? (
          <>
            <Loader2 aria-hidden className="size-4 animate-spin" /> Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}

/* ── Register ───────────────────────────────────────────────── */

type RegisterErrors = Partial<Record<"name" | "email" | "mobile" | "password" | "terms", string>>;

function Register({ defaultCity, onSuccess }: { defaultCity: string; onSuccess: (user: MockUser) => void }) {
  const delay = useDelay();
  const [form, setForm] = useState({ name: "", email: "", mobile: "", city: "", password: "" });
  // Empty until chosen, so it tracks the visitor's preferred city once the store hydrates.
  const citySlug = form.city || defaultCity;
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(form.password);

  const set = (key: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key as keyof RegisterErrors]) setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: RegisterErrors = {
      name: form.name.trim().length >= 2 ? undefined : "Enter your full name",
      email: EMAIL_RE.test(form.email.trim()) ? undefined : "Enter a valid email address",
      mobile: MOBILE_RE.test(form.mobile) ? undefined : "Enter a valid 10-digit mobile number",
      password: form.password.length < 8 ? "Use at least 8 characters" : strength.score < 2 ? "Add a number, symbol or mixed case" : undefined,
      terms: terms ? undefined : "Please accept the terms to continue",
    };
    setErrors(next);
    const first = (["name", "email", "mobile", "password", "terms"] as const).find((k) => next[k]);
    if (first) {
      document.getElementById(`reg-${first}`)?.focus();
      return;
    }
    setBusy(true);
    delay(
      () =>
        onSuccess({
          name: form.name.trim().replace(/\s+/g, " "),
          email: form.email.trim(),
          phone: prettyMobile(form.mobile),
          city: getCity(citySlug).name,
          memberSince: MEMBER_SINCE,
        }),
      800,
    );
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      <TextField id="reg-name" label="Full name" autoComplete="name" value={form.name} error={errors.name} onChange={(e) => set("name", e.target.value)} />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextField
          id="reg-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          error={errors.email}
          onChange={(e) => set("email", e.target.value)}
        />
        <TextField
          id="reg-mobile"
          label="Mobile"
          prefix="+91"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          value={form.mobile}
          error={errors.mobile}
          onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
        />
      </div>
      <SelectField
        label="City"
        options={cities.map((c) => ({ value: c.slug, label: c.name }))}
        value={citySlug}
        onChange={(e) => set("city", e.target.value)}
      />
      <div>
        <PasswordField
          id="reg-password"
          label="Password"
          autoComplete="new-password"
          value={form.password}
          error={errors.password}
          onChange={(v) => set("password", v)}
        />
        <StrengthMeter strength={strength} empty={form.password.length === 0} />
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-[13.5px] leading-relaxed text-muted">
          <input
            id="reg-terms"
            type="checkbox"
            checked={terms}
            aria-invalid={errors.terms ? true : undefined}
            aria-describedby={errors.terms ? "reg-terms-msg" : undefined}
            onChange={(e) => {
              setTerms(e.target.checked);
              if (errors.terms) setErrors((p) => ({ ...p, terms: undefined }));
            }}
            className="mt-[3px] size-4 shrink-0 cursor-pointer accent-ink"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="text-ink underline underline-offset-4 hover:text-red">
              Terms of use
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-ink underline underline-offset-4 hover:text-red">
              Privacy Policy
            </Link>
            , and to be contacted about my enquiries.
          </span>
        </label>
        {errors.terms && (
          <p id="reg-terms-msg" className="mt-1.5 pl-7 text-xs text-red">
            {errors.terms}
          </p>
        )}
      </div>

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
        {busy ? (
          <>
            <Loader2 aria-hidden className="size-4 animate-spin" /> Creating your account…
          </>
        ) : (
          "Create account"
        )}
      </Button>
    </form>
  );
}

function passwordStrength(pw: string) {
  const checks = [pw.length >= 8, /[a-z]/.test(pw) && /[A-Z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw)];
  let score = checks.filter(Boolean).length;
  if (pw.length < 8) score = Math.min(score, 1);
  if (pw.length >= 12 && score === 3) score = 4;
  return { score, label: ["Too short", "Weak", "Fair", "Good", "Strong"][score] };
}

function StrengthMeter({ strength, empty }: { strength: { score: number; label: string }; empty: boolean }) {
  const weak = strength.score <= 1;
  return (
    <div className="mt-3" aria-live="polite">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "h-[3px] rounded-full transition-colors duration-[400ms]",
              !empty && i <= Math.max(1, strength.score) ? (weak ? "bg-red" : "bg-ink") : "bg-line",
            )}
          />
        ))}
      </div>
      <p className="mt-2 flex justify-between gap-4 text-[12px] text-muted">
        <span>
          Strength: <span className="font-medium text-ink">{empty ? "—" : strength.label}</span>
        </span>
        <span className="text-right">8+ characters · mix case, numbers, symbols</span>
      </p>
    </div>
  );
}

/* ── Fields & glyphs ────────────────────────────────────────── */

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  aside,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: string;
  aside?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-msg` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full rounded-[3px] border border-line bg-white pl-4 pr-12 text-[15px] text-ink outline-none transition-[border-color] duration-[250ms] hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-1 my-auto inline-flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
      {error && (
        <p id={`${id}-msg`} className="mt-1.5 text-xs text-red">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  );
}

function AppleGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}
