"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, CircleAlert, UserRound } from "lucide-react";
import { updatePrimaryContactAction } from "@/server/actions/partner-profile";
import { ImageUploader } from "@/components/portal/uploader";
import { FieldError, FormSection, SaveBar, inputCls, useAction } from "./kit";

export interface PrimaryContact {
  fullName: string;
  designation: string;
  mobile: string;
  mobileVerified: boolean;
  email: string;
  emailVerified: boolean;
  photo: string;
}

export function PrimaryContactForm({ initial, editable }: { initial: PrimaryContact; editable: boolean }) {
  const router = useRouter();
  const pick = (c: PrimaryContact) => ({ fullName: c.fullName, designation: c.designation, mobile: c.mobile, photo: c.photo });
  const [v, setV] = useState(pick(initial));
  const [saved, setSaved] = useState(JSON.stringify(pick(initial)));
  const { busy, errors, run } = useAction();
  const dirty = JSON.stringify(v) !== saved;

  const save = async () => {
    const res = await run(() => updatePrimaryContactAction(v), "Primary contact updated.");
    if (res) {
      setSaved(JSON.stringify(v));
      router.refresh();
    }
  };

  if (!editable) {
    return (
      <div className="border border-line bg-white p-5 md:p-7">
        <div className="flex items-center gap-4">
          <span className="inline-flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-mist">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {initial.photo ? <img src={initial.photo} alt="" className="size-full object-cover" /> : <UserRound aria-hidden className="size-7 text-muted" />}
          </span>
          <div className="min-w-0">
            <p className="text-[16px] font-semibold">{initial.fullName}</p>
            <p className="text-[13px] text-muted">{initial.designation || "Dealer owner"}</p>
            <p className="mt-1 text-[13px]">
              {initial.email} · {initial.mobile}
            </p>
          </div>
        </div>
        <p className="mt-5 border-t border-line pt-4 text-[13px] text-muted">Only the dealer owner can change the primary contact. You can update your own name and mobile under Settings → Account.</p>
      </div>
    );
  }

  return (
    <div className="@container border border-line bg-white p-5 md:p-7">
      <FormSection title="Photo" description="A friendly face for MarchGear's partner team.">
        <div className="max-w-[160px]">
          <ImageUploader value={v.photo ? [v.photo] : []} onChange={(u) => setV((p) => ({ ...p, photo: u[0] ?? "" }))} label="Upload photo" aspect="aspect-square" error={errors.photo} />
        </div>
      </FormSection>
      <FormSection title="Contact details" description="The dealership's primary contact with MarchGear. Your sign-in name and mobile update too.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pc-name" className="mb-1.5 block text-[12.5px] font-medium">
              Full name
            </label>
            <input id="pc-name" value={v.fullName} onChange={(e) => setV((p) => ({ ...p, fullName: e.target.value }))} autoComplete="name" className={inputCls} aria-invalid={Boolean(errors.fullName) || undefined} />
            <FieldError msg={errors.fullName} />
          </div>
          <div>
            <label htmlFor="pc-designation" className="mb-1.5 block text-[12.5px] font-medium">
              Designation
            </label>
            <input id="pc-designation" value={v.designation} onChange={(e) => setV((p) => ({ ...p, designation: e.target.value }))} placeholder="Managing Director" className={inputCls} aria-invalid={Boolean(errors.designation) || undefined} />
            <FieldError msg={errors.designation} />
          </div>
          <div>
            <label htmlFor="pc-mobile" className="mb-1.5 block text-[12.5px] font-medium">
              Mobile
            </label>
            <input id="pc-mobile" value={v.mobile} onChange={(e) => setV((p) => ({ ...p, mobile: e.target.value }))} inputMode="tel" autoComplete="tel" className={inputCls} aria-invalid={Boolean(errors.mobile) || undefined} />
            <FieldError msg={errors.mobile} />
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
              {initial.mobileVerified && v.mobile === initial.mobile ? (
                <>
                  <BadgeCheck aria-hidden className="size-3.5 text-ink" /> Verified by OTP
                </>
              ) : (
                <>
                  <CircleAlert aria-hidden className="size-3.5" /> {v.mobile === initial.mobile ? "Not verified" : "A new number is saved as unverified"}
                </>
              )}
            </p>
          </div>
          <div>
            <label htmlFor="pc-email" className="mb-1.5 block text-[12.5px] font-medium">
              Email
            </label>
            <input id="pc-email" value={initial.email} disabled className={inputCls} />
            <p className="mt-1.5 text-xs text-muted">Your sign-in email. Contact MarchGear support to change it.</p>
          </div>
        </div>
      </FormSection>
      <SaveBar busy={busy} dirty={dirty} onSave={save} onReset={() => setV(JSON.parse(saved))} />
    </div>
  );
}
