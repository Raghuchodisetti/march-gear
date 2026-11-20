"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Checkbox, focusFirstError } from "@/components/portal/register/controls";
import { insurerRegisterAccountAction } from "@/server/actions/insurer-auth";

const omit = (o: Record<string, string>, key: string) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key));

/** Before step 1: the vendor login, the draft application and the owner membership. */
export function InsAccountForm() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", mobile: "", password: "" });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((prev) => omit(prev, k));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await insurerRegisterAccountAction({ ...form, acceptTerms });
      if (!res.ok) {
        const fe = res.fieldErrors ?? {};
        setErrors(fe);
        setError(Object.keys(fe).length ? null : (res.error ?? "We couldn't create your account."));
        focusFirstError();
        return;
      }
      router.push(res.next);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && (
        <p role="alert" className="border-l-2 border-red bg-red-50 px-3 py-2.5 text-[13.5px] text-red">
          {error}
        </p>
      )}
      <TextField label="Your full name" autoComplete="name" value={form.fullName} onChange={set("fullName")} error={errors.fullName} placeholder="As on your PAN card" />
      <TextField label="Work email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} placeholder="you@yourcompany.in" hint="You'll sign in with this email. Use your company domain." />
      <TextField label="Mobile number" type="tel" inputMode="numeric" autoComplete="tel-national" prefix="+91" value={form.mobile} onChange={set("mobile")} error={errors.mobile} placeholder="98480 12345" />
      <div className="relative">
        <TextField label="Create a password" type={show ? "text" : "password"} autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} hint="At least 8 characters." />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-[34px] inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-mist hover:text-ink"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <Checkbox
        checked={acceptTerms}
        onChange={(v) => {
          setAcceptTerms(v);
          if (errors.acceptTerms) setErrors((prev) => omit(prev, "acceptTerms"));
        }}
        error={errors.acceptTerms}
        label={
          <>
            I agree to MarchGear&apos;s{" "}
            <Link href="/terms" target="_blank" className="font-medium underline underline-offset-4 hover:text-red">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="font-medium underline underline-offset-4 hover:text-red">
              privacy policy
            </Link>
          </>
        }
      />
      <Button type="submit" className="w-full" size="lg" disabled={pending} arrow={!pending} icon={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
        {pending ? "Creating your account…" : "Create account & start application"}
      </Button>
      <p className="text-center text-[12.5px] text-muted">Your progress is saved automatically — stop and come back any time.</p>
    </form>
  );
}
