"use client";

import { useState } from "react";
import { useDeskRouter as useRouter } from "@/components/admin/desk";
import { Check, Copy, KeyRound, Loader2, LogOut, UserPlus } from "lucide-react";
import type { UserRole } from "@/db/enums";
import { INDIAN_STATES } from "@/data/states";
import type { ActionResult } from "@/lib/action-result";
import { STAFF_SECTIONS, type Section } from "@/lib/staff-access";
import { cn } from "@/lib/utils";
import { adminChangePasswordAction } from "@/server/actions/auth";
import { createStaffAction, resetUserPasswordAction, signOutEverywhereAction, updateAccountAction, updateStaffAccessAction } from "@/server/actions/admin";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { Panel } from "./ui";

const DESK_ROLES = [
  { value: "staff", label: "Staff", hint: "Signs in at /staff/login and uses only the sections you tick." },
  { value: "admin", label: "Admin", hint: "Signs in at /admin/login and can use everything, including staff accounts and billing." },
] as const;

function useSubmit() {
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = async <T extends object>(fn: () => Promise<ActionResult<T>>, ok: string) => {
    setBusy(true);
    try {
      const res = await fn();
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast(res.error ?? "Please check the highlighted fields.", { tone: "error" });
        return null;
      }
      setErrors({});
      toast(ok, { tone: "success" });
      return res;
    } catch {
      toast("Couldn't reach the server. Please try again.", { tone: "error" });
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, errors, setErrors, run };
}

function TempPassword({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 border border-ink bg-mist p-4">
      <p className="text-[13px] font-semibold">Temporary password for {email}</p>
      <p className="mt-0.5 text-[12.5px] text-muted">Shown once. Share it securely and ask them to change it after signing in.</p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 rounded-[3px] border border-line bg-white px-3 py-2 font-mono text-[14px]">{password}</code>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(password).then(() => setCopied(true))}
          className="inline-flex h-10 items-center gap-1.5 rounded-[3px] border border-line bg-white px-3 text-[13px] font-medium hover:border-ink"
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function UserEditor({
  user,
}: {
  user: { id: number; name: string; email: string; phone: string | null; state: string | null; city: string | null; role: UserRole; isActive: boolean };
}) {
  const router = useRouter();
  const { toast } = useUI();
  const { busy, errors, run } = useSubmit();
  const [v, setV] = useState({ name: user.name, email: user.email, phone: user.phone ?? "", state: user.state ?? "", city: user.city ?? "", isActive: user.isActive });
  const [temp, setTemp] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const set = (k: keyof typeof v, value: string | boolean) => setV((p) => ({ ...p, [k]: value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run(() => updateAccountAction(user.id, { ...v, state: v.state || null, city: v.city || null }), "Account updated")) router.refresh();
  };

  const reset = async () => {
    if (!window.confirm(`Reset ${user.name}'s password? They'll be signed out everywhere.`)) return;
    setResetting(true);
    const res = await resetUserPasswordAction(user.id).catch(() => null);
    setResetting(false);
    if (res?.ok) setTemp(res.password);
    else toast(res?.error ?? "Couldn't reach the server. Please try again.", { tone: "error" });
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <form onSubmit={save} noValidate>
        <Panel title="Profile">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Name" value={v.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
            <TextField label="Email" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} error={errors.email} />
            <TextField label="Mobile" prefix="+91" inputMode="numeric" value={v.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} error={errors.phone} />
            <SelectField
              label="State"
              placeholder="Not set"
              options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
              value={v.state}
              onChange={(e) => set("state", e.target.value)}
              error={errors.state}
            />
            <TextField label="City" value={v.city} onChange={(e) => set("city", e.target.value)} error={errors.city} />
            <label className="flex cursor-pointer items-start gap-3 rounded-[3px] border border-line px-4 py-3.5 sm:col-span-2">
              <input type="checkbox" checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-red)]" />
              <span>
                <span className="block text-[14px] font-medium">Account active</span>
                <span className="block text-[12.5px] text-muted">Turning this off signs them out and blocks sign-in.</span>
              </span>
            </label>
          </div>
          <Button type="submit" className="mt-5" disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}>
            Save changes
          </Button>
        </Panel>
      </form>
      <Panel title="Password">
        <p className="text-[13.5px] text-muted">Passwords are stored hashed — nobody can see them. You can issue a temporary one.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={reset} disabled={resetting} icon={resetting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}>
          Reset password
        </Button>
        {temp && <TempPassword email={user.email} password={temp} />}
      </Panel>
    </div>
  );
}

