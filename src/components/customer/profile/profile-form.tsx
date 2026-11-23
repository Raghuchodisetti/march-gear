"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { updateProfileAction } from "@/server/actions/auth";
import { useUI, useUser } from "@/components/providers/app-provider";
import { Label, TextField } from "@/components/ui/field";
import { FormSection, SaveBar } from "@/components/portal/profile/kit";
import { StateCityFields } from "@/components/account/state-city-fields";
import { MOBILE_RE, mobileDigits } from "@/components/account/validation";

type Form = { name: string; mobile: string; state: string; city: string };
type Field = keyof Form;
const ORDER: Field[] = ["name", "mobile", "state", "city"];

/** Personal details on /account/profile. Saves through the same action as before and keeps the header's copy in step. */
export function ProfileForm({ initial, email }: { initial: Form; email: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const { update } = useUser();
  const [saved, setSaved] = useState<Form>({ ...initial, mobile: mobileDigits(initial.mobile) });
  const [form, setForm] = useState<Form>(saved);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [busy, setBusy] = useState(false);
  const dirty = ORDER.some((k) => form[k].trim() !== saved[k].trim());

  const set = (k: Field, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const focusFirst = (errs: Partial<Record<Field, string>>) => {
    const first = ORDER.find((k) => errs[k]);
    if (first) document.getElementById(`profile-${first}`)?.focus();
    return Boolean(first);
  };

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy || !dirty) return;
    const next: Partial<Record<Field, string>> = {
      name: form.name.trim().length >= 2 ? undefined : "Enter your full name",
      mobile: form.mobile && !MOBILE_RE.test(form.mobile) ? "Enter a valid 10-digit mobile number" : undefined,
      state: form.state ? undefined : "Choose your state",
      city: form.city.trim().length >= 2 ? undefined : "Enter your city",
    };
    setErrors(next);
    if (focusFirst(next)) return;

    setBusy(true);
    try {
      const res = await updateProfileAction({ name: form.name.trim().replace(/\s+/g, " "), phone: form.mobile, state: form.state, city: form.city.trim() });
      if (!res.ok) {
        const f = res.fieldErrors ?? {};
        const mapped = { name: f.name, mobile: f.phone, state: f.state, city: f.city };
        setErrors(mapped);
        if (!focusFirst(mapped)) toast(res.error ?? "We couldn't save your details. Please try again.", { tone: "error" });
        return;
      }
      const clean: Form = { name: res.user.name, mobile: res.user.phone ?? "", state: res.user.state ?? "", city: res.user.city ?? "" };
      setSaved(clean);
      setForm(clean);
      // The header and menus read the device's copy of the account.
      update({ name: clean.name, phone: clean.mobile, state: clean.state, city: clean.city });
      toast("Personal details saved", { tone: "success" });
      router.refresh();
    } catch {
      toast("Couldn't reach the server. Check your connection and try again.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form noValidate onSubmit={save} className="@container border border-line bg-white p-5 md:p-7">
      <FormSection title="Your name" description="Shown on enquiries and test-drive requests, and on reviews you write.">
        <TextField id="profile-name" label="Full name" autoComplete="name" value={form.name} error={errors.name} maxLength={120} onChange={(e) => set("name", e.target.value)} />
      </FormSection>

      <FormSection title="Contact" description="Pre-fills your enquiries, so dealers and insurers can reach you.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="profile-email">Sign-in email</Label>
            <div className="relative">
              <input
                id="profile-email"
                type="email"
                value={email}
                readOnly
                aria-describedby="profile-email-msg"
                className="h-12 w-full cursor-default truncate rounded-[3px] border border-line bg-mist px-4 pr-10 text-[15px] text-muted outline-none"
              />
              <Lock aria-hidden className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            </div>
            <p id="profile-email-msg" className="mt-1.5 text-xs text-muted">
              This is how you sign in, so it can&apos;t be changed here.
            </p>
          </div>
          <TextField
            id="profile-mobile"
            label="Mobile"
            type="tel"
            prefix="+91"
            inputMode="numeric"
            maxLength={10}
            autoComplete="tel-national"
            value={form.mobile}
            error={errors.mobile}
            hint={errors.mobile ? undefined : "Optional. Not verified by SMS — we don't send texts yet."}
            onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
          />
        </div>
      </FormSection>

      <FormSection title="Where you are" description="Sets on-road prices, nearby dealers and offers in your city.">
        <StateCityFields idPrefix="profile" state={form.state} city={form.city} onState={(v) => set("state", v)} onCity={(v) => set("city", v)} errors={{ state: errors.state, city: errors.city }} />
      </FormSection>

      <SaveBar busy={busy} dirty={dirty} onSave={() => save()} onReset={() => {
          setForm(saved);
          setErrors({});
        }} />
    </form>
  );
}
