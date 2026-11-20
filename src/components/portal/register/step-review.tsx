"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { BadgeCheck, CircleAlert, CircleCheck, Download, ExternalLink, FileText, Pencil, Star, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { useCatalog } from "@/components/providers/catalog-provider";
import { fileSize, fileUrl } from "@/components/portal/uploader";
import { DAY_LABEL, type WizardSlug } from "@/partner/application";
import { BUSINESS_TYPE_LABEL, FILE_STATUS_LABEL } from "@/partner/labels";
import type { DayHours, FileRef } from "@/partner/types";
import type { BankMeta, CatalogLite, FieldErrors, FileReview } from "@/partner/schemas";
import { normaliseMobile } from "@/partner/schemas";
import { Checkbox, Detail } from "./controls";
import { REGISTRATION_LABEL } from "./step-business";
import type { StepProps } from "./step-types";

const to12h = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

/** "Mon – Sat · 9:30 AM – 8:00 PM · Sun closed" */
export function hoursSummary(hours: DayHours[]) {
  const groups: { from: DayHours; to: DayHours }[] = [];
  for (const h of hours) {
    const last = groups[groups.length - 1];
    if (last && last.to.closed === h.closed && (h.closed || (last.to.open === h.open && last.to.close === h.close))) last.to = h;
    else groups.push({ from: h, to: h });
  }
  return groups
    .map((g) => {
      const days = g.from.day === g.to.day ? DAY_LABEL[g.from.day].slice(0, 3) : `${DAY_LABEL[g.from.day].slice(0, 3)} – ${DAY_LABEL[g.to.day].slice(0, 3)}`;
      return g.from.closed ? `${days} closed` : `${days} ${to12h(g.from.open)} – ${to12h(g.from.close)}`;
    })
    .join(" · ");
}

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

