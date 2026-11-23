"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, LogOut, UserPlus } from "lucide-react";
import { USER_ROLES, type UserRole } from "@/db/enums";
import { INDIAN_STATES } from "@/data/states";
import type { ActionResult } from "@/lib/action-result";
import { adminChangePasswordAction } from "@/server/actions/auth";
import { createStaffAction, resetUserPasswordAction, signOutEverywhereAction, updateUserAction } from "@/server/actions/admin";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { Panel } from "./ui";

const ROLE_LABEL: Record<UserRole, string> = {
  customer: "Customer",
  editor: "Editor — catalogue, content & leads",
  admin: "Admin — everything, incl. users",
  dealer: "Dealer partner — dealer portal only",
  insurer: "Insurance vendor — insurance vendor portal only",
};
// Portal accounts are created by dealer / insurance vendor registration and keep their role.
const PORTAL_ROLES: UserRole[] = ["dealer", "insurer"];
const roleOptions = USER_ROLES.filter((r) => !PORTAL_ROLES.includes(r)).map((r) => ({ value: r, label: ROLE_LABEL[r] }));

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
  const [v, setV] = useState({ name: user.name, email: user.email, phone: user.phone ?? "", state: user.state ?? "", city: user.city ?? "", role: user.role, isActive: user.isActive });
  const [temp, setTemp] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const set = (k: keyof typeof v, value: string | boolean) => setV((p) => ({ ...p, [k]: value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run(() => updateUserAction(user.id, { ...v, state: v.state || null, city: v.city || null }), "User updated")) router.refresh();
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
        <Panel title="Profile & access">
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
            <SelectField
              label="Role"
              value={v.role}
              onChange={(e) => set("role", e.target.value)}
              options={PORTAL_ROLES.includes(user.role) ? [{ value: user.role, label: ROLE_LABEL[user.role] }] : roleOptions}
              disabled={PORTAL_ROLES.includes(user.role)}
              className="sm:col-span-2"
            />
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

export function CreateStaffForm() {
  const router = useRouter();
  const { busy, errors, run } = useSubmit();
  const [v, setV] = useState<{ name: string; email: string; role: UserRole }>({ name: "", email: "", role: "editor" });
  const [created, setCreated] = useState<{ id: number; email: string; password: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await run(() => createStaffAction(v), "Account created");
    if (res) {
      setCreated({ id: res.id, email: v.email, password: res.password });
      router.refresh();
    }
  };

  if (created)
    return (
      <Panel title="Account created">
        <TempPassword email={created.email} password={created.password} />
        <div className="mt-5 flex gap-2">
          <Button href={`/admin/users/${created.id}`} size="sm">
            Open account
          </Button>
          <Button href="/admin/users" variant="outline" size="sm">
            Back to users
          </Button>
        </div>
      </Panel>
    );

  return (
    <form onSubmit={submit} noValidate className="max-w-xl">
      <Panel title="New staff account">
        <div className="space-y-4">
          <TextField label="Name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={errors.name} />
          <TextField label="Work email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} error={errors.email} />
          <SelectField label="Role" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as UserRole })} options={roleOptions} />
        </div>
        <p className="mt-4 text-[12.5px] text-muted">A temporary password is generated for you to share.</p>
        <Button type="submit" className="mt-5" disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}>
          Create account
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
