"use client";

import { TextField } from "@/components/ui/field";
import { FormSection, Grid, Note } from "@/components/portal/register/controls";
import { INS_CIN_LABEL, PATTERNS, gstStateName, normaliseCode, todayIST } from "@/insurance/schemas";
import type { InsStepProps } from "./step-types";

export function RegistrationStep({ app, value, onChange, errors, clear }: InsStepProps<"registration">) {
  const set = (patch: Partial<typeof value>, ...keys: string[]) => {
    onChange((prev) => ({ ...prev, ...patch }));
    clear(...keys);
  };
  const gst = normaliseCode(value.gstin);
  const state = PATTERNS.gst.test(gst) ? gstStateName(gst) : null;
  const panFromGst = PATTERNS.gst.test(gst) ? gst.slice(2, 12) : null;
  const cin = INS_CIN_LABEL[app.company.businessType];
  const stateMismatch = state && app.company.state && state !== app.company.state && !state.startsWith(app.company.state);

  return (
    <>
      <FormSection title="Tax registration" description="We check these against the GST certificate and PAN you upload in step 7.">
        <Grid>
          <TextField
            label="GSTIN"
            value={value.gstin}
            maxLength={15}
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => set({ gstin: normaliseCode(e.target.value).slice(0, 15) }, "gstin", "pan")}
            error={errors.gstin}
            hint={state ? `Registered in ${state}` : "15 characters, e.g. 27ABCDE1234F1Z5"}
            placeholder="27ABCDE1234F1Z5"
            className="[&_input]:font-mono [&_input]:tracking-[0.06em]"
          />
          <div>
            <TextField
              label="Company PAN"
              value={value.pan}
              maxLength={10}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => set({ pan: normaliseCode(e.target.value).slice(0, 10) }, "pan")}
              error={errors.pan}
              hint={!panFromGst || value.pan ? "Characters 3–12 of your GSTIN are your PAN." : undefined}
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
        {stateMismatch && (
          <Note tone="info" className="mt-5">
            This GSTIN is registered in {state}, but your registered office is in {app.company.state}. That&apos;s fine if you hold a separate GST registration there — otherwise check both.
          </Note>
        )}
      </FormSection>

      <FormSection title="Company registration" description="From your certificate of incorporation or registration.">
        <Grid>
          <TextField
            label={cin.label}
            value={value.cin}
            maxLength={40}
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => set({ cin: e.target.value.toUpperCase() }, "cin")}
            error={errors.cin}
            hint={app.company.businessType ? cin.hint : "Choose your business type in step 2 first — it decides which number we need."}
            className="[&_input]:font-mono [&_input]:tracking-[0.04em]"
          />
          <TextField label="Date of establishment" type="date" max={todayIST()} min="1850-01-01" value={value.establishedOn} onChange={(e) => set({ establishedOn: e.target.value }, "establishedOn")} error={errors.establishedOn} hint="The date on your certificate of incorporation." />
        </Grid>
      </FormSection>
    </>
  );
}
