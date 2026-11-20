"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/field";
import { ImageUploader } from "@/components/portal/uploader";
import { normaliseMobile, type WizardApplication } from "@/partner/schemas";
import { Checkbox, FormSection, Grid } from "./controls";
import type { StepProps } from "./step-types";
import { VerifyField } from "./verify-field";

type Personal = WizardApplication["personal"];

const sameAs = (p: Personal) => {
  const c = p.authorizedContact;
  return Boolean(c.name) && c.name === p.fullName && c.designation === p.designation && normaliseMobile(c.mobile) === normaliseMobile(p.mobile) && c.email === p.email;
};

export function PersonalStep({ value, onChange, errors, clear, otp, onVerified }: StepProps<"personal"> & { otp: "screen" | "none"; onVerified: (channel: "mobile" | "email", target: string) => void }) {
  const [mirror, setMirror] = useState(() => sameAs(value));
  const contact = value.authorizedContact;

  const set = (patch: Partial<Personal>, ...keys: string[]) => {
    const next = { ...value, ...patch };
    if (mirror) next.authorizedContact = { name: next.fullName, designation: next.designation, mobile: next.mobile, email: next.email };
    onChange(next);
    clear(...keys, ...(mirror ? ["authorizedContact"] : []));
  };
  const setContact = (patch: Partial<Personal["authorizedContact"]>, key: string) => {
    onChange({ ...value, authorizedContact: { ...contact, ...patch } });
    clear(`authorizedContact.${key}`);
  };

  return (
    <>
      <FormSection title="About you" description="The person completing this application on behalf of the dealership.">
        <Grid>
          <TextField label="Full name" autoComplete="name" value={value.fullName} onChange={(e) => set({ fullName: e.target.value }, "fullName")} error={errors.fullName} placeholder="As on your PAN card" />
          <TextField label="Designation" autoComplete="organization-title" value={value.designation} onChange={(e) => set({ designation: e.target.value }, "designation")} error={errors.designation} placeholder="e.g. Managing Director" />
          <div className="md:col-span-2">
            <VerifyField
              channel="mobile"
              label="Mobile number"
              value={value.mobile}
              verified={value.mobileVerified}
              mode={otp}
              onChange={(v) => set({ mobile: v, mobileVerified: value.mobileVerified && normaliseMobile(v) === normaliseMobile(value.mobile) }, "mobile")}
              onVerified={(t) => onVerified("mobile", t)}
              error={errors.mobile}
            />
          </div>
          <div className="md:col-span-2">
            <VerifyField
              channel="email"
              label="Email"
              value={value.email}
              verified={value.emailVerified}
              mode={otp}
              required={false}
              onChange={(v) => set({ email: v, emailVerified: value.emailVerified && v.trim().toLowerCase() === value.email.trim().toLowerCase() }, "email")}
              onVerified={(t) => onVerified("email", t)}
              error={errors.email}
            />
          </div>
        </Grid>
      </FormSection>

      <FormSection title="Profile photograph" description="A clear, recent, front-facing photo. Our partner team uses it to identify you — it isn't shown on your public listing.">
        <div className="max-w-[220px]" data-error={errors.photo ? "true" : undefined}>
          <ImageUploader value={value.photo ? [value.photo] : []} onChange={(urls) => set({ photo: urls[0] ?? "" }, "photo")} label="Upload photograph" aspect="aspect-square" error={errors.photo} />
        </div>
      </FormSection>

      <FormSection title="Authorised contact person" description="Who our team should contact about this application and, later, your account.">
        <Checkbox
          checked={mirror}
          onChange={(on) => {
            setMirror(on);
            if (on) {
              onChange({ ...value, authorizedContact: { name: value.fullName, designation: value.designation, mobile: value.mobile, email: value.email } });
              clear("authorizedContact");
            }
          }}
          label="I'm the authorised contact person"
          description="Use my name, designation, mobile and email."
        />
        {!mirror && (
          <Grid className="mt-6 animate-rise">
            <TextField label="Name" value={contact.name} onChange={(e) => setContact({ name: e.target.value }, "name")} error={errors["authorizedContact.name"]} />
            <TextField label="Designation (optional)" value={contact.designation} onChange={(e) => setContact({ designation: e.target.value }, "designation")} placeholder="e.g. General Manager" />
            <TextField
              label="Mobile number"
              type="tel"
              inputMode="numeric"
              prefix="+91"
              value={contact.mobile}
              onChange={(e) => setContact({ mobile: e.target.value }, "mobile")}
              error={errors["authorizedContact.mobile"]}
              placeholder="98480 12345"
            />
            <TextField label="Email" type="email" value={contact.email} onChange={(e) => setContact({ email: e.target.value }, "email")} error={errors["authorizedContact.email"]} />
          </Grid>
        )}
        {mirror && (errors["authorizedContact.name"] || errors["authorizedContact.mobile"] || errors["authorizedContact.email"]) && (
          <p className="mt-3 text-xs text-red">Complete your own details above — they&apos;re used for the contact person too.</p>
        )}
      </FormSection>
    </>
  );
}
