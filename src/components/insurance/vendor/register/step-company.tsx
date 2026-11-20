"use client";

import { Building, Building2, Handshake, Landmark, Layers, UserRound, Users } from "lucide-react";
import { TextField } from "@/components/ui/field";
import { StateCityFields } from "@/components/account/state-city-fields";
import { AreaField, ChoiceCard, FieldError, FormSection, Grid } from "@/components/portal/register/controls";
import { INS_BUSINESS_TYPES, type InsBusinessType } from "@/db/enums";
import { INS_BUSINESS_TYPE_LABEL } from "@/insurance/labels";
import type { InsStepProps } from "./step-types";

const TYPE_INFO: Record<InsBusinessType, { icon: typeof Building; note: string }> = {
  public_limited: { icon: Building2, note: "Incorporated, may be listed" },
  private_limited: { icon: Building, note: "Incorporated company" },
  llp: { icon: Layers, note: "Limited liability partnership" },
  partnership: { icon: Handshake, note: "Registered firm" },
  proprietorship: { icon: UserRound, note: "Owned by one person" },
  government: { icon: Landmark, note: "Statutory body or PSU" },
  other: { icon: Users, note: "Society, trust or other" },
};

export function CompanyStep({ value, onChange, errors, clear }: InsStepProps<"company">) {
  const set = (patch: Partial<typeof value>, ...keys: string[]) => {
    onChange((prev) => ({ ...prev, ...patch }));
    clear(...keys);
  };

  return (
    <>
      <FormSection title="Legal entity" description="How your company is registered. We match these against your certificate of incorporation and GST registration.">
        <div role="radiogroup" aria-label="Business type" data-error={errors.businessType ? "true" : undefined}>
          <p className="mb-2 text-[12.5px] font-medium text-ink">Business type</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {INS_BUSINESS_TYPES.map((t) => {
              const Icon = TYPE_INFO[t].icon;
              return <ChoiceCard key={t} selected={value.businessType === t} onSelect={() => set({ businessType: t }, "businessType")} title={INS_BUSINESS_TYPE_LABEL[t]} description={TYPE_INFO[t].note} icon={<Icon className="size-4" aria-hidden />} />;
            })}
          </div>
          <FieldError>{errors.businessType}</FieldError>
        </div>
        <Grid className="mt-6">
          <TextField label="Legal name" autoComplete="organization" value={value.legalName} onChange={(e) => set({ legalName: e.target.value }, "legalName")} error={errors.legalName} hint="Exactly as on your certificate of incorporation." />
          <TextField label="Brand name" value={value.brandName} onChange={(e) => set({ brandName: e.target.value }, "brandName")} error={errors.brandName} hint="The name customers see on MarchGear." />
          <TextField
            label="Website (optional)"
            type="url"
            inputMode="url"
            value={value.website}
            onChange={(e) => set({ website: e.target.value }, "website")}
            error={errors.website}
            placeholder="https://yourcompany.in"
            className="md:col-span-2"
          />
        </Grid>
      </FormSection>

      <FormSection title="Registered office" description="The address on your certificate of incorporation. Branches customers can visit are added in step 5.">
        <div className="space-y-5">
          <AreaField label="Address" rows={2} value={value.address} onChange={(e) => set({ address: e.target.value }, "address")} error={errors.address} placeholder="Building, street, area, landmark" />
          <StateCityFields
            idPrefix="company"
            state={value.state}
            city={value.city}
            onState={(v) => set({ state: v }, "state", "city")}
            onCity={(v) => set({ city: v }, "city")}
            errors={{ state: errors.state, city: errors.city }}
            priceHint={false}
          />
          <div className="md:max-w-[calc(50%-10px)]">
            <TextField
              label="PIN code"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              value={value.pin}
              onChange={(e) => set({ pin: e.target.value.replace(/\D/g, "").slice(0, 6) }, "pin")}
              error={errors.pin}
              className="[&_input]:num"
            />
          </div>
        </div>
      </FormSection>
    </>
  );
}
