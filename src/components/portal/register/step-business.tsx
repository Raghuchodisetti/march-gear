"use client";

import { Building, Building2, Handshake, UserRound } from "lucide-react";
import { TextField } from "@/components/ui/field";
import { BUSINESS_TYPES, type BusinessType } from "@/db/enums";
import { PATTERNS } from "@/partner/application";
import { BUSINESS_TYPE_LABEL } from "@/partner/labels";
import { gstState, normaliseCode, type WizardApplication } from "@/partner/schemas";
import { ChoiceCard, FieldError, FormSection, Grid } from "./controls";
import type { StepProps } from "./step-types";

type Business = WizardApplication["business"];

const TYPE_INFO: Record<BusinessType, { icon: typeof Building; note: string }> = {
  proprietorship: { icon: UserRound, note: "Owned by one person" },
  partnership: { icon: Handshake, note: "Registered partnership firm" },
  llp: { icon: Building, note: "Limited liability partnership" },
  private_limited: { icon: Building2, note: "Private limited company" },
};

export const REGISTRATION_LABEL: Record<BusinessType | "", { label: string; hint: string; required: boolean }> = {
  "": { label: "Registration number", hint: "CIN, LLPIN or firm registration number.", required: true },
  proprietorship: { label: "Registration number (optional)", hint: "Shop & establishment or Udyam registration number, if you have one.", required: false },
  partnership: { label: "Firm registration number", hint: "As on your partnership registration certificate.", required: true },
  llp: { label: "LLPIN", hint: "Your LLP identification number, e.g. AAB-1234.", required: true },
  private_limited: { label: "CIN", hint: "Corporate identity number, e.g. U50100AP2015PTC012345.", required: true },
};

const today = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

export function BusinessStep({ value, onChange, errors, clear }: StepProps<"business">) {
  const set = (patch: Partial<Business>, ...keys: string[]) => {
    onChange({ ...value, ...patch });
    clear(...keys);
  };
  const gst = normaliseCode(value.gst);
  const state = PATTERNS.gst.test(gst) ? gstState(gst) : null;
  const panFromGst = PATTERNS.gst.test(gst) ? gst.slice(2, 12) : null;
  const reg = REGISTRATION_LABEL[value.businessType];

  return (
    <>
      <FormSection title="Legal entity" description="How your dealership is registered.">
        <div role="radiogroup" aria-label="Business type" data-error={errors.businessType ? "true" : undefined}>
          <p className="mb-2 text-[12.5px] font-medium text-ink">Business type</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {BUSINESS_TYPES.map((t) => {
              const Icon = TYPE_INFO[t].icon;
              return <ChoiceCard key={t} selected={value.businessType === t} onSelect={() => set({ businessType: t }, "businessType", "registrationNumber")} title={BUSINESS_TYPE_LABEL[t]} description={TYPE_INFO[t].note} icon={<Icon className="size-4" aria-hidden />} />;
            })}
          </div>
          <FieldError>{errors.businessType}</FieldError>
        </div>
        <Grid className="mt-6">
          <TextField label="Legal name" value={value.legalName} onChange={(e) => set({ legalName: e.target.value }, "legalName")} error={errors.legalName} hint="Exactly as on your GST certificate." autoComplete="organization" />
          <TextField label="Trade name (optional)" value={value.tradeName} onChange={(e) => set({ tradeName: e.target.value }, "tradeName")} error={errors.tradeName} hint="The name customers know you by, if different." />
          <TextField label={reg.label} value={value.registrationNumber} onChange={(e) => set({ registrationNumber: e.target.value }, "registrationNumber")} error={errors.registrationNumber} hint={reg.hint} />
          <TextField label="Date of establishment" type="date" max={today()} min="1900-01-01" value={value.establishedOn} onChange={(e) => set({ establishedOn: e.target.value }, "establishedOn")} error={errors.establishedOn} />
        </Grid>
      </FormSection>

      <FormSection title="Tax registration" description="We check these against your uploaded certificates.">
        <Grid>
          <TextField
            label="GSTIN"
            value={value.gst}
            maxLength={15}
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => set({ gst: normaliseCode(e.target.value).slice(0, 15) }, "gst", "pan")}
            error={errors.gst}
            hint={state ? `Registered in ${state}` : "15 characters, e.g. 37ABCDE1234F1Z5"}
            placeholder="37ABCDE1234F1Z5"
            className="[&_input]:font-mono [&_input]:tracking-[0.06em]"
          />
          <div>
            <TextField
              label="PAN"
              value={value.pan}
              maxLength={10}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => set({ pan: normaliseCode(e.target.value).slice(0, 10) }, "pan")}
              error={errors.pan}
              hint={!panFromGst || value.pan ? "The business PAN (the proprietor's PAN for a proprietorship)." : undefined}
              placeholder="ABCDE1234F"
              className="[&_input]:font-mono [&_input]:tracking-[0.06em]"
            />
            {panFromGst && !value.pan && !errors.pan && (
              <button type="button" onClick={() => set({ pan: panFromGst }, "pan")} className="mt-1.5 text-xs font-medium text-ink underline underline-offset-4 hover:text-red">
                Use {panFromGst} from your GSTIN
              </button>
            )}
          </div>
        </Grid>
      </FormSection>

      <FormSection title="Business contact" description="Official contact details for the dealership (not your personal ones).">
        <Grid>
          <TextField label="Business email" type="email" value={value.email} onChange={(e) => set({ email: e.target.value }, "email")} error={errors.email} placeholder="sales@yourdealership.in" />
          <TextField label="Business phone" type="tel" value={value.phone} onChange={(e) => set({ phone: e.target.value }, "phone")} error={errors.phone} placeholder="0891 234 5678" hint="Landline with STD code, or a mobile number." />
          <TextField label="Website (optional)" type="url" inputMode="url" value={value.website} onChange={(e) => set({ website: e.target.value }, "website")} error={errors.website} placeholder="https://yourdealership.in" className="md:col-span-2" />
        </Grid>
      </FormSection>
    </>
  );
}
