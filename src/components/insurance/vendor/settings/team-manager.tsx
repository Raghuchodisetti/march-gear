"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, Power, RotateCcw, ShieldCheck, UserPlus } from "lucide-react";
import { INS_ROLES, type InsRole } from "@/db/enums";
import { INS_ROLE_LABEL } from "@/insurance/labels";
import { INS_PERMISSIONS, INS_ROLE_PERMISSIONS, type InsPermission } from "@/insurance/permissions";
import { cn } from "@/lib/utils";
import { addInsMemberAction, resetInsMemberPasswordAction, setInsMemberActiveAction, updateInsMemberAccessAction } from "@/server/actions/ins-settings";
import { Badge } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Drawer, Modal } from "@/components/ui/overlay";
import { Tabs } from "@/components/ui/tabs";
import { Check2, ConfirmDialog, FieldError, inputCls, useAction } from "@/components/portal/profile/kit";

/* Settings → Team: the company's portal accounts, roles, custom permissions and access. */

export interface InsMemberView {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone: string | null;
  role: InsRole;
  permissions: InsPermission[];
  custom: boolean;
  isActive: boolean;
  lastLogin: string | null;
  joined: string;
  openEnquiries: number;
  activity: { id: number; summary: string; when: string }[];
}

type Assignable = Exclude<InsRole, "owner">;

const GROUPS: { title: string; perms: InsPermission[] }[] = [
  { title: "Products", perms: ["products.view", "products.manage"] },
  { title: "Customers", perms: ["enquiries.view_all", "enquiries.view_own", "enquiries.manage", "enquiries.assign", "quotes.manage", "renewals.manage"] },
  { title: "Marketing", perms: ["campaigns.manage", "ads.manage", "analytics.view"] },
  { title: "Company", perms: ["dashboard.view", "profile.manage", "billing.manage", "settings.manage"] },
  { title: "Administration", perms: ["team.manage", "support.use"] },
];

const ROLE_SUMMARY: Record<InsRole, string> = {
  owner: "Everything, including billing and the team.",
  admin: "Everything except billing — including the application and team.",
  manager: "All enquiries, assignment, quotations, renewals and analytics.",
  executive: "Their own enquiries, quotations and renewals.",
  marketing: "Campaigns, advertising and analytics.",
  finance: "Plans, invoices, payments and analytics.",
};

const initials = (n: string) =>
  n
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

const roleTone = (r: InsRole) => (r === "owner" ? "dark" : r === "admin" ? "blue" : "neutral");

