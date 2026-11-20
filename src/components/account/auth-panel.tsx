"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import type { SessionUser, WishlistData } from "@/lib/action-result";
import { wishlistStore } from "@/lib/store";
import { signInAction, signUpAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label, TextField } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { Eyebrow } from "@/components/ui/section-heading";
import { useCity, useUI, useUser } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { Avatar } from "./avatar";
import { StateCityFields } from "./state-city-fields";
import { EMAIL_RE, MOBILE_RE, greetingName } from "./validation";

type Tab = "signin" | "register";
type OnSuccess = (user: SessionUser, wishlist: WishlistData) => void;

/** Only same-origin paths are allowed after sign-in (rejects //evil, /\evil, etc.). */
function safeNext(v: string | null) {
  if (!v) return "/profile";
  try {
    const url = new URL(v, window.location.origin);
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : "/profile";
  } catch {
    return "/profile";
  }
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
    // Keep ?next= so switching tabs doesn't lose where the visitor was heading.
    const query = new URLSearchParams(window.location.search);
    if (t === "register") query.set("mode", "register");
    else query.delete("mode");
    const search = query.toString();
    window.history.replaceState(null, "", search ? `/login?${search}` : "/login");
  };

  const complete = (next: SessionUser, wishlist: WishlistData, isNew: boolean) => {
    setWelcome(next.name);
    login(next, wishlist);
    const first = greetingName(next.name);
    toast(isNew ? `Welcome to March Gear${first ? `, ${first}` : ""}` : `Welcome back${first ? `, ${first}` : ""}`, { tone: "success" });
    router.push(safeNext(params.get("next")));
    router.refresh();
  };

  if (welcome) {
    return (
      <div aria-live="polite" className="py-10">
        <Eyebrow>Signed in</Eyebrow>
        <h1 className="type-h2 mt-5">Welcome{greetingName(welcome) ? `, ${greetingName(welcome)}` : ""}.</h1>
        <p className="mt-4 inline-flex items-center gap-2 text-[15px] text-muted">
          <Loader2 aria-hidden className="size-4 animate-spin text-red" />{" "}
          {safeNext(params.get("next")) === "/profile" ? "Taking you to your profile…" : "Taking you back…"}
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
          onClick={async () => {
            await logout();
            toast("You've been signed out");
            router.refresh();
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
          ? "Sign in to sync your saved cars and track your test-drive and PDI bookings."
          : "One account for your saved cars, enquiries and bookings."}
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
          <EmailSignIn onSuccess={(u, w) => complete(u, w, false)} />
        ) : (
          <Register defaultCity={city.slug} onSuccess={(u, w) => complete(u, w, true)} />
        )}
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
        . Passwords are stored encrypted and we never share your details.
      </p>
    </div>
  );
}

/* ── Sign in ────────────────────────────────────────────────── */

function EmailSignIn({ onSuccess }: { onSuccess: OnSuccess }) {
  const { toast } = useUI();
  const contactEmail = useCatalog().content.site.email;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      email: EMAIL_RE.test(email.trim()) ? undefined : "Enter a valid email address",
      password: password.length >= 8 ? undefined : password ? "Passwords are at least 8 characters" : "Enter your password",
    };
    setErrors(next);
    if (next.email) return document.getElementById("signin-email")?.focus();
    if (next.password) return document.getElementById("signin-password")?.focus();
    setBusy(true);
    setFormError(null);
    try {
      const res = await signInAction({ email: email.trim(), password, wishlist: wishlistStore.get() });
      if (!res.ok) {
        setErrors({ email: res.fieldErrors?.email, password: res.fieldErrors?.password });
        setFormError(res.fieldErrors ? null : (res.error ?? "Couldn't sign you in."));
        setBusy(false);
        return;
      }
      onSuccess(res.user, res.wishlist);
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      {formError && (
        <p role="alert" className="border-l-2 border-red bg-red-50 px-3 py-2.5 text-[13.5px] text-red">
          {formError}
        </p>
      )}
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
              toast(`To reset your password, email ${contactEmail} from this address and we'll help you.`, { tone: "default" });
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

type RegisterErrors = Partial<Record<"name" | "email" | "mobile" | "state" | "city" | "password" | "terms", string>>;

function Register({ defaultCity, onSuccess }: { defaultCity: string; onSuccess: OnSuccess }) {
  const { getCity } = useCatalog();
  const [form, setForm] = useState({ name: "", email: "", mobile: "", password: "" });
  // null until the visitor picks, so they follow the preferred city once the store hydrates.
  const [place, setPlace] = useState<{ state: string | null; city: string | null }>({ state: null, city: null });
  const preferred = getCity(defaultCity);
  const stateValue = place.state ?? preferred.state;
  const cityValue = place.city ?? preferred.name;
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const strength = passwordStrength(form.password);

  const set = (key: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key as keyof RegisterErrors]) setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: RegisterErrors = {
      name: form.name.trim().length >= 2 ? undefined : "Enter your full name",
      email: EMAIL_RE.test(form.email.trim()) ? undefined : "Enter a valid email address",
      mobile: MOBILE_RE.test(form.mobile) ? undefined : "Enter a valid 10-digit mobile number",
      state: stateValue ? undefined : "Choose your state",
      city: cityValue.trim().length >= 2 ? undefined : "Enter your city",
      password: form.password.length < 8 ? "Use at least 8 characters" : strength.score < 2 ? "Add a number, symbol or mixed case" : undefined,
      terms: terms ? undefined : "Please accept the terms to continue",
    };
    setErrors(next);
    const first = (["name", "email", "mobile", "state", "city", "password", "terms"] as const).find((k) => next[k]);
    if (first) {
      document.getElementById(`reg-${first}`)?.focus();
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const res = await signUpAction({
        name: form.name.trim().replace(/\s+/g, " "),
        email: form.email.trim(),
        phone: form.mobile,
        state: stateValue,
        city: cityValue.trim(),
        password: form.password,
        wishlist: wishlistStore.get(),
      });
      if (!res.ok) {
        const f = res.fieldErrors ?? {};
        setErrors({ name: f.name, email: f.email, mobile: f.phone, state: f.state, city: f.city, password: f.password });
        setFormError(res.fieldErrors ? null : (res.error ?? "Couldn't create your account."));
        setBusy(false);
        return;
      }
      onSuccess(res.user, res.wishlist);
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      {formError && (
        <p role="alert" className="border-l-2 border-red bg-red-50 px-3 py-2.5 text-[13.5px] text-red">
          {formError}
        </p>
      )}
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
      <StateCityFields
        idPrefix="reg"
        state={stateValue}
        city={cityValue}
        onState={(v) => {
          setPlace((p) => ({ ...p, state: v }));
          if (errors.state) setErrors((p) => ({ ...p, state: undefined }));
        }}
        onCity={(v) => {
          setPlace((p) => ({ ...p, city: v }));
          if (errors.city) setErrors((p) => ({ ...p, city: undefined }));
        }}
        errors={{ state: errors.state, city: errors.city }}
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