function Summary({ id, title, errors, onEdit, children }: { id: string; title: string; errors: FieldErrors; onEdit: () => void; children: ReactNode }) {
  const count = Object.keys(errors).length;
  return (
    <section id={id} className={cn("scroll-mt-24 border bg-white", count ? "border-red/40" : "border-line")}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 md:px-7">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {count ? (
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-red-50 px-2.5 text-[11.5px] font-semibold text-red">
              <CircleAlert aria-hidden className="size-3.5" /> {count} to fix
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
        {count > 0 && (
          <ul className="mb-5 space-y-1 border-l-2 border-red bg-red-50 px-4 py-3 text-[13px] text-[#8f1216]">
            {Object.values(errors)
              .slice(0, 5)
              .map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            {count > 5 && <li>…and {count - 5} more</li>}
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
        <span className="inline-flex size-12 shrink-0 items-center justify-center bg-mist text-muted">
          <FileText aria-hidden className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium">{label}</p>
          <p className="text-[12px] text-muted">Not uploaded</p>
        </div>
      </div>
    );
  const image = file.mime.startsWith("image/");
  return (
    <button type="button" onClick={() => onPreview(file, label)} className="group flex w-full items-center gap-3 border border-line px-3 py-3 text-left transition-colors duration-300 hover:border-ink/40">
      <span className="relative inline-flex size-12 shrink-0 items-center justify-center overflow-hidden bg-red-50 text-red">
        {image ? (
          // Private document thumbnail served by /dealer/files/<id> (members + staff only).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(file)} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <FileText aria-hidden className="size-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{label}</p>
        <p className="truncate text-[12px] text-muted">
          {file.filename} · {fileSize(file.size)}
        </p>
        {review && review.status !== "pending" && <p className={cn("text-[11.5px] font-medium", review.status === "verified" ? "text-[#1e7a3c]" : "text-red")}>{FILE_STATUS_LABEL[review.status]}</p>}
      </div>
      <span className="shrink-0 text-[12px] font-medium text-muted group-hover:text-ink">Preview</span>
    </button>
  );
}

export function ReviewStep({
  app,
  value,
  onChange,
  errors,
  clear,
  bank,
  reviews,
  checks,
  onEdit,
  signedOn,
}: StepProps<"declaration"> & {
  signedOn: string;
  bank: BankMeta;
  reviews: Record<number, FileReview>;
  checks: { slug: WizardSlug; title: string; errors: FieldErrors }[];
  lite: CatalogLite;
  onEdit: (slug: WizardSlug) => void;
}) {
  const catalog = useCatalog();
  const [preview, setPreview] = useState<{ file: FileRef; label: string } | null>(null);
  const errs = (slug: WizardSlug) => checks.find((c) => c.slug === slug)?.errors ?? {};
  const { personal: p, business: b, showrooms, brands, documents: d, bank: k } = app;
  const show = (file: FileRef, label: string) => setPreview({ file, label });

  return (
    <>
      <Summary id="review-personal-details" title="Personal details" errors={errs("personal-details")} onEdit={() => onEdit("personal-details")}>
        <div className="flex flex-col gap-6 sm:flex-row">
          {p.photo ? (
            // Dealer-uploaded photo from /media.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photo} alt="Profile photograph" className="size-24 shrink-0 border border-line object-cover" />
          ) : (
            <span className="inline-flex size-24 shrink-0 items-center justify-center border border-dashed border-line text-[12px] text-muted">No photo</span>
          )}
          <dl className="grid flex-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Detail label="Full name">{p.fullName}</Detail>
            <Detail label="Designation">{p.designation}</Detail>
            <Detail label="Mobile">
              {p.mobile && (
                <>
                  <span className="num">{fmtMobile(p.mobile)}</span>
                  <Verified on={p.mobileVerified} />
                </>
              )}
            </Detail>
            <Detail label="Email">
              {p.email && (
                <>
                  {p.email}
                  <Verified on={p.emailVerified} />
                </>
              )}
            </Detail>
            <Detail label="Authorised contact" className="sm:col-span-2">
              {p.authorizedContact.name &&
                [p.authorizedContact.name, p.authorizedContact.designation, p.authorizedContact.mobile && fmtMobile(p.authorizedContact.mobile), p.authorizedContact.email].filter(Boolean).join(" · ")}
            </Detail>
          </dl>
        </div>
      </Summary>

      <Summary id="review-business-details" title="Business details" errors={errs("business-details")} onEdit={() => onEdit("business-details")}>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Legal name">{b.legalName}</Detail>
          <Detail label="Trade name">{b.tradeName}</Detail>
          <Detail label="Business type">{b.businessType ? BUSINESS_TYPE_LABEL[b.businessType] : ""}</Detail>
          <Detail label="GSTIN">{b.gst && <span className="font-mono tracking-[0.04em]">{b.gst}</span>}</Detail>
          <Detail label="PAN">{b.pan && <span className="font-mono tracking-[0.04em]">{b.pan}</span>}</Detail>
          <Detail label={REGISTRATION_LABEL[b.businessType].label.replace(" (optional)", "")}>{b.registrationNumber}</Detail>
          <Detail label="Established">{fmtDate(b.establishedOn)}</Detail>
          <Detail label="Business email">{b.email}</Detail>
          <Detail label="Business phone">{b.phone}</Detail>
          <Detail label="Website">{b.website}</Detail>
        </dl>
      </Summary>

      <Summary id="review-showroom-details" title={`Showrooms (${showrooms.length})`} errors={errs("showroom-details")} onEdit={() => onEdit("showroom-details")}>
        <ul className="space-y-4">
          {showrooms.map((r) => (
            <li key={r.key} className="border border-line p-4">
              <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
                {r.name || "Unnamed showroom"}
                {r.isPrimary && (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-red-50 px-2 text-[10.5px] font-semibold text-red">
                    <Star aria-hidden className="size-3 fill-red" /> Primary
                  </span>
                )}
                {r.serviceCentre && (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-mist px-2 text-[10.5px] font-semibold">
                    <Wrench aria-hidden className="size-3" /> Service centre
                  </span>
                )}
              </p>
              <p className="mt-1 text-[13px] text-muted">{[r.address, r.city, r.district, r.state, r.pin].filter(Boolean).join(", ")}</p>
              <p className="mt-1 text-[13px] text-muted">{hoursSummary(r.hours)}</p>
              <p className="mt-1 text-[12.5px] text-muted">
                {r.lat !== null && r.lng !== null ? (
                  <a href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=17/${r.lat}/${r.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono hover:text-ink">
                    {r.lat.toFixed(5)}, {r.lng.toFixed(5)} <ExternalLink aria-hidden className="size-3" />
                  </a>
                ) : (
                  "Location not pinned"
                )}
                {r.phone ? ` · ${r.phone}` : ""}
              </p>
              {r.photos.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-hidden">
                  {r.photos.slice(0, 5).map((src) => (
                    // Dealer-uploaded showroom photo from /media.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="" className="h-14 w-20 shrink-0 border border-line object-cover" loading="lazy" />
                  ))}
                  {r.photos.length > 5 && <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center bg-mist text-[12px] text-muted">+{r.photos.length - 5}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Summary>

      <Summary id="review-brand-authorization" title="Brand authorisation" errors={errs("brand-authorization")} onEdit={() => onEdit("brand-authorization")}>
        <p className="text-[13.5px]">
          <span className="text-muted">Dealer type: </span>
          <span className="font-medium">{brands.mode === "authorized" ? "Authorised dealer" : brands.mode === "multi_brand" ? "Independent multi-brand dealer" : "—"}</span>
        </p>
        <ul className="mt-4 space-y-3">
          {brands.items.map((item) => {
            const models = item.models.map((m) => catalog.getCar(m)?.name ?? m);
            const rooms = showrooms.filter((r) => (item.showroomKeys ?? []).includes(r.key)).map((r) => r.name || "Showroom");
            return (
              <li key={item.brand} className="grid gap-4 border border-line p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold">{catalog.brandName(item.brand)}</p>
                  <p className="mt-1 text-[13px] text-muted">{models.length ? `${models.join(", ")} · ${item.variants.length} variants` : "No models selected"}</p>
                  {item.validUntil && <p className="mt-1 text-[12.5px] text-muted">Authorisation valid until {fmtDate(item.validUntil)}</p>}
                  {showrooms.length > 1 && <p className="mt-1 text-[12.5px] text-muted">Sold at {rooms.length ? rooms.join(", ") : "—"}</p>}
                </div>
                <DocTile label="Authorisation certificate" file={item.certificate} review={item.certificate ? reviews[item.certificate.id] : undefined} onPreview={show} />
              </li>
            );
          })}
        </ul>
      </Summary>

      <Summary id="review-documents" title="Documents" errors={errs("documents")} onEdit={() => onEdit("documents")}>
        <div className="grid gap-3 md:grid-cols-2">
          <DocTile label="PAN card" file={d.pan} review={d.pan ? reviews[d.pan.id] : undefined} onPreview={show} />
          <DocTile label="GST certificate" file={d.gst} review={d.gst ? reviews[d.gst.id] : undefined} onPreview={show} />
          <DocTile label="Business registration" file={d.registration} review={d.registration ? reviews[d.registration.id] : undefined} onPreview={show} />
          <DocTile label="Identity proof" file={d.identity} review={d.identity ? reviews[d.identity.id] : undefined} onPreview={show} />
          <DocTile label="Address proof" file={d.address} review={d.address ? reviews[d.address.id] : undefined} onPreview={show} />
          {d.brand_authorization && <DocTile label="Brand authorisation letter" file={d.brand_authorization} review={reviews[d.brand_authorization.id]} onPreview={show} />}
          {d.supporting.map((f, i) => (
            <DocTile key={f.id} label={`Supporting document ${i + 1}`} file={f} review={reviews[f.id]} onPreview={show} />
          ))}
        </div>
      </Summary>

      <Summary id="review-bank-details" title="Bank details" errors={errs("bank-details")} onEdit={() => onEdit("bank-details")}>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Detail label="Account holder">{k.holder}</Detail>
            <Detail label="Bank">{k.bankName}</Detail>
            <Detail label="Account number">{bank.hasAccount && <span className="font-mono tracking-[0.1em]">{bank.masked}</span>}</Detail>
            <Detail label="IFSC">{k.ifsc && <span className="font-mono">{k.ifsc}</span>}</Detail>
            <Detail label="Branch">{k.branch}</Detail>
          </dl>
          <DocTile label="Cancelled cheque" file={k.cheque} review={k.cheque ? reviews[k.cheque.id] : undefined} onPreview={show} />
        </div>
      </Summary>

      <section className="border border-line bg-white">
        <header className="border-b border-line px-5 py-4 md:px-7">
          <h2 className="text-[15px] font-semibold">Terms & declaration</h2>
          <p className="mt-1 text-[13px] text-muted">Please read the partner terms before you submit.</p>
        </header>
        <div className="space-y-6 px-5 py-5 md:px-7 md:py-6">
          <div tabIndex={0} aria-label="Partner terms and conditions" className="max-h-64 overflow-y-auto border border-line bg-[#FAFAFA] px-5 py-4 text-[13px] leading-relaxed text-ink/80 focus-visible:outline-2 focus-visible:outline-ink">
            <p className="font-semibold text-ink">MarchGear dealer partner terms — summary</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>You confirm that the information and documents you provide are genuine and current. MarchGear may verify them with the issuing authorities, manufacturers or your bank.</li>
              <li>Every vehicle listing and offer you publish is reviewed by MarchGear before it goes live. Prices, stock and offers must be accurate and honoured as published.</li>
              <li>Customer enquiries and test-drive requests are shared with you only to respond to that customer. Don&apos;t use them for anything else, and handle them in line with applicable data-protection law.</li>
              <li>Only list brands you&apos;re entitled to sell, and use manufacturer names and logos according to their guidelines.</li>
              <li>MarchGear may pause listings, or suspend or close a partner account, for misleading content, fraud, or a breach of these terms. You&apos;ll be told why on your status page.</li>
              <li>Paid plans, if you choose one, are billed as shown on the Subscription page. Submitting this application doesn&apos;t charge you anything.</li>
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

          <div className="space-y-4">
            <Checkbox
              checked={value.acceptedTerms}
              onChange={(v) => {
                onChange({ ...value, acceptedTerms: v });
                clear("acceptedTerms");
              }}
              label="I have read and accept the MarchGear dealer partner terms & conditions."
              error={errors.acceptedTerms}
            />
            <Checkbox
              checked={value.declared}
              onChange={(v) => {
                onChange({ ...value, declared: v });
                clear("declared");
              }}
              label={`I declare that I'm authorised to act for ${b.legalName || "this business"}, and that the information and documents in this application are true, complete and current. I'll tell MarchGear about any change.`}
              error={errors.declared}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2 md:items-end">
            <TextField
              label="Signature — type your full name"
              value={value.signedName}
              onChange={(e) => {
                onChange({ ...value, signedName: e.target.value });
                clear("signedName");
              }}
              error={errors.signedName}
              placeholder={p.fullName || "Your full name"}
              autoComplete="off"
            />
            <div className="border-b border-ink/30 pb-2">
              <p className="min-h-[38px] font-serif text-[30px] italic leading-none text-ink">{value.signedName.trim() || <span className="text-ink/20">Your signature</span>}</p>
              <p className="mt-2 text-[11.5px] text-muted">Signed electronically · {signedOn}</p>
            </div>
          </div>
        </div>
      </section>

      <Modal open={preview !== null} onClose={() => setPreview(null)} title={preview?.label} description={preview ? `${preview.file.filename} · ${fileSize(preview.file.size)}` : undefined} size="lg">
        {preview && (
          <div className="space-y-4 px-6 py-6 sm:px-8">
            {preview.file.mime.startsWith("image/") ? (
              // Private document preview served by /dealer/files/<id>.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl(preview.file)} alt={preview.label} className="max-h-[60vh] w-full border border-line bg-mist object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-3 border border-line bg-mist px-6 py-12 text-center">
                <FileText aria-hidden className="size-10 text-red" />
                <p className="text-[14px] font-medium">PDF document</p>
                <p className="max-w-sm text-[13px] text-muted">Open it in a new tab to read it, or download a copy.</p>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <a href={fileUrl(preview.file, true)} className="inline-flex h-10 items-center gap-2 rounded-[3px] border border-line px-4 text-[13px] font-medium hover:border-ink">
                <Download aria-hidden className="size-4" /> Download
              </a>
              <a href={fileUrl(preview.file)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-[3px] bg-ink px-4 text-[13px] font-medium text-white hover:bg-ink-3">
                <ExternalLink aria-hidden className="size-4" /> Open in new tab
              </a>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