export function InsTeamManager({
  members,
  me,
  isOwner,
  myPerms,
  limit,
  planName,
  blocked,
}: {
  members: InsMemberView[];
  me: number;
  isOwner: boolean;
  myPerms: InsPermission[];
  limit: number | null;
  planName: string;
  /** Suspended / rejected companies can't change their team. */
  blocked: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", mobile: "", role: "executive" as Assignable });
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null);
  const [managingId, setManagingId] = useState<number | null>(null);
  const [tab, setTab] = useState("access");
  const [access, setAccess] = useState<{ role: InsRole; perms: InsPermission[] }>({ role: "executive", perms: [] });
  const [confirm, setConfirm] = useState<"deactivate" | "reset" | null>(null);
  const { busy, errors, setErrors, run } = useAction();

  const active = members.filter((m) => m.isActive).length;
  const atLimit = limit !== null && active >= limit;
  const roleOptions = INS_ROLES.filter((r) => r !== "owner" && (isOwner || r !== "admin")) as Assignable[];
  // A role is offered only when its defaults don't exceed your own access.
  const grantable = (r: InsRole) => INS_ROLE_PERMISSIONS[r].every((p) => myPerms.includes(p));

  const openManage = (m: InsMemberView) => {
    setManagingId(m.id);
    setTab("access");
    setAccess({ role: m.role, perms: m.permissions });
    setTemp(null);
  };
  // Mirrors the server's rule: not the owner, not yourself, admins only by the owner, and nobody with access you lack.
  const canEdit = (m: InsMemberView) => !blocked && m.role !== "owner" && m.userId !== me && (isOwner || (m.role !== "admin" && m.permissions.every((p) => myPerms.includes(p))));

  const add = async () => {
    const res = await run(() => addInsMemberAction(form), "Team member added.");
    if (res) {
      setTemp({ email: res.email, password: res.password });
      setForm({ name: "", email: "", mobile: "", role: "executive" });
      router.refresh();
    }
  };
  const current = managingId !== null ? (members.find((m) => m.id === managingId) ?? null) : null;
  const editable = current ? canEdit(current) : false;
  const accessDirty = current && (access.role !== current.role || access.perms.slice().sort().join() !== current.permissions.slice().sort().join());

  const saveAccess = async (reset = false) => {
    if (!current) return;
    const defaults = INS_ROLE_PERMISSIONS[access.role];
    const isDefault = reset || (access.perms.length === defaults.length && defaults.every((p) => access.perms.includes(p)));
    const res = await run(() => updateInsMemberAccessAction({ memberId: current.id, role: access.role, permissions: isDefault ? null : access.perms }), reset ? "Permissions reset to the role's defaults." : "Access updated.");
    if (res) {
      if (reset) setAccess((a) => ({ ...a, perms: INS_ROLE_PERMISSIONS[a.role] }));
      router.refresh();
    }
  };
  const toggleActive = async () => {
    if (!current) return;
    const next = !current.isActive;
    const res = await run(() => setInsMemberActiveAction({ memberId: current.id, active: next }), next ? `${current.name} can sign in again.` : `${current.name} was deactivated and signed out.`);
    setConfirm(null);
    if (res) router.refresh();
  };
  const resetPassword = async () => {
    if (!current) return;
    const res = await run(() => resetInsMemberPasswordAction(current.id), "New temporary password created.");
    setConfirm(null);
    if (res) setTemp({ email: res.email, password: res.password });
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 border border-line bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="min-w-0">
          <p className="text-[13.5px]">
            <span className="font-semibold num">{active}</span> active {active === 1 ? "account" : "accounts"}
            <span className="text-muted">{limit === null ? ` · unlimited on your ${planName} plan` : ` of ${limit} on your ${planName} plan (including the owner)`}</span>
          </p>
          {limit !== null && (
            <span className="mt-2 block h-1 w-full max-w-xs overflow-hidden rounded-full bg-mist" aria-hidden>
              <span className={cn("block h-full rounded-full", atLimit ? "bg-red" : "bg-ink")} style={{ width: `${Math.min(100, Math.round((active / limit) * 100))}%` }} />
            </span>
          )}
          {blocked && <p className="mt-1.5 text-[12.5px] text-muted">Team changes are paused while your company&apos;s account is suspended or not approved.</p>}
          {atLimit && !blocked && <p className="mt-1.5 text-[12.5px] text-muted">You&apos;ve reached your plan&apos;s limit. Deactivate someone, or upgrade under Billing once approved.</p>}
        </div>
        <Button
          variant="dark"
          size="sm"
          onClick={() => {
            setErrors({});
            setTemp(null);
            setAdding(true);
          }}
          disabled={atLimit || blocked}
          icon={<UserPlus className="size-4" aria-hidden />}
          title={atLimit ? "Your plan's team limit is reached" : undefined}
        >
          Add team member
        </Button>
      </div>

      {/* Phones: one card per person (the table needs ~820px). */}
      <ul className="space-y-2 md:hidden">
        {members.map((m) => (
          <li key={m.id} className={cn("border border-line bg-white p-4", !m.isActive && "text-muted")} data-testid="member">
            <div className="flex items-start gap-3">
              <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold", m.role === "owner" ? "bg-ink text-white" : "bg-mist text-ink")}>{initials(m.name)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-ink">
                  {m.name}
                  {m.userId === me && <span className="ml-1.5 text-[11.5px] font-normal text-muted">(you)</span>}
                </p>
                <p className="truncate text-[12px] text-muted">{m.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone={roleTone(m.role)}>{INS_ROLE_LABEL[m.role]}</Badge>
                  {m.isActive ? <Badge tone="green">Active</Badge> : <Badge>Deactivated</Badge>}
                </div>
                <p className="mt-2 text-[12px] text-muted">
                  <span className="font-medium text-ink num">{m.openEnquiries}</span> open enquiries · Last sign-in {m.lastLogin ?? "never"}
                </p>
              </div>
              <button type="button" onClick={() => openManage(m)} className="inline-flex h-8 shrink-0 items-center rounded-[3px] border border-line px-3 text-[12.5px] font-medium text-ink transition-colors hover:border-ink">
                {canEdit(m) ? "Manage" : "View"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="relative hidden overflow-x-auto border border-line bg-white md:block">
        <table className="w-full min-w-[820px] border-collapse text-left text-[13.5px]">
          <thead>
            <tr className="text-[12px] text-muted">
              <th className="border-b border-line bg-mist/60 px-5 py-3 font-semibold">Member</th>
              <th className="border-b border-line bg-mist/60 px-4 py-3 font-semibold">Role</th>
              <th className="border-b border-line bg-mist/60 px-4 py-3 font-semibold">Access</th>
              <th className="border-b border-line bg-mist/60 px-4 py-3 text-right font-semibold">Open enquiries</th>
              <th className="border-b border-line bg-mist/60 px-4 py-3 font-semibold">Last sign-in</th>
              <th className="border-b border-line bg-mist/60 px-4 py-3 font-semibold">Status</th>
              <th className="border-b border-line bg-mist/60 px-5 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className={cn("transition-colors duration-300 hover:bg-mist/40", !m.isActive && "text-muted")} data-testid="member">
                <td className="border-b border-line px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold", m.role === "owner" ? "bg-ink text-white" : "bg-mist text-ink")}>{initials(m.name)}</span>
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">
                        {m.name}
                        {m.userId === me && <span className="ml-1.5 text-[11.5px] font-normal text-muted">(you)</span>}
                      </span>
                      <span className="block truncate text-[12px] text-muted">{m.email}</span>
                    </span>
                  </div>
                </td>
                <td className="border-b border-line px-4 py-3.5">
                  <Badge tone={roleTone(m.role)}>{INS_ROLE_LABEL[m.role]}</Badge>
                </td>
                <td className="border-b border-line px-4 py-3.5 text-[12.5px]">{m.role === "owner" ? "Full access" : m.custom ? <span className="font-medium text-ink">Custom · {m.permissions.length} permissions</span> : "Role defaults"}</td>
                <td className="border-b border-line px-4 py-3.5 text-right font-medium text-ink num">{m.openEnquiries}</td>
                <td className="border-b border-line px-4 py-3.5 text-[12.5px]">{m.lastLogin ?? "Never"}</td>
                <td className="border-b border-line px-4 py-3.5">{m.isActive ? <Badge tone="green">Active</Badge> : <Badge>Deactivated</Badge>}</td>
                <td className="border-b border-line px-5 py-3.5 text-right">
                  <button type="button" onClick={() => openManage(m)} className="inline-flex h-8 items-center rounded-[3px] border border-line px-3 text-[12.5px] font-medium text-ink transition-colors hover:border-ink">
                    {canEdit(m) ? "Manage" : "View"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add member */}
      <Modal open={adding} onClose={() => setAdding(false)} title={temp ? "Share the sign-in details" : "Add a team member"} description={temp ? undefined : "They sign in at /insurance-vendor/login with a temporary password you share with them."}>
        <div className="px-6 py-6 sm:px-8">
          {temp ? (
            <>
              <TempPassword {...temp} />
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setTemp(null)} disabled={atLimit}>
                  Add another
                </Button>
                <Button variant="dark" size="sm" onClick={() => setAdding(false)}>
                  Done
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {(
                [
                  ["name", "Full name", "text", "name"],
                  ["email", "Work email", "email", "email"],
                  ["mobile", "Mobile", "tel", "tel"],
                ] as const
              ).map(([k, label, type, auto]) => (
                <div key={k}>
                  <label htmlFor={`tm-${k}`} className="mb-1.5 block text-[12.5px] font-medium">
                    {label}
                  </label>
                  <input id={`tm-${k}`} type={type} autoComplete={auto} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={inputCls} aria-invalid={Boolean(errors[k]) || undefined} />
                  <FieldError msg={errors[k]} />
                </div>
              ))}
              <fieldset>
                <legend className="mb-2 text-[12.5px] font-medium">Role</legend>
                <div className="space-y-2">
                  {roleOptions.map((r) => {
                    const ok = grantable(r);
                    return (
                      <label
                        key={r}
                        className={cn(
                          "flex items-start gap-3 border px-3.5 py-3 transition-colors duration-300",
                          ok ? "cursor-pointer" : "cursor-not-allowed opacity-55",
                          form.role === r ? "border-ink" : "border-line hover:border-ink/30",
                        )}
                      >
                        <input type="radio" name="role" value={r} checked={form.role === r} disabled={!ok} onChange={() => setForm({ ...form, role: r })} className="mt-1 accent-[#111111]" />
                        <span>
                          <span className="block text-[13.5px] font-medium">{INS_ROLE_LABEL[r]}</span>
                          <span className="block text-[12px] text-muted">{ok ? ROLE_SUMMARY[r] : "Includes permissions you don't have yourself."}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <FieldError msg={errors.role} />
              </fieldset>
              <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
                <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
                <Button variant="dark" size="sm" onClick={add} disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
                  Create account
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Manage member */}
      <Drawer
        open={current !== null}
        onClose={() => setManagingId(null)}
        title={current?.name ?? ""}
        className="max-w-xl"
        footer={
          current && editable && tab === "access" ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => saveAccess(true)} disabled={busy || !current.custom} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted hover:text-ink disabled:opacity-40">
                <RotateCcw aria-hidden className="size-3.5" /> Reset to role defaults
              </button>
              <Button variant="dark" size="sm" onClick={() => saveAccess(false)} disabled={busy || !accessDirty} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
                Save access
              </Button>
            </div>
          ) : undefined
        }
      >
        {current && (
          <div className="px-5 py-5 sm:px-6">
            <div className="flex items-center gap-2">
              <Badge tone={roleTone(current.role)}>{INS_ROLE_LABEL[current.role]}</Badge>
              {current.isActive ? <Badge tone="green">Active</Badge> : <Badge>Deactivated</Badge>}
            </div>
            <p className="mt-3 break-words text-[13px] text-muted">
              {current.email}
              {current.phone ? ` · ${current.phone}` : ""} · Joined {current.joined}
            </p>
            <Tabs
              className="mt-5"
              size="sm"
              value={tab}
              onChange={setTab}
              items={[{ value: "access", label: "Access" }, { value: "activity", label: "Activity", count: current.activity.length }, ...(editable ? [{ value: "account", label: "Account" }] : [])]}
            />

            {tab === "access" && (
              <div className="mt-5 space-y-6">
                {!editable && (
                  <p className="border-l-2 border-line pl-3 text-[12.5px] text-muted">
                    {current.role === "owner"
                      ? "The owner always has full access and can't be removed."
                      : current.userId === me
                        ? "You can't change your own access."
                        : blocked
                          ? "Team changes are paused while your company's account is suspended or not approved."
                          : "Only the owner can change this person's access."}
                  </p>
                )}
                {editable && (
                  <div>
                    <label htmlFor="tm-role" className="mb-1.5 block text-[12.5px] font-medium">
                      Role
                    </label>
                    <select
                      id="tm-role"
                      value={access.role}
                      onChange={(e) => {
                        const role = e.target.value as InsRole;
                        setAccess({ role, perms: INS_ROLE_PERMISSIONS[role] });
                      }}
                      className={cn(inputCls, "cursor-pointer")}
                    >
                      {roleOptions.map((r) => (
                        <option key={r} value={r} disabled={!grantable(r) && r !== current.role}>
                          {INS_ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs text-muted">{ROLE_SUMMARY[access.role]} Changing the role resets permissions to its defaults.</p>
                  </div>
                )}
                {GROUPS.map((g) => (
                  <fieldset key={g.title}>
                    <legend className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted">{g.title}</legend>
                    <div className="space-y-2.5">
                      {g.perms.map((p) => {
                        const on = (editable ? access.perms : current.permissions).includes(p);
                        const locked = !editable || p === "dashboard.view" || !myPerms.includes(p);
                        return (
                          <Check2
                            key={p}
                            checked={on}
                            disabled={locked}
                            onChange={(v) => setAccess((a) => ({ ...a, perms: v ? [...a.perms, p] : a.perms.filter((x) => x !== p) }))}
                            label={INS_PERMISSIONS[p]}
                            hint={editable && p === "dashboard.view" ? "Everyone keeps the dashboard." : editable && !myPerms.includes(p) ? "You don't have this permission yourself." : undefined}
                          />
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            )}

            {tab === "activity" && (
              <div className="mt-5">
                <p className="mb-4 text-[13px]">
                  <span className="font-semibold">{current.openEnquiries}</span> open enquiries assigned
                </p>
                {current.activity.length ? (
                  <ol className="relative space-y-4 before:absolute before:bottom-1 before:left-[3px] before:top-1 before:w-px before:bg-line">
                    {current.activity.map((a) => (
                      <li key={a.id} className="relative flex gap-3">
                        <span aria-hidden className="relative z-[1] mt-[6px] size-[7px] shrink-0 rounded-full border border-ink/30 bg-white" />
                        <div>
                          <p className="text-[13px] leading-snug">{a.summary}</p>
                          <p className="mt-0.5 text-[11.5px] text-muted">{a.when}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="py-8 text-center text-[13px] text-muted">No activity recorded yet.</p>
                )}
                <a href={`/insurance-vendor/settings?tab=activity&user=${current.userId}`} className="mt-5 inline-block text-[12.5px] font-medium text-muted hover:text-ink">
                  Full activity log →
                </a>
              </div>
            )}

            {tab === "account" && editable && (
              <div className="mt-5 space-y-4">
                {temp && <TempPassword {...temp} />}
                <div className="flex items-start justify-between gap-4 border border-line p-4">
                  <div>
                    <p className="text-[13.5px] font-medium">Reset password</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">Creates a new temporary password and signs them out everywhere.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setConfirm("reset")} disabled={!current.isActive || busy} icon={<KeyRound className="size-3.5" aria-hidden />}>
                    Reset
                  </Button>
                </div>
                <div className="flex items-start justify-between gap-4 border border-line p-4">
                  <div>
                    <p className="text-[13.5px] font-medium">{current.isActive ? "Deactivate account" : "Reactivate account"}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {current.isActive ? "They're signed out immediately and can't sign in. Their history stays — reassign their open enquiries afterwards." : atLimit ? "Your plan's team limit is reached — deactivate someone first." : "They can sign in again with their existing password."}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={current.isActive ? "outline" : "dark"}
                    onClick={() => (current.isActive ? setConfirm("deactivate") : toggleActive())}
                    disabled={busy || (!current.isActive && atLimit)}
                    icon={<Power className="size-3.5" aria-hidden />}
                  >
                    {current.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "reset" ? `Reset ${current?.name ?? ""}'s password?` : `Deactivate ${current?.name ?? ""}?`}
        body={
          confirm === "reset"
            ? "Their current password stops working and they're signed out on every device. You'll see a new temporary password once."
            : `They're signed out on every device right away.${current?.openEnquiries ? ` They have ${current.openEnquiries} open enquiries — reassign them afterwards.` : ""}`
        }
        confirm={confirm === "reset" ? "Reset password" : "Deactivate"}
        busy={busy}
        onConfirm={confirm === "reset" ? resetPassword : toggleActive}
      />
    </>
  );
}

function TempPassword({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border border-ink bg-mist p-4" data-testid="temp-password">
      <p className="flex items-center gap-2 text-[13px] font-semibold">
        <ShieldCheck aria-hidden className="size-4 shrink-0" /> <span className="min-w-0 break-all">Temporary password for {email}</span>
      </p>
      <p className="mt-0.5 text-[12.5px] text-muted">Shown once — it isn&apos;t stored anywhere we can show you again. Share it privately and ask them to change it under Settings → Account.</p>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-[3px] border border-line bg-white px-3 py-2 font-mono text-[14px]">{password}</code>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard
              .writeText(`${email}\n${password}`)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[3px] border border-line bg-white px-3 text-[13px] font-medium hover:border-ink"
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
