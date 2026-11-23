"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { userStore, wishlistStore } from "@/lib/store";
import { deleteAccountAction } from "@/server/actions/customer-account";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { FieldError, inputCls } from "@/components/portal/profile/kit";

/** Danger zone: delete the account after typing DELETE and the password, then sign out and go home. */
export function DeleteAccount({ email }: { email: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const typed = confirm.trim() === "DELETE";

  const close = () => {
    if (busy) return;
    setOpen(false);
    setConfirm("");
    setPassword("");
    setErrors({});
    setFormError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const local: Record<string, string> = {};
    if (!typed) local.confirm = "Type DELETE in capital letters to confirm";
    if (!password) local.password = "Enter your password";
    setErrors(local);
    setFormError(null);
    if (Object.keys(local).length) return document.getElementById(local.confirm ? "del-confirm" : "del-password")?.focus();

    setBusy(true);
    try {
      const res = await deleteAccountAction({ confirm: confirm.trim(), password });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (res.fieldErrors?.password) document.getElementById("del-password")?.focus();
        else setFormError(res.error ?? "We couldn't delete your account. Please try again.");
        setBusy(false);
        return;
      }
      // Signed out on the server — forget the account copy on this device too.
      userStore.set(null);
      wishlistStore.set({ cars: [], used: [] });
      toast("Your account has been deleted");
      router.push("/");
      router.refresh();
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" icon={<Trash2 aria-hidden className="size-4" />} onClick={() => setOpen(true)} className="border-red/40 text-red hover:border-red hover:bg-red hover:text-white">
        Delete my account
      </Button>
      <Modal open={open} onClose={close} title="Delete your account?" description="This can't be undone." size="sm">
        <form noValidate onSubmit={submit} className="space-y-5 px-6 py-6 sm:px-8">
          <p className="text-[13.5px] leading-relaxed text-muted">
            Your profile, saved cars, garage, notifications and every sign-in for <span className="font-medium text-ink">{email}</span> are deleted straight away. Requests you&apos;ve
            already sent stay with the businesses handling them, without a link to an account.
          </p>
          {formError && (
            <p role="alert" className="border-l-2 border-red bg-red-50 px-3 py-2.5 text-[13px] text-red">
              {formError}
            </p>
          )}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          <div>
            <label htmlFor="del-confirm" className="mb-1.5 block text-[12.5px] font-medium">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </label>
            <input
              id="del-confirm"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (errors.confirm) setErrors({ ...errors, confirm: "" });
              }}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              data-autofocus
              className={inputCls}
              aria-invalid={Boolean(errors.confirm) || undefined}
            />
            <FieldError msg={errors.confirm} />
          </div>
          <div>
            <label htmlFor="del-password" className="mb-1.5 block text-[12.5px] font-medium">
              Your password
            </label>
            <input
              id="del-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: "" });
              }}
              autoComplete="current-password"
              className={inputCls}
              aria-invalid={Boolean(errors.password) || undefined}
            />
            <FieldError msg={errors.password} />
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <Button variant="ghost" size="sm" onClick={close} disabled={busy}>
              Keep my account
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={busy || !typed} icon={busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Trash2 aria-hidden className="size-4" />}>
              Delete account
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
