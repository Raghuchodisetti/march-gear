"use client";

import { useState, type ReactNode } from "react";
import { BadgeCheck, CircleAlert, CircleCheck, Download, ExternalLink, FileText, Pencil, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/overlay";
import { Detail } from "@/components/portal/register/controls";
import { fileSize, insFileUrl } from "@/components/insurance/vendor/uploader";
import { INS_REQUIRED_DOCUMENTS, type InsStepKey } from "@/insurance/application";
import { FILE_REVIEW_LABEL, INS_BUSINESS_TYPE_LABEL, INS_VENDOR_CATEGORY_LABEL } from "@/insurance/labels";
import { INS_CIN_LABEL, INS_LICENCE_LABEL, normaliseMobile, type FieldErrors, type FileReview, type InsBankMeta, type InsWizardApplication } from "@/insurance/schemas";
import type { FileRef } from "@/insurance/types";

/* The review-before-submission summary on step 7: every step, with Edit links and what's missing. */

const fmtDate = (d: string) => (d ? new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "");
const fmtMobile = (v: string) => {
  const d = normaliseMobile(v);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : v;
};

function Verified({ on }: { on: boolean }) {
  return on ? (
    <span className="ml-2 inline-flex h-5 items-center gap-1 rounded-full bg-[#e8f5ec] px-2 align-middle text-[10.5px] font-semibold text-[#1e7a3c]">
      <BadgeCheck aria-hidden className="size-3" /> Verified
    </span>
  ) : (
    <span className="ml-2 inline-flex h-5 items-center rounded-full bg-mist px-2 align-middle text-[10.5px] font-semibold text-muted">Not verified</span>
  );
}

function Summary({ id, n, title, errors, onEdit, children }: { id: string; n: number; title: string; errors: FieldErrors; onEdit: () => void; children: ReactNode }) {
  const messages = [...new Set(Object.values(errors))];
  return (
    <section id={id} className={cn("scroll-mt-24 border bg-white", messages.length ? "border-red/40" : "border-line")} data-testid="review-section">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 md:px-7">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[12px] font-semibold text-muted num">{String(n).padStart(2, "0")}</span>
          <h3 className="text-[15px] font-semibold">{title}</h3>
          {messages.length ? (
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-red-50 px-2.5 text-[11.5px] font-semibold text-red">
              <CircleAlert aria-hidden className="size-3.5" /> {messages.length} missing
            </span>
          ) : (
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[#e8f5ec] px-2.5 text-[11.5px] font-semibold text-[#1e7a3c]">
              <CircleCheck aria-hidden className="size-3.5" /> Complete
            </span>
          )}
        </div>
        <button type="button" onClick={onEdit} className="inline-flex h-9 items-center gap-1.5 rounded-[3px] border border-line px-3 text-[13px] font-medium transition-colors duration-300 hover:border-ink">
          <Pencil aria-hidden className="size-3.5" /> Edit
        </button>
      </header>
      <div className="px-5 py-5 md:px-7">
        {messages.length > 0 && (
          <ul className="mb-5 space-y-1 border-l-2 border-red bg-red-50 px-4 py-3 text-[13px] text-[#8f1216]">
            {messages.slice(0, 6).map((m, i) => (
              <li key={i}>{m}</li>
            ))}
            {messages.length > 6 && <li>…and {messages.length - 6} more</li>}
          </ul>
        )}
        {children}
      </div>
    </section>
  );
}

function DocTile({ label, file, review, onPreview }: { label: string; file: FileRef | null | undefined; review?: FileReview; onPreview: (f: FileRef, label: string) => void }) {
  if (!file)
    return (
      <div className="flex items-center gap-3 border border-dashed border-line px-3 py-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center bg-mist text-muted">
          <FileText aria-hidden className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium">{label}</p>
          <p className="text-[12px] text-red">Not uploaded</p>
        </div>
      </div>
    );
  const image = file.mime.startsWith("image/");
  return (
    <button type="button" onClick={() => onPreview(file, label)} className="group flex w-full items-center gap-3 border border-line px-3 py-3 text-left transition-colors duration-300 hover:border-ink/40">
      <span className="relative inline-flex size-11 shrink-0 items-center justify-center overflow-hidden bg-red-50 text-red">
        {image ? (
          // Private document thumbnail served by /insurance-vendor/files/<id> (members + staff only).
          // eslint-disable-next-line @next/next/no-img-element
          <img decoding="async" src={insFileUrl(file)} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <FileText aria-hidden className="size-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{label}</p>
        <p className="truncate text-[12px] text-muted">
          {file.filename} · {fileSize(file.size)}
        </p>
        {review && review.status !== "pending" && <p className={cn("text-[11.5px] font-medium", review.status === "verified" ? "text-[#1e7a3c]" : "text-red")}>{FILE_REVIEW_LABEL[review.status]}</p>}
      </div>
      <span className="shrink-0 text-[12px] font-medium text-muted group-hover:text-ink">Preview</span>
    </button>
  );
}

export function ReviewSummary({
  app,
  bank,
  reviews,
  checks,
  onEdit,
}: {
  app: InsWizardApplication;
  bank: InsBankMeta;
  reviews: Record<number, FileReview>;
  checks: { key: InsStepKey; title: string; errors: FieldErrors }[];
  onEdit: (key: InsStepKey) => void;
}) {
  const [preview, setPreview] = useState<{ file: FileRef; label: string } | null>(null);
  const errs = (key: InsStepKey) => checks.find((c) => c.key === key)?.errors ?? {};
  const { contact: c, company: co, registration: r, regulatory: g, branches, bank: k, documents: d } = app;
  const show = (file: FileRef, label: string) => setPreview({ file, label });
  const rev = (f: FileRef | null | undefined) => (f ? reviews[f.id] : undefined);

  return (
    <>
      <Summary id="review-contact" n={1} title="Contact details" errors={errs("contact")} onEdit={() => onEdit("contact")}>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Detail label="Name">{c.name}</Detail>
          <Detail label="Designation">{c.designation}</Detail>
          <Detail label="Mobile">
            {c.mobile && (
              <>
                <span className="num">{fmtMobile(c.mobile)}</span>
                <Verified on={c.mobileVerified} />
              </>
            )}
          </Detail>
          <Detail label="Email">
            {c.email && (
              <>
                <span className="break-all">{c.email}</span>
                <Verified on={c.emailVerified} />
              </>
            )}
          </Detail>
        </dl>
      </Summary>

      <Summary id="review-company" n={2} title="Company details" errors={errs("company")} onEdit={() => onEdit("company")}>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Legal name">{co.legalName}</Detail>
          <Detail label="Brand name">{co.brandName}</Detail>
          <Detail label="Business type">{co.businessType ? INS_BUSINESS_TYPE_LABEL[co.businessType] : ""}</Detail>
          <Detail label="Registered office" className="sm:col-span-2">
            {[co.address, co.city, co.state, co.pin].filter(Boolean).join(", ")}
          </Detail>
          <Detail label="Website">{co.website}</Detail>
        </dl>
      </Summary>

      <Summary id="review-registration" n={3} title="Business registration" errors={errs("registration")} onEdit={() => onEdit("registration")}>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="GSTIN">{r.gstin && <span className="font-mono tracking-[0.04em]">{r.gstin}</span>}</Detail>
          <Detail label="PAN">{r.pan && <span className="font-mono tracking-[0.04em]">{r.pan}</span>}</Detail>
          <Detail label={INS_CIN_LABEL[co.businessType].label.replace(" (optional)", "")}>{r.cin && <span className="break-all font-mono tracking-[0.04em]">{r.cin}</span>}</Detail>
          <Detail label="Established">{fmtDate(r.establishedOn)}</Detail>
        </dl>
      </Summary>

      <Summary id="review-regulatory" n={4} title="Regulatory details" errors={errs("regulatory")} onEdit={() => onEdit("regulatory")}>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Category">{g.category ? INS_VENDOR_CATEGORY_LABEL[g.category] : ""}</Detail>
          <Detail label="Registration type">{g.registrationType}</Detail>
          <Detail label={INS_LICENCE_LABEL[g.category]}>{g.licenceNumber && <span className="font-mono tracking-[0.04em]">{g.licenceNumber}</span>}</Detail>
          <Detail label="Valid until">{fmtDate(g.licenceValidUntil)}</Detail>
          <Detail label="Authorised representative" className="sm:col-span-2">
            {g.representative.name && [g.representative.name, g.representative.designation, g.representative.mobile && fmtMobile(g.representative.mobile), g.representative.email].filter(Boolean).join(" · ")}
          </Detail>
        </dl>
        {g.documents.length > 0 && (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {g.documents.map((f, i) => (
              <DocTile key={f.id} label={`Regulatory document ${i + 1}`} file={f} review={rev(f)} onPreview={show} />
            ))}
          </div>
        )}
      </Summary>

      <Summary id="review-branches" n={5} title={`Branch offices (${branches.length})`} errors={errs("branches")} onEdit={() => onEdit("branches")}>
        {branches.length === 0 ? (
          <p className="text-[13.5px] text-muted">No branches added yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {branches.map((b) => (
              <li key={b.key} className="border border-line p-4">
                <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
                  {b.name || "Unnamed branch"}
                  {b.isPrimary && (
                    <span className="inline-flex h-5 items-center gap-1 rounded-full bg-red-50 px-2 text-[10.5px] font-semibold text-red">
                      <Star aria-hidden className="size-3 fill-red" /> Primary
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[13px] text-muted">{[b.address, b.city, b.state, b.pin].filter(Boolean).join(", ")}</p>
                {(b.phone || b.email) && <p className="mt-1 break-all text-[12.5px] text-muted">{[b.phone, b.email].filter(Boolean).join(" · ")}</p>}
              </li>
            ))}
          </ul>
        )}
      </Summary>

      <Summary id="review-bank" n={6} title="Banking details" errors={errs("bank")} onEdit={() => onEdit("bank")}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Detail label="Account holder">{k.holder}</Detail>
            <Detail label="Bank">{k.bankName}</Detail>
            <Detail label="Account number">{bank.hasAccount && <span className="font-mono tracking-[0.1em]">{bank.masked}</span>}</Detail>
            <Detail label="IFSC">{k.ifsc && <span className="font-mono">{k.ifsc}</span>}</Detail>
          </dl>
          <DocTile label="Bank proof" file={k.proof} review={rev(k.proof)} onPreview={show} />
        </div>
      </Summary>

      <Summary id="review-documents" n={7} title="Documents" errors={errs("documents")} onEdit={() => document.getElementById("required-documents")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {INS_REQUIRED_DOCUMENTS.map((x) => (
            <DocTile key={x.key} label={x.label} file={d[x.key]} review={rev(d[x.key])} onPreview={show} />
          ))}
          {d.supporting.map((f, i) => (
            <DocTile key={f.id} label={`Supporting document ${i + 1}`} file={f} review={rev(f)} onPreview={show} />
          ))}
        </div>
      </Summary>

      <Modal open={preview !== null} onClose={() => setPreview(null)} title={preview?.label} description={preview ? `${preview.file.filename} · ${fileSize(preview.file.size)}` : undefined} size="lg">
        {preview && (
          <div className="space-y-4 px-6 py-6 sm:px-8">
            {preview.file.mime.startsWith("image/") ? (
              // Private document preview served by /insurance-vendor/files/<id>.
              // eslint-disable-next-line @next/next/no-img-element
              <img loading="lazy" decoding="async" src={insFileUrl(preview.file)} alt={preview.label} className="max-h-[60vh] w-full border border-line bg-mist object-contain" />
            ) : (
              <iframe src={insFileUrl(preview.file)} title={preview.label} className="h-[60vh] w-full border border-line bg-mist" />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <a href={insFileUrl(preview.file, true)} className="inline-flex h-10 items-center gap-2 rounded-[3px] border border-line px-4 text-[13px] font-medium hover:border-ink">
                <Download aria-hidden className="size-4" /> Download
              </a>
              <a href={insFileUrl(preview.file)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-[3px] bg-ink px-4 text-[13px] font-medium text-white hover:bg-ink-3">
                <ExternalLink aria-hidden className="size-4" /> Open in new tab
              </a>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
