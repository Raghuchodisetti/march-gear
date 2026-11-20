"use client";

import { useState } from "react";
import { Landmark, LockKeyhole, ShieldCheck } from "lucide-react";
import { TextField } from "@/components/ui/field";
import { InsDocumentUploader } from "@/components/insurance/vendor/uploader";
import { FormSection, Grid, Note } from "@/components/portal/register/controls";
import { PATTERNS, digitsOnly, normaliseCode, type InsBankMeta } from "@/insurance/schemas";
import { bankFromIfsc } from "@/partner/schemas";
import { ReviewLine } from "./file-list";
import type { InsStepProps } from "./step-types";

export function BankStep({ app, value, onChange, errors, clear, bank, reviews }: InsStepProps<"bank"> & { bank: InsBankMeta }) {
  const [changing, setChanging] = useState(false);
  const set = (patch: Partial<typeof value>, ...keys: string[]) => {
    onChange((prev) => ({ ...prev, ...patch }));
    clear(...keys);
  };
  const ifsc = normaliseCode(value.ifsc);
  const derived = bankFromIfsc(ifsc);
  const typing = Boolean(value.accountNumber || value.accountNumberConfirm);
  const showInputs = !bank.hasAccount || changing || typing || Boolean(errors.accountNumber || errors.accountNumberConfirm);
  const typed = digitsOnly(value.accountNumber);
  const pendingSave = typing && !(PATTERNS.account.test(typed) && typed === digitsOnly(value.accountNumberConfirm));
  const legal = app.company.legalName.trim();

  return (
    <>
      <FormSection title="Bank account" description="A current account in the company's name. MarchGear uses it to verify your company and for refunds of anything you've paid MarchGear.">
        <Grid>
          <div className="md:col-span-2">
            <TextField label="Account holder name" value={value.holder} onChange={(e) => set({ holder: e.target.value }, "holder")} error={errors.holder} hint="Exactly as printed on the cheque or statement." />
            {legal && !value.holder && (
              <button type="button" onClick={() => set({ holder: legal }, "holder")} className="mt-1.5 text-xs font-medium text-ink underline underline-offset-4 hover:text-red">
                Use {legal}
              </button>
            )}
          </div>

          <div className="md:col-span-2">
            {bank.hasAccount && !showInputs ? (
              <div className="flex flex-col gap-3 border border-line bg-[#FAFAFA] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-[3px] bg-white text-ink shadow-soft">
                    <LockKeyhole aria-hidden className="size-4" />
                  </span>
                  <div>
                    <p className="text-[12px] text-muted">Account number · saved securely</p>
                    <p className="font-mono text-[15px] tracking-[0.12em]" data-testid="masked-account">
                      {bank.masked}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setChanging(true)} className="self-start text-[13px] font-medium text-ink underline underline-offset-4 hover:text-red sm:self-auto">
                  Replace account number
                </button>
              </div>
            ) : (
              <Grid className="animate-rise">
                <TextField
                  label={bank.hasAccount ? "New account number" : "Account number"}
                  inputMode="numeric"
                  autoComplete="off"
                  value={value.accountNumber}
                  onChange={(e) => set({ accountNumber: e.target.value.replace(/[^\d\s]/g, "").slice(0, 22) }, "accountNumber", "accountNumberConfirm")}
                  error={errors.accountNumber}
                  className="[&_input]:font-mono [&_input]:tracking-[0.08em]"
                  hint={bank.hasAccount ? `Currently ${bank.masked}. Leave both fields empty to keep it.` : "9 to 18 digits."}
                />
                <TextField
                  label="Confirm account number"
                  inputMode="numeric"
                  autoComplete="off"
                  value={value.accountNumberConfirm}
                  onChange={(e) => set({ accountNumberConfirm: e.target.value.replace(/[^\d\s]/g, "").slice(0, 22) }, "accountNumberConfirm")}
                  onPaste={(e) => e.preventDefault()}
                  error={errors.accountNumberConfirm}
                  className="[&_input]:font-mono [&_input]:tracking-[0.08em]"
                  hint="Type it again — pasting is disabled here."
                />
                {(pendingSave || (bank.hasAccount && changing && !typing)) && (
                  <p className="text-[12px] text-muted md:col-span-2">
                    {pendingSave ? "The account number is saved once both entries match. " : null}
                    {bank.hasAccount && changing && !typing && (
                      <button type="button" onClick={() => setChanging(false)} className="font-medium text-ink underline underline-offset-4 hover:text-red">
                        Keep {bank.masked}
                      </button>
                    )}
                  </p>
                )}
              </Grid>
            )}
          </div>

          <div>
            <TextField
              label="IFSC"
              value={value.ifsc}
              maxLength={11}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => {
                const v = normaliseCode(e.target.value).slice(0, 11);
                const name = bankFromIfsc(v);
                const fill = Boolean(name && !value.bankName.trim());
                set({ ifsc: v, ...(fill ? { bankName: name! } : {}) }, "ifsc", ...(fill ? ["bankName"] : []));
              }}
              error={errors.ifsc}
              placeholder="HDFC0001234"
              hint={derived ? undefined : "11 characters — on your cheque leaf or statement."}
              className="[&_input]:font-mono [&_input]:tracking-[0.06em]"
            />
            {derived && !errors.ifsc && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[#1e7a3c]">
                <Landmark aria-hidden className="size-3.5" /> {derived} (from the IFSC)
              </p>
            )}
            {PATTERNS.ifsc.test(ifsc) && !derived && !errors.ifsc && <p className="mt-1.5 text-xs text-muted">Valid format. We couldn&apos;t name the bank offline — type it alongside.</p>}
          </div>
          <TextField label="Bank name" value={value.bankName} onChange={(e) => set({ bankName: e.target.value }, "bankName")} error={errors.bankName} placeholder="e.g. HDFC Bank" />
        </Grid>
      </FormSection>

      <FormSection title="Bank proof" description="A cancelled cheque leaf, or a bank statement from the last three months, showing the account holder's name, account number and IFSC.">
        <div className="md:max-w-[calc(50%-12px)]" data-error={errors.proof ? "true" : undefined}>
          <InsDocumentUploader kind="bank_proof" value={value.proof} onChange={(f) => set({ proof: f }, "proof")} label="Cancelled cheque or bank statement" error={errors.proof} required />
          {!errors.proof && <ReviewLine review={value.proof ? reviews[value.proof.id] : undefined} />}
        </div>
      </FormSection>

      <Note tone="info" title="How we protect your bank details">
        <span className="inline-flex items-start gap-2">
          <ShieldCheck aria-hidden className="mt-0.5 hidden size-4 shrink-0 sm:block" />
          The account number is encrypted (AES-256) before it&apos;s stored and is never sent back to your browser — you only ever see the last four digits. To change it, type the new number twice; it replaces the old one.
        </span>
      </Note>
    </>
  );
}
