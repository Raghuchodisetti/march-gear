"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Eye, EyeOff, Laptop, Loader2, LogOut, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  changeDealerPasswordAction,
  requestDeactivationAction,
  revokeSessionAction,
  saveNotificationPrefsAction,
  signOutOtherSessionsAction,
  updateAccountAction,
} from "@/server/actions/partner-settings";
import { Badge } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { Check2, ConfirmDialog, FieldError, FormSection, SaveBar, Toggle, inputCls, useAction } from "@/components/portal/profile/kit";
import { ALL_CATEGORIES, CATEGORY_LABEL, UNMUTABLE, type NotificationCategory } from "@/components/portal/notifications/categories";

/* ── Account ─────────────────────────────────────────────────── */

export function AccountForm({ initial, facts }: { initial: { name: string; mobile: string }; facts: { label: string; value: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const { busy, errors, run } = useAction();
  const save = async () => {
    const res = await run(() => updateAccountAction(v), "Account details saved.");
    if (res) {
      setSaved(JSON.stringify(v));
      router.refresh();
    }
  };
  return (
    <div className="@container border border-line bg-white p-5 md:p-7">
      <FormSection title="Your details" description="How you appear to your team and to MarchGear.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ac-name" className="mb-1.5 block text-[12.5px] font-medium">
              Full name
            </label>
            <input id="ac-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoComplete="name" className={inputCls} aria-invalid={Boolean(errors.name) || undefined} />
            <FieldError msg={errors.name} />
          </div>
          <div>
            <label htmlFor="ac-mobile" className="mb-1.5 block text-[12.5px] font-medium">
              Mobile
            </label>
            <input id="ac-mobile" value={v.mobile} onChange={(e) => setV({ ...v, mobile: e.target.value })} inputMode="tel" autoComplete="tel" className={inputCls} aria-invalid={Boolean(errors.mobile) || undefined} />
            <FieldError msg={errors.mobile} />
          </div>
        </div>
      </FormSection>
      <FormSection title="Account" description="Contact MarchGear support to change your sign-in email.">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="text-[12px] text-muted">{f.label}</dt>
              <dd className="mt-0.5 break-words text-[13.5px] font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      </FormSection>
      <SaveBar busy={busy} dirty={JSON.stringify(v) !== saved} onSave={save} onReset={() => setV(JSON.parse(saved))} />
    </div>
  );
}

/* ── Security ────────────────────────────────────────────────── */

export interface SessionView {
  id: string;
  device: string;
  mobile: boolean;
  ip: string | null;
  started: string;
  expires: string;
  current: boolean;
}

export function SecurityPanel({ sessions }: { sessions: SessionView[] }) {
  const router = useRouter();
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [revoke, setRevoke] = useState<SessionView | "all" | null>(null);
  const pwAction = useAction();
  const sessAction = useAction();
  const [notice, setNotice] = useState<string | null>(null);
  const others = sessions.filter((s) => !s.current).length;

  const change = async () => {
    const res = await pwAction.run(() => changeDealerPasswordAction(pw));
    if (res) {
      setPw({ current: "", next: "", confirm: "" });
      pwAction.setErrors({});
      router.refresh();
      // Tell them what happened to their other devices.
      setNotice(res.signedOut ? `Password changed. ${res.signedOut} other session${res.signedOut === 1 ? " was" : "s were"} signed out.` : "Password changed.");
    }
  };
  const confirmRevoke = async () => {
    if (!revoke) return;
    const res = revoke === "all" ? await sessAction.run(() => signOutOtherSessionsAction(), "Signed out of every other device.") : await sessAction.run(() => revokeSessionAction(revoke.id), "That device was signed out.");
    setRevoke(null);
    if (res) router.refresh();
  };

  const pwField = (k: "current" | "next" | "confirm", label: string, auto: string) => (
    <div>
      <label htmlFor={`pw-${k}`} className="mb-1.5 block text-[12.5px] font-medium">
        {label}
      </label>
      <input id={`pw-${k}`} type={show ? "text" : "password"} autoComplete={auto} value={pw[k]} onChange={(e) => setPw({ ...pw, [k]: e.target.value })} className={inputCls} aria-invalid={Boolean(pwAction.errors[k]) || undefined} />
      <FieldError msg={pwAction.errors[k]} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="@container border border-line bg-white p-5 md:p-7">
        <FormSection title="Change password" description="At least 8 characters. Changing it signs you out on every other device.">
          <div className="grid max-w-xl grid-cols-1 gap-4">
            {pwField("current", "Current password", "current-password")}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {pwField("next", "New password", "new-password")}
              {pwField("confirm", "Confirm new password", "new-password")}
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
              <Button variant="dark" size="sm" onClick={change} disabled={pwAction.busy || !pw.current || !pw.next} icon={pwAction.busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
                Update password
              </Button>
            </div>
          </div>
        </FormSection>
      </div>

      <section className="border border-line bg-white">
        <header className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-7">
          <div>
            <h2 className="text-[14px] font-semibold">Where you&apos;re signed in</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">Sessions last 7 days. Sign out any device you don&apos;t recognise, then change your password.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setRevoke("all")} disabled={!others || sessAction.busy} icon={<LogOut className="size-4" aria-hidden />}>
            Sign out everywhere else
          </Button>
        </header>
        <ul className="divide-y divide-line">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-4 px-5 py-4 md:px-7">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-mist text-ink/70">{s.mobile ? <Smartphone aria-hidden className="size-4" /> : <Laptop aria-hidden className="size-4" />}</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
                  {s.device}
                  {s.current && <Badge tone="green">This browser</Badge>}
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  Signed in {s.started}
                  {s.ip ? ` · IP ${s.ip}` : ""} · Expires {s.expires}
                </p>
              </div>
              {!s.current && (
                <button type="button" onClick={() => setRevoke(s)} className="shrink-0 text-[12.5px] font-medium text-muted hover:text-red">
                  Sign out
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={revoke !== null}
        onClose={() => setRevoke(null)}
        title={revoke === "all" ? "Sign out everywhere else?" : "Sign out this device?"}
        body={revoke === "all" ? `${others} other session${others === 1 ? "" : "s"} will end. You stay signed in here.` : "That browser will need to sign in again."}
        confirm="Sign out"
        busy={sessAction.busy}
        onConfirm={confirmRevoke}
      />
    </div>
  );
}

/* ── Notification preferences ────────────────────────────────── */

export function NotificationPrefs({ muted: initial, counts }: { muted: NotificationCategory[]; counts: Partial<Record<NotificationCategory, number>> }) {
  const router = useRouter();
  const [muted, setMuted] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify([...initial].sort()));
  const { busy, run } = useAction();
  const dirty = JSON.stringify([...muted].sort()) !== saved;
  const save = async () => {
    const res = await run(() => saveNotificationPrefsAction({ muted }), "Preferences saved.");
    if (res) {
      setSaved(JSON.stringify([...muted].sort()));
      router.refresh();
    }
  };
  return (
    <div className="@container border border-line bg-white p-5 md:p-7">
      <FormSection
        title="What you see"
        description="Turn off categories you don't need. Muted notifications are tucked away on the Notifications page (you can still open them) and left off your dashboard."
      >
        <ul className="divide-y divide-line border border-line">
          {ALL_CATEGORIES.map((c) => {
            const locked = UNMUTABLE.includes(c);
            return (
              <li key={c} className="px-4 py-3.5">
                <Toggle
                  checked={!muted.includes(c)}
                  disabled={locked}
                  onChange={(on) => setMuted((m) => (on ? m.filter((x) => x !== c) : [...m, c]))}
                  label={CATEGORY_LABEL[c]}
                  hint={locked ? "Always on — these can affect whether your dealership stays live." : counts[c] ? `${counts[c]} so far` : undefined}
                />
              </li>
            );
          })}
        </ul>
      </FormSection>
      <FormSection title="Email & SMS" description="How alerts reach you outside the portal.">
        <p className="border border-dashed border-ink/15 px-4 py-3 text-[13px] leading-relaxed text-muted">
          MarchGear doesn&apos;t send dealer alerts by email or SMS yet — everything arrives here in the portal (the bell in the top bar). We&apos;ll add delivery options here when they&apos;re available.
        </p>
      </FormSection>
      <SaveBar busy={busy} dirty={dirty} onSave={save} onReset={() => setMuted(JSON.parse(saved))} label="Save preferences" />
    </div>
  );
}

/* ── Deactivate dealership ───────────────────────────────────── */

export function DeactivateCard({ isOwner, openRequest, status }: { isOwner: boolean; openRequest: { id: number; reference: string; created: string } | null; status: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [agree, setAgree] = useState(false);
  const { busy, errors, setErrors, run } = useAction();
  const send = async () => {
    const res = await run(() => requestDeactivationAction({ reason, confirm: agree }), "Request sent to MarchGear.");
    if (res) {
      setOpen(false);
      router.push(`/dealer/support/${res.ticketId}`);
    }
  };
  return (
    <section className="border border-line bg-white">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between md:p-7">
        <div className="flex gap-3">
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-red" />
          <div>
            <h2 className="text-[14px] font-semibold">Deactivate dealership</h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
              Sends a request to MarchGear&apos;s partner team as a support ticket. Nothing is switched off straight away: we confirm with you, settle any open invoices, and then hide your public page, listings and offers. Your data stays on record and the
              dealership can be reactivated later.
            </p>
            {openRequest && (
              <p className="mt-3 text-[13px]">
                <Badge tone="amber">Requested</Badge>{" "}
                <a href={`/dealer/support/${openRequest.id}`} className="ml-1 font-medium underline-offset-4 hover:underline">
                  Ticket {openRequest.reference}
                </a>{" "}
                <span className="text-muted">· sent {openRequest.created}</span>
              </p>
            )}
            {!isOwner && <p className="mt-3 text-[12.5px] text-muted">Only the dealer owner can ask for this.</p>}
          </div>
        </div>
        {isOwner && !openRequest && status !== "deactivated" && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-red/40 text-red hover:border-red hover:bg-red hover:text-white"
            onClick={() => {
              setErrors({});
              setOpen(true);
            }}
          >
            Request deactivation
          </Button>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Request deactivation" description="MarchGear will reply on a support ticket before anything changes." size="md">
        <div className="space-y-4 px-6 py-6 sm:px-8">
          <div>
            <label htmlFor="deact-reason" className="mb-1.5 block text-[12.5px] font-medium">
              Why are you leaving?
            </label>
            <textarea id="deact-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} className={cn(inputCls, "h-auto py-2.5 leading-relaxed")} aria-invalid={Boolean(errors.reason) || undefined} />
            <FieldError msg={errors.reason} />
          </div>
          <Check2 checked={agree} onChange={setAgree} label="I understand my public page, listings and offers will be hidden once MarchGear processes this request." />
          <FieldError msg={errors.confirm} />
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Keep my dealership
            </Button>
            <Button variant="primary" size="sm" onClick={send} disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
              Send request
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