/** Ticks for the sections a staff member may use. */
function SectionPicker({ value, onChange, error, disabled }: { value: Section[]; onChange: (v: Section[]) => void; error?: string; disabled?: boolean }) {
  const toggle = (key: Section) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <fieldset disabled={disabled} className="disabled:opacity-50">
      <legend className="mb-2 text-[12.5px] font-medium text-ink">Sections they can use</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {STAFF_SECTIONS.map((s) => (
          <label key={s.key} className={cn("flex cursor-pointer items-start gap-3 rounded-[3px] border px-4 py-3 transition-colors hover:border-ink/30", value.includes(s.key) ? "border-ink bg-mist/60" : "border-line")}>
            <input type="checkbox" checked={value.includes(s.key)} onChange={() => toggle(s.key)} className="mt-0.5 size-4 accent-[var(--color-red)]" />
            <span>
              <span className="block text-[14px] font-medium">{s.label}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-muted">{s.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red">{error}</p>
      ) : (
        <p className="mt-2 text-[12px] text-muted">Staff accounts, billing and the activity log are for admins only.</p>
      )}
    </fieldset>
  );
}

function RolePicker({ value, onChange, disabled }: { value: "staff" | "admin"; onChange: (v: "staff" | "admin") => void; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 text-[12.5px] font-medium text-ink">Sign-in</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DESK_ROLES.map((r) => (
          <label key={r.value} className={cn("flex cursor-pointer items-start gap-3 rounded-[3px] border px-4 py-3 transition-colors hover:border-ink/30", value === r.value ? "border-ink bg-mist/60" : "border-line")}>
            <input type="radio" name="desk-role" checked={value === r.value} onChange={() => onChange(r.value)} className="mt-0.5 size-4 accent-[var(--color-red)]" />
            <span>
              <span className="block text-[14px] font-medium">{r.label}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-muted">{r.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CreateStaffForm() {
  const router = useRouter();
  const { busy, errors, run } = useSubmit();
  const [v, setV] = useState<{ name: string; email: string; role: "staff" | "admin"; sections: Section[] }>({ name: "", email: "", role: "staff", sections: [] });
  const [created, setCreated] = useState<{ id: number; email: string; password: string; role: "staff" | "admin" } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await run(() => createStaffAction(v), "Account created");
    if (res) {
      setCreated({ id: res.id, email: v.email, password: res.password, role: v.role });
      router.refresh();
    }
  };

  if (created)
    return (
      <Panel title="Account created">
        <p className="text-[13.5px] text-muted">
          They sign in at <strong className="font-semibold text-ink">{created.role === "admin" ? "/admin/login" : "/staff/login"}</strong> with this email and the temporary password below.
        </p>
        <TempPassword email={created.email} password={created.password} />
        <div className="mt-5 flex gap-2">
          <Button href={`/admin/team/${created.id}`} size="sm">
            Open account
          </Button>
          <Button href="/admin/team" variant="outline" size="sm">
            Back to staff
          </Button>
        </div>
      </Panel>
    );

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl">
      <Panel title="New staff account">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={errors.name} />
            <TextField label="Work email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} error={errors.email} />
          </div>
          <RolePicker value={v.role} onChange={(role) => setV({ ...v, role })} />
          {v.role === "staff" && <SectionPicker value={v.sections} onChange={(sections) => setV({ ...v, sections })} error={errors.sections} />}
        </div>
        <p className="mt-4 text-[12.5px] text-muted">A temporary password is generated for you to share.</p>
        <Button type="submit" className="mt-5" disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}>
          Create account
        </Button>
      </Panel>
    </form>
  );
}

