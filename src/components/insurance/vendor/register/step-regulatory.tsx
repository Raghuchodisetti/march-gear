"use client";

import { useState } from "react";
import { BadgeCheck, Briefcase, Building2, Globe, Megaphone, Network, Users } from "lucide-react";
import { SelectField, TextField } from "@/components/ui/field";
import { ChoiceCard, FieldError, FormSection, Grid, Note } from "@/components/portal/register/controls";
import { INS_VENDOR_CATEGORIES, type InsVendorCategory } from "@/db/enums";
import { INS_VENDOR_CATEGORY_LABEL } from "@/insurance/labels";
import { INS_CATEGORY_BLURB, INS_LICENCE_LABEL, INS_MAX_SUPPORTING, INS_REGISTRATION_TYPES, todayIST } from "@/insurance/schemas";
import { FileList } from "./file-list";
import type { InsStepProps } from "./step-types";

const ICON: Record<InsVendorCategory, typeof Building2> = {
  insurer: Building2,
  broker: Briefcase,
  corporate_agent: Users,
  web_aggregator: Globe,
  imf: Megaphone,
  other_intermediary: Network,
};

const OTHER = "__other";

export function RegulatoryStep({ app, value, onChange, errors, clear, reviews }: InsStepProps<"regulatory">) {
  const set = (patch: Partial<typeof value>, ...keys: string[]) => {
    onChange((prev) => ({ ...prev, ...patch }));
    clear(...keys);
  };
  const rep = value.representative;
  const setRep = (patch: Partial<typeof rep>, key: string) => {
    onChange((prev) => ({ ...prev, representative: { ...prev.representative, ...patch } }));
    clear(`representative.${key}`);
  };
  const options = value.category ? INS_REGISTRATION_TYPES[value.category] : [];
  const [other, setOther] = useState(() => Boolean(value.registrationType) && !options.includes(value.registrationType));
  const typing = other || (value.category !== "" && options.length === 0);
  const contact = app.contact;
  const sameAsContact = Boolean(rep.name) && rep.name === contact.name && rep.email === contact.email && rep.mobile === contact.mobile && rep.designation === contact.designation;

  return (
    <>
      <FormSection title="Category" description="What kind of regulated entity you are. Only insurers underwrite; intermediaries distribute insurers' products.">
        <div role="radiogroup" aria-label="Category" data-error={errors.category ? "true" : undefined}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INS_VENDOR_CATEGORIES.map((c) => {
              const Icon = ICON[c];
              return (
                <ChoiceCard
                  key={c}
                  selected={value.category === c}
                  onSelect={() => {
                    const keep = INS_REGISTRATION_TYPES[c].includes(value.registrationType) || (other && value.registrationType);
                    set({ category: c, registrationType: keep ? value.registrationType : (INS_REGISTRATION_TYPES[c][0] ?? "") }, "category", "registrationType");
                    if (!keep) setOther(false);
                  }}
                  title={INS_VENDOR_CATEGORY_LABEL[c]}
                  description={INS_CATEGORY_BLURB[c]}
                  icon={<Icon className="size-4" aria-hidden />}
                />
              );
            })}
          </div>
          <FieldError>{errors.category}</FieldError>
        </div>
      </FormSection>

      <FormSection title="Regulatory registration" description="As printed on your certificate of registration. MarchGear verifies it with the regulator's public records before approval.">
        <Grid>
          <div className="md:col-span-2">
            {options.length > 0 && (
              <SelectField
                label="Registration type"
                value={other ? OTHER : value.registrationType}
                onChange={(e) => {
                  if (e.target.value === OTHER) {
                    setOther(true);
                    set({ registrationType: "" }, "registrationType");
                  } else {
                    setOther(false);
                    set({ registrationType: e.target.value }, "registrationType");
                  }
                }}
                error={typing ? undefined : errors.registrationType}
                placeholder="Choose the registration you hold"
                options={[...options.map((o) => ({ value: o, label: o })), { value: OTHER, label: "Another registration type…" }]}
              />
            )}
            {(typing || !value.category) && (
              <TextField
                className={options.length > 0 ? "mt-3" : undefined}
                label={options.length > 0 ? "Type the registration you hold" : "Registration type"}
                value={value.registrationType}
                disabled={!value.category}
                onChange={(e) => set({ registrationType: e.target.value }, "registrationType")}
                error={errors.registrationType}
                placeholder={value.category ? "As described on your certificate" : "Choose your category first"}
              />
            )}
          </div>
          <TextField
            label={INS_LICENCE_LABEL[value.category]}
            value={value.licenceNumber}
            maxLength={60}
            spellCheck={false}
            onChange={(e) => set({ licenceNumber: e.target.value }, "licenceNumber")}
            error={errors.licenceNumber}
            hint="Exactly as on the certificate."
            className="[&_input]:font-mono [&_input]:tracking-[0.04em]"
          />
          <TextField
            label="Valid until"
            type="date"
            min={todayIST()}
            value={value.licenceValidUntil}
            onChange={(e) => set({ licenceValidUntil: e.target.value }, "licenceValidUntil")}
            error={errors.licenceValidUntil}
            hint="Must be a future date."
          />
        </Grid>
      </FormSection>

      <FormSection
        title="Authorised representative"
        description="The person named on your registration as responsible for it — e.g. the principal officer of a broker or corporate agent, or the insurer's designated officer."
        action={
          contact.name && !sameAsContact ? (
            <button
              type="button"
              onClick={() => {
                onChange((prev) => ({ ...prev, representative: { name: contact.name, designation: contact.designation, mobile: contact.mobile, email: contact.email } }));
                clear("representative");
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-[3px] border border-line px-3 text-[13px] font-medium transition-colors hover:border-ink"
            >
              <BadgeCheck aria-hidden className="size-4" /> Same as contact person
            </button>
          ) : undefined
        }
      >
        <Grid>
          <TextField label="Name" value={rep.name} onChange={(e) => setRep({ name: e.target.value }, "name")} error={errors["representative.name"]} />
          <TextField label="Designation" value={rep.designation} onChange={(e) => setRep({ designation: e.target.value }, "designation")} error={errors["representative.designation"]} placeholder="e.g. Principal Officer" />
          <TextField
            label="Mobile number"
            type="tel"
            inputMode="numeric"
            prefix="+91"
            value={rep.mobile}
            onChange={(e) => setRep({ mobile: e.target.value }, "mobile")}
            error={errors["representative.mobile"]}
            placeholder="98480 12345"
          />
          <TextField label="Email" type="email" value={rep.email} onChange={(e) => setRep({ email: e.target.value }, "email")} error={errors["representative.email"]} />
        </Grid>
        <p className="mt-4 text-[12.5px] text-muted">Their ID proof and a board resolution or authorisation letter are uploaded in step 7.</p>
      </FormSection>

      <FormSection title="Supporting regulatory documents" description={`Optional — renewal acknowledgements, endorsements or the regulator's correspondence that helps us verify you. Up to ${INS_MAX_SUPPORTING}. The certificate itself is uploaded in step 7.`}>
        <FileList
          kind="regulatory_licence"
          files={value.documents}
          onChange={(documents) => {
            onChange((prev) => ({ ...prev, documents }));
            clear("documents");
          }}
          errors={errors}
          errorKey="documents"
          reviews={reviews}
          addLabel="Add regulatory documents"
        />
      </FormSection>

      {value.category && value.category !== "insurer" && (
        <Note tone="info" title="Intermediaries">
          You&apos;ll list products of the insurers you work with. Each product needs that insurer&apos;s authorisation or tie-up letter when you submit it for approval.
        </Note>
      )}
    </>
  );
}
