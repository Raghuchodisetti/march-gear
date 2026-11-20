"use client";

import Link from "next/link";
import { TextField } from "@/components/ui/field";
import type { InsDocKind } from "@/db/enums";
import { InsDocumentUploader } from "@/components/insurance/vendor/uploader";
import { Checkbox, FormSection } from "@/components/portal/register/controls";
import { INS_REQUIRED_DOCUMENTS } from "@/insurance/application";
import { INS_VENDOR_CATEGORY_LABEL } from "@/insurance/labels";
import { INS_MAX_SUPPORTING, type FieldErrors, type FileReview, type InsBankMeta, type InsWizardApplication } from "@/insurance/schemas";
import type { InsStepKey } from "@/insurance/application";
import { FileList, ReviewLine } from "./file-list";
import { ReviewSummary } from "./review";

type Docs = InsWizardApplication["documents"];
type Declaration = InsWizardApplication["declaration"];

const HINT: Record<(typeof INS_REQUIRED_DOCUMENTS)[number]["key"], string> = {
  businessRegistration: "Certificate of incorporation, LLP certificate or firm registration.",
  gst: "Form GST REG-06, all pages.",
  pan: "The company's PAN card.",
  regulatory: "Your current certificate of registration or licence, showing its validity.",
  addressProof: "Utility bill, lease or property tax receipt for the registered office — under 3 months old.",
  representativeId: "PAN, passport, driving licence or masked Aadhaar of the authorised representative.",
  representativeAuthorisation: "On letterhead, signed by a director or partner, naming the representative.",
};

export function DocumentsStep({
  app,
  documents,
  declaration,
  onDocuments,
  onDeclaration,
  errors,
  clear,
  reviews,
  bank,
  checks,
  onEdit,
  signedOn,
}: {
  app: InsWizardApplication;
  documents: Docs;
  declaration: Declaration;
  onDocuments: (fn: (prev: Docs) => Docs) => void;
  onDeclaration: (fn: (prev: Declaration) => Declaration) => void;
  errors: FieldErrors;
  clear: (...keys: string[]) => void;
  reviews: Record<number, FileReview>;
  bank: InsBankMeta;
  checks: { key: InsStepKey; title: string; errors: FieldErrors }[];
  onEdit: (key: InsStepKey) => void;
  signedOn: string;
}) {
  const company = app.company.legalName.trim() || "the company";
  const contact = app.contact.name.trim();

  return (
    <>
      <FormSection id="required-documents" className="scroll-mt-24" title="Required documents" description="Clear scans or photos — PDF, JPEG, PNG or WebP, up to 900 KB each. Documents are private: only your team and MarchGear's verification team can open them.">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {INS_REQUIRED_DOCUMENTS.map((d) => (
            <div key={d.key} data-error={errors[d.key] ? "true" : undefined}>
              <InsDocumentUploader
                kind={d.kind as InsDocKind}
                value={documents[d.key] ?? null}
                onChange={(f) => {
                  onDocuments((prev) => ({ ...prev, [d.key]: f }));
                  clear(d.key);
                }}
                label={d.label}
                hint={HINT[d.key]}
                error={errors[d.key]}
                required
              />
              {!errors[d.key] && <ReviewLine review={documents[d.key] ? reviews[documents[d.key]!.id] : undefined} />}
            </div>
          ))}
        </div>
      </FormSection>

      <FormSection title="Supporting documents" description={`Anything else that helps us verify you — annual report, tie-up letters with insurers, ISO certificates. Optional, up to ${INS_MAX_SUPPORTING}.`}>
        <FileList
          kind="supporting"
          files={documents.supporting}
          onChange={(supporting) => {
            onDocuments((prev) => ({ ...prev, supporting }));
            clear("supporting");
          }}
          errors={errors}
          errorKey="supporting"
          reviews={reviews}
          addLabel="Add supporting documents"
        />
      </FormSection>

      <div className="pt-2">
        <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em]">Review before you submit</h2>
        <p className="mt-1 max-w-2xl text-[14px] text-muted">Everything you entered, step by step. Fix anything marked before submitting — your work is saved as you go.</p>
      </div>
      <ReviewSummary app={app} bank={bank} reviews={reviews} checks={checks} onEdit={onEdit} />

      <section className="border border-line bg-white" id="declaration">
        <header className="border-b border-line px-5 py-4 md:px-7">
          <h2 className="text-[15px] font-semibold">Declaration</h2>
          <p className="mt-1 text-[13px] text-muted">Read the vendor terms, then sign as the contact person.</p>
        </header>
        <div className="space-y-6 px-5 py-5 md:px-7 md:py-6">
          <div tabIndex={0} aria-label="Vendor terms" className="max-h-64 overflow-y-auto border border-line bg-[#FAFAFA] px-5 py-4 text-[13px] leading-relaxed text-ink/80 focus-visible:outline-2 focus-visible:outline-ink">
            <p className="font-semibold text-ink">MarchGear insurance vendor terms — summary</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>The information and documents in this application are genuine and current. MarchGear may verify them with the regulator&apos;s public records, the issuing authorities and your bank.</li>
              <li>
                You hold the regulatory registration described here{app.regulatory.category ? ` (${INS_VENDOR_CATEGORY_LABEL[app.regulatory.category].toLowerCase()})` : ""} for every product you list, and you&apos;ll tell MarchGear at once if it lapses, is
                suspended or changes.
              </li>
              <li>Every product, coverage item, add-on and campaign is reviewed by MarchGear before it goes live. Premiums MarchGear calculates are indicative; each quotation you send is labelled Indicative or Insurer-authorised, with your quotation reference for the latter.</li>
              <li>Customer enquiries are shared with you only to respond to that customer. Handle them in line with applicable data-protection law and the regulator&apos;s rules.</li>
              <li>MarchGear doesn&apos;t issue policies, collect premiums or settle claims — those stay between you and the customer.</li>
              <li>MarchGear may pause listings, or suspend the account, for misleading content or a breach of these terms. You&apos;ll be told why on your application status page.</li>
              <li>Plans are billed monthly by invoice as shown under Billing. Applying doesn&apos;t charge you anything.</li>
            </ol>
            <p className="mt-3">
              These terms add to MarchGear&apos;s{" "}
              <Link href="/terms" target="_blank" className="font-medium text-ink underline underline-offset-4 hover:text-red">
                terms of use
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-ink underline underline-offset-4 hover:text-red">
                privacy policy
              </Link>
              .
            </p>
          </div>

          <Checkbox
            checked={declaration.accepted}
            onChange={(v) => {
              onDeclaration((prev) => ({ ...prev, accepted: v }));
              clear("declaration.accepted");
            }}
            label={`I declare that I'm authorised to act for ${company}, that it holds the regulatory registration described in this application, and that the information and documents are true, complete and current. I accept the vendor terms above.`}
            error={errors["declaration.accepted"]}
          />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-end">
            <TextField
              label="Signature — type the contact person's full name"
              value={declaration.name}
              onChange={(e) => {
                const name = e.target.value;
                onDeclaration((prev) => ({ ...prev, name }));
                clear("declaration.name");
              }}
              error={errors["declaration.name"]}
              placeholder={contact || "Full name"}
              autoComplete="off"
            />
            <div className="border-b border-ink/30 pb-2">
              <p className="min-h-[38px] truncate font-serif text-[30px] italic leading-none text-ink">{declaration.name.trim() || <span className="text-ink/20">Signature</span>}</p>
              <p className="mt-2 text-[11.5px] text-muted">Signed electronically · {signedOn}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
