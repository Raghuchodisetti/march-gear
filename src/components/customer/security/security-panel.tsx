"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Laptop, Loader2, LogOut, ShieldAlert, Smartphone } from "lucide-react";
import { userStore, wishlistStore } from "@/lib/store";
import { changePasswordAction } from "@/server/actions/auth";
import { revokeCustomerSessionAction, signOutEverywhereAction, signOutOtherDevicesAction } from "@/server/actions/customer-account";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/portal/ui";
import { ConfirmDialog, FieldError, FormSection, inputCls, useAction } from "@/components/portal/profile/kit";
import { MIN_PASSWORD } from "@/components/account/validation";

export interface SessionRow {
  key: string;
  device: string;
  mobile: boolean;
  ip: string | null;
  started: string;
  expires: string;
  current: boolean;
}

type PwField = "current" | "next" | "confirm";

/** Change password. The server signs out every other device and keeps this one signed in. */
export function PasswordCard({ email }: { email: string }) {
  const router = useRouter();
  const [pw, setPw] = useState<Record<PwField, string>>({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, errors, setErrors, run } = useAction();

  const submit = async () => {
    const local: Partial<Record<PwField, string>> = {
      current: pw.current ? undefined : "Enter your current password",
      next: pw.next.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters` : pw.next === pw.current ? "Choose a password you haven't used here" : undefined,
      confirm: pw.confirm === pw.next ? undefined : "Passwords don't match",
    };
    const first = (["current", "next", "confirm"] as const).find((k) => local[k]);
    if (first) {
      setErrors(Object.fromEntries(Object.entries(local).filter(([, v]) => v)) as Record<string, string>);
      document.getElementById(`pw-${first}`)?.focus();
      return;
    }
    setNotice(null);
    const res = await run(() => changePasswordAction({ current: pw.current, next: pw.next }));
    if (res) {
      setPw({ current: "", next: "", confirm: "" });
      setNotice("Password changed. You've been signed out on your other devices — this browser stays signed in.");
      router.refresh();
    }
  };

  const field = (k: PwField, label: string, auto: string, hint?: string) => (
    <div>
      <label htmlFor={`pw-${k}`} className="mb-1.5 block text-[12.5px] font-medium">
        {label}
      </label>
      <input
        id={`pw-${k}`}
        type={show ? "text" : "password"}
        autoComplete={auto}
        value={pw[k]}
        onChange={(e) => {
          setPw({ ...pw, [k]: e.target.value });
          if (errors[k]) setErrors({ ...errors, [k]: "" });
        }}
        className={inputCls}
        aria-invalid={Boolean(errors[k]) || undefined}
        aria-describedby={errors[k] ? `pw-${k}-err` : undefined}
      />
      {errors[k] ? <FieldError id={`pw-${k}-err`} msg={errors[k]} /> : hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="@container border border-line bg-white p-5 md:p-7"
    >
      <FormSection title="Change password" description="Use at least 8 characters. Changing it signs you out on every other device.">
        {/* Lets password managers pair the new password with this account. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <div className="grid max-w-xl grid-cols-1 gap-4">
          {field("current", "Current password", "current-password")}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field("next", "New password", "new-password", `At least ${MIN_PASSWORD} characters`)}
            {field("confirm", "Confirm new password", "new-password")}
          </div>
          <button type="button" onClick={() => setShow(!show)} className="inline-flex items-center gap-1.5 self-start text-[12.5px] font-medium text-muted hover:text-ink">
            {show ? <EyeOff aria-hidden className="size-3.5" /> : <Eye aria-hidden className="size-3.5" />} {show ? "Hide passwords" : "Show passwords"}
          </button>
          {notice && (
            <p role="status" className="border-l-2 border-[#1e7a3c] bg-[#e8f5ec]/60 px-3 py-2 text-[12.5px]">
              {notice}
            </p>
          )}
          <div>
            <Button type="submit" variant="dark" size="sm" disabled={busy || !pw.current || !pw.next} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
              Update password
            </Button>
          </div>
        </div>
      </FormSection>
    </form>
  );
}

/** Where the customer is signed in, with sign-out per device, everywhere else, or everywhere. */
export function SessionsCard({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const { toast } = useUI();
  const [confirm, setConfirm] = useState<SessionRow | "others" | "all" | null>(null);
  const { busy, run } = useAction();
  const others = sessions.filter((s) => !s.current).length;

  const go = async () => {
    if (!confirm) return;
    if (confirm === "all") {
      const res = await run(() => signOutEverywhereAction());
      setConfirm(null);
      if (!res) return;
      // This browser is signed out too: forget the account copy kept on the device.
      userStore.set(null);
      wishlistStore.set({ cars: [], used: [] });
      toast("Signed out on every device");
      router.push("/login");
      router.refresh();
      return;
    }
    const res = confirm === "others" ? await run(() => signOutOtherDevicesAction()) : await run(() => revokeCustomerSessionAction(confirm.key));
    setConfirm(null);
    if (res) {
      toast(confirm === "others" ? "Signed out of every other device" : `Signed out ${confirm.device}`, { tone: "success" });
      router.refresh();
    }
  };

  return (
    <section aria-labelledby="sessions-title" className="border border-line bg-white">
      <header className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-7">
        <div>
          <h2 id="sessions-title" className="text-[14px] font-semibold">
            Where you&apos;re signed in
          </h2>
          <p className="mt-0.5 text-[12.5px] text-muted">You stay signed in for 30 days on each browser. Sign out anything you don&apos;t recognise, then change your password.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setConfirm("others")} disabled={!others || busy} icon={<LogOut className="size-4" aria-hidden />} className="shrink-0">
          Sign out other devices
        </Button>
      </header>
      <ul className="divide-y divide-line">
        {sessions.map((s) => (
          <li key={s.key} className="flex items-center gap-4 px-5 py-4 md:px-7">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-mist text-ink/70">
              {s.mobile ? <Smartphone aria-hidden className="size-4" /> : <Laptop aria-hidden className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
                {s.device}
                {s.current && <Badge tone="green">This browser</Badge>}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">
                Signed in {s.started}
                {s.ip ? ` · IP ${s.ip}` : ""} · Until {s.expires}
              </p>
            </div>
            {!s.current && (
              <button type="button" onClick={() => setConfirm(s)} className="shrink-0 text-[12.5px] font-medium text-muted hover:text-red">
                Sign out
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 border-t border-line bg-mist/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-7">
        <p className="flex items-start gap-2 text-[12.5px] text-muted">
          <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          Lost a phone or used a shared computer? Sign out everywhere — including here — and sign back in.
        </p>
        <button type="button" onClick={() => setConfirm("all")} disabled={busy} className="shrink-0 text-[12.5px] font-semibold text-red hover:underline disabled:opacity-50">
          Sign out everywhere
        </button>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "all" ? "Sign out everywhere?" : confirm === "others" ? "Sign out other devices?" : "Sign out this device?"}
        body={
          confirm === "all"
            ? `Every session ends, including this browser (${sessions.length} in all). You'll need to sign in again.`
            : confirm === "others"
              ? `${others} other ${others === 1 ? "session" : "sessions"} will end. You stay signed in here.`
              : confirm
                ? `${confirm.device} will need to sign in again.`
                : undefined
        }
        confirm={confirm === "all" ? "Sign out everywhere" : "Sign out"}
        tone={confirm === "all" ? "primary" : "dark"}
        busy={busy}
        onConfirm={go}
      />
    </section>
  );
}
