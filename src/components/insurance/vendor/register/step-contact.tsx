"use client";

import { TextField } from "@/components/ui/field";
import { FormSection, Grid, Note } from "@/components/portal/register/controls";
import { normaliseMobile } from "@/insurance/schemas";
import type { InsStepProps } from "./step-types";
import { InsVerifyField } from "./verify-field";

export function ContactStep({ value, onChange, errors, clear, otp, onVerified }: InsStepProps<"contact"> & { otp: "screen" | "none"; onVerified: (channel: "mobile" | "email", target: string) => void }) {
  const set = (patch: Partial<typeof value>, ...keys: string[]) => {
    onChange((prev) => ({ ...prev, ...patch }));
    clear(...keys);
  };

  return (
    <>
      <FormSection title="Contact person" description="The person MarchGear's vendor team will contact about this application — usually someone in distribution, partnerships or compliance.">
        <Grid>
          <TextField label="Full name" autoComplete="name" value={value.name} onChange={(e) => set({ name: e.target.value }, "name")} error={errors.name} placeholder="As on their PAN card" />
          <TextField
            label="Designation"
            autoComplete="organization-title"
            value={value.designation}
            onChange={(e) => set({ designation: e.target.value }, "designation")}
            error={errors.designation}
            placeholder="e.g. Head of Digital Distribution"
          />
          <div className="md:col-span-2">
            <InsVerifyField
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
            <InsVerifyField
              channel="email"
              label="Work email"
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
      <Note tone="info" title="Who signs the declaration">
        The contact person types their name to sign the declaration in step 7. The authorised representative named under your regulatory registration is added in step 4 — it can be the same person.
      </Note>
    </>
  );
}