/** A staff member's sign-in (staff or admin) and sections. Admins only. */
export function StaffAccessEditor({ user, self }: { user: { id: number; name: string; role: "staff" | "admin"; permissions: Section[] }; self: boolean }) {
  const router = useRouter();
  const { busy, errors, run } = useSubmit();
  const [v, setV] = useState<{ role: "staff" | "admin"; sections: Section[] }>({ role: user.role, sections: user.permissions });
  const dirty = v.role !== user.role || [...v.sections].sort().join() !== [...user.permissions].sort().join();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (v.role !== user.role && !window.confirm(`Change ${user.name}'s sign-in to ${v.role === "admin" ? "the admin panel (/admin/login)" : "the staff desk (/staff/login)"}? They'll be signed out.`)) return;
    if (await run(() => updateStaffAccessAction(user.id, v), "Access updated")) router.refresh();
  };

  return (
    <form onSubmit={save} noValidate>
      <Panel title="Access">
        <div className="space-y-5">
          <RolePicker value={v.role} onChange={(role) => setV({ ...v, role })} disabled={self} />
          {self && <p className="-mt-2 text-[12.5px] text-muted">You can&apos;t change your own access — ask another admin.</p>}
          {v.role === "staff" && <SectionPicker value={v.sections} onChange={(sections) => setV({ ...v, sections })} error={errors.sections} />}
        </div>
        <Button type="submit" className="mt-5" disabled={busy || !dirty || self} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}>
          Save access
        </Button>
      </Panel>
    </form>
  );
}

export function ChangePasswordForm() {
  const { busy, errors, setErrors, run } = useSubmit();
  const [v, setV] = useState({ current: "", next: "", confirm: "" });
  const [mismatch, setMismatch] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (v.next !== v.confirm) {
      // Only this message applies now — the previous attempt's server errors may be stale.
      setErrors({});
      return setMismatch(true);
    }
    setMismatch(false);
    if (await run(() => adminChangePasswordAction({ current: v.current, next: v.next }), "Password changed. Other devices were signed out.")) setV({ current: "", next: "", confirm: "" });
  };

  return (
    <form onSubmit={submit} noValidate className="max-w-xl">
      <Panel title="Change password">
        <div className="space-y-4">
          <TextField label="Current password" type="password" autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} error={errors.current} />
          <TextField label="New password" type="password" autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} error={errors.next} hint="At least 8 characters." />
          <TextField label="Confirm new password" type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} error={mismatch ? "Passwords don't match" : undefined} />
        </div>
        <Button type="submit" className="mt-5" disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}>
          Update password
        </Button>
      </Panel>
    </form>
  );
}

/** Ends the account's sessions on every device (on your own account, this browser stays signed in). */
export function SignOutEverywhereButton({ userId, name, self, count }: { userId: number; name: string; self: boolean; count: number }) {
  const router = useRouter();
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const others = self ? count - 1 : count;

  const run = async () => {
    const question = self ? "Sign out of all your other sessions? This browser stays signed in." : `Sign ${name} out on every device? They'll need to sign in again.`;
    if (!window.confirm(question)) return;
    setBusy(true);
    const res = await signOutEverywhereAction(userId).catch(() => null);
    setBusy(false);
    if (!res?.ok) return toast(res?.error ?? "Couldn't reach the server. Please try again.", { tone: "error" });
    toast(res.ended ? `Ended ${res.ended} ${res.ended === 1 ? "session" : "sessions"}` : "There were no other sessions to end", { tone: "success" });
    router.refresh();
  };

  return (
    <Button variant="outline" size="sm" onClick={run} disabled={busy || others < 1} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}>
      {self ? "Sign out other sessions" : "Sign out everywhere"}
    </Button>
  );
}
