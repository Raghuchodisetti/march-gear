"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { DocumentUploader, fileSize, fileUrl, uploadDealerDocument } from "@/components/portal/uploader";
import type { BusinessType } from "@/db/enums";
import type { FileRef } from "@/partner/types";
import type { FileReview } from "@/partner/schemas";
import { FieldError, FormSection, Note } from "./controls";
import { ReviewLine } from "./step-brands";
import type { StepProps } from "./step-types";

const REGISTRATION_DOC: Record<BusinessType | "", string> = {
  "": "Business registration certificate",
  proprietorship: "Shop & establishment or Udyam registration certificate",
  partnership: "Partnership deed or firm registration certificate",
  llp: "LLP certificate of incorporation",
  private_limited: "Certificate of incorporation",
};

type Slot = "pan" | "gst" | "registration" | "identity" | "address";

export function DocumentsStep({ app, value, onChange, errors, clear, reviews }: StepProps<"documents"> & { reviews: Record<number, FileReview> }) {
  const set = (k: Slot | "brand_authorization", f: FileRef | null) => {
    onChange({ ...value, [k]: f });
    clear(k);
  };
  const perBrand = app.brands.mode === "authorized" && app.brands.items.length > 0 && app.brands.items.every((i) => i.certificate);

  const slots: { key: Slot; label: string; hint: string }[] = [
    { key: "pan", label: "PAN card", hint: app.business.businessType === "proprietorship" ? "The proprietor's PAN card." : "The business PAN card." },
    { key: "gst", label: "GST registration certificate", hint: "Form GST REG-06, all pages." },
    { key: "registration", label: REGISTRATION_DOC[app.business.businessType], hint: "The certificate that matches the registration number you entered." },
    { key: "identity", label: "Identity proof", hint: "Of the authorised signatory — Aadhaar (masked), passport, driving licence or voter ID." },
    { key: "address", label: "Business address proof", hint: "Electricity bill, rent agreement or property tax receipt — not older than 3 months." },
  ];

  return (
    <>
      <FormSection title="KYC documents" description="Required for every dealership.">
        <div className="grid gap-6 md:grid-cols-2">
          {slots.map((s) => (
            <div key={s.key} data-error={errors[s.key] ? "true" : undefined}>
              <DocumentUploader kind={s.key} value={value[s.key] ?? null} onChange={(f) => set(s.key, f)} label={s.label} hint={s.hint} error={errors[s.key]} required />
              {!errors[s.key] && <ReviewLine review={value[s.key] ? reviews[value[s.key]!.id] : undefined} />}
            </div>
          ))}
        </div>
      </FormSection>

      <FormSection title="Brand authorisation" description="A combined authorisation letter, if the manufacturer issued one instead of per-brand certificates.">
        {perBrand ? (
          <Note tone="success" className="mb-5">
            You&apos;ve uploaded an authorisation certificate for every brand in step 4 — nothing more is needed here.
          </Note>
        ) : app.brands.mode === "multi_brand" ? (
          <Note tone="info" className="mb-5">
            As an independent multi-brand dealer you don&apos;t need one. Add it if you hold any manufacturer authorisation.
          </Note>
        ) : null}
        <div className="md:max-w-[calc(50%-12px)]" data-error={errors.brand_authorization ? "true" : undefined}>
          <DocumentUploader kind="brand_authorization" value={value.brand_authorization ?? null} onChange={(f) => set("brand_authorization", f)} label="Brand authorisation letter" error={errors.brand_authorization} />
          {!errors.brand_authorization && <ReviewLine review={value.brand_authorization ? reviews[value.brand_authorization.id] : undefined} />}
        </div>
      </FormSection>

      <FormSection title="Supporting documents" description="Anything else that helps us verify you — trade licence, showroom lease, ISO or OEM awards. Up to 10.">
        <SupportingList
          files={value.supporting}
          onChange={(supporting) => {
            onChange({ ...value, supporting });
            clear("supporting");
          }}
          errors={errors}
          reviews={reviews}
        />
      </FormSection>
    </>
  );
}

function SupportingList({ files, onChange, errors, reviews }: { files: FileRef[]; onChange: (f: FileRef[]) => void; errors: Record<string, string>; reviews: Record<number, FileReview> }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ name: string; progress: number } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const room = 10 - files.length;

  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    const chosen = Array.from(list).slice(0, room);
    const failed: string[] = list.length > chosen.length ? [`Only ${room} more ${room === 1 ? "file fits" : "files fit"} — the rest were skipped.`] : [];
    const added: FileRef[] = [];
    for (const f of chosen) {
      setBusy({ name: f.name, progress: 0 });
      const res = await uploadDealerDocument(f, "supporting", (p) => setBusy({ name: f.name, progress: p }));
      if (res.file) added.push(res.file);
      else failed.push(`${f.name}: ${res.error}`);
    }
    setBusy(null);
    setProblems(failed);
    if (added.length) onChange([...files, ...added]);
    if (input.current) input.current.value = "";
  };

  return (
    <div>
      {files.length > 0 && (
        <ul className="mb-3 divide-y divide-line border border-line">
          {files.map((f, i) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2.5" data-error={errors[`supporting.${i}`] ? "true" : undefined}>
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[3px] bg-red-50 text-red">
                <FileText aria-hidden className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <a href={fileUrl(f)} target="_blank" rel="noreferrer" className="block truncate text-[13.5px] font-medium hover:text-red">
                  {f.filename}
                </a>
                <p className="text-[12px] text-muted">
                  {f.mime === "application/pdf" ? "PDF" : "Image"} · {fileSize(f.size)}
                </p>
                {errors[`supporting.${i}`] && <p className="text-xs text-red">{errors[`supporting.${i}`]}</p>}
                {!errors[`supporting.${i}`] && <ReviewLine review={reviews[f.id]} />}
              </div>
              <button type="button" onClick={() => onChange(files.filter((x) => x.id !== f.id))} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-red" aria-label={`Remove ${f.filename}`}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {busy && (
        <div className="mb-3 flex items-center gap-3 border border-line px-3 py-3 text-[13px] text-muted">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          <span className="min-w-0 flex-1 truncate">Uploading {busy.name}…</span>
          <span className="num">{Math.round(busy.progress * 100)}%</span>
        </div>
      )}
      {room > 0 && !busy && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void pick(e.dataTransfer.files);
          }}
          className="flex w-full flex-col items-center justify-center gap-1 border border-dashed border-ink/20 bg-white px-4 py-6 text-center transition-colors duration-300 hover:border-ink"
        >
          <span className="inline-flex items-center gap-2 text-[13.5px] font-medium">
            <Plus aria-hidden className="size-4" /> Add supporting documents
          </span>
          <span className="text-[12px] text-muted">Drop files or click · PDF, JPEG, PNG or WebP · up to 900 KB each</span>
        </button>
      )}
      <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void pick(e.target.files)} />
      {problems.map((p, i) => (
        <p key={i} className="mt-1.5 text-xs text-red">
          {p}
        </p>
      ))}
      <FieldError>{errors.supporting}</FieldError>
    </div>
  );
}
