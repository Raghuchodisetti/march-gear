"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, FileText, Layers, Loader2, Pencil, Plus, Store, Trash2 } from "lucide-react";
import type { BrandAuthStatus } from "@/db/enums";
import type { FileRef } from "@/partner/types";
import { BRAND_STATUS_LABEL, BRAND_STATUS_TONE } from "@/partner/labels";
import { cn } from "@/lib/utils";
import { addBrandAction, removeBrandAction, updateBrandAction } from "@/server/actions/partner-brands";
import { Badge } from "@/components/portal/ui";
import { useUI } from "@/components/providers/app-provider";
import { DocumentUploader, fileUrl } from "@/components/portal/uploader";
import { BrandLogo, hasBrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { Check2, ConfirmDialog, FieldError, inputCls, useAction } from "@/components/portal/profile/kit";

export interface BrandView {
  id: number;
  brand: string;
  name: string;
  status: BrandAuthStatus;
  /** Derived from the expiry date: expired / expiring within 30 days. */
  validity: "ok" | "soon" | "expired" | "none";
  daysLeft: number | null;
  certificate: FileRef | null;
  validUntil: string;
  validUntilLabel: string | null;
  showroomIds: number[];
  models: number;
  variants: number;
  remarks: string | null;
  lastEvent: string | null;
}

type Draft = { id: number | null; brand: string; certificate: FileRef | null; validUntil: string; showroomIds: number[] };

export function BrandManager({ brands, catalogBrands, showrooms }: { brands: BrandView[]; catalogBrands: { slug: string; name: string }[]; showrooms: { id: number; name: string }[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<BrandView | null>(null);
  const { busy, errors, setErrors, run } = useAction();
  const { toast } = useUI();
  const taken = new Set(brands.map((b) => b.brand));
  const available = catalogBrands.filter((b) => !taken.has(b.slug));
  const editing = draft?.id ? brands.find((b) => b.id === draft.id) : null;

  const open = (b?: BrandView) => {
    setErrors({});
    setDraft(b ? { id: b.id, brand: b.brand, certificate: b.certificate, validUntil: b.validUntil, showroomIds: b.showroomIds } : { id: null, brand: "", certificate: null, validUntil: "", showroomIds: showrooms.length === 1 ? [showrooms[0].id] : [] });
  };
  const save = async () => {
    if (!draft) return;
    if (draft.id) {
      const res = await run(() => updateBrandAction({ id: draft.id, certificate: draft.certificate, validUntil: draft.validUntil, showroomIds: draft.showroomIds }));
      if (res) {
        toast(res.resubmitted ? "Sent to MarchGear for review." : "Branches updated.", { tone: "success" });
        setDraft(null);
        router.refresh();
      }
    } else {
      const res = await run(() => addBrandAction(draft), "Brand added — MarchGear will review the certificate.");
      if (res) {
        setDraft(null);
        router.refresh();
      }
    }
  };
  const remove = async () => {
    if (!removing) return;
    const res = await run(() => removeBrandAction(removing.id), `${removing.name} removed.`);
    setRemoving(null);
    if (res) router.refresh();
  };

  const counts = { approved: brands.filter((b) => b.status === "approved" && b.validity !== "expired").length, pending: brands.filter((b) => b.status === "pending").length, attention: brands.filter((b) => b.validity === "soon" || b.validity === "expired" || b.status === "rejected").length };
  const willResubmit = editing && draft && (editing.certificate?.id !== draft.certificate?.id || editing.validUntil !== draft.validUntil || editing.status === "rejected");

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 border border-line bg-white px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
          <div className="flex items-baseline gap-2">
            <dt className="text-muted">Authorised</dt>
            <dd className="text-[16px] font-semibold num">{counts.approved}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-muted">In review</dt>
            <dd className="text-[16px] font-semibold num">{counts.pending}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-muted">Need attention</dt>
            <dd className={cn("text-[16px] font-semibold num", counts.attention > 0 && "text-red")}>{counts.attention}</dd>
          </div>
        </dl>
        <Button variant="dark" size="sm" onClick={() => open()} disabled={!available.length} icon={<Plus className="size-4" aria-hidden />}>
          Add brand
        </Button>
      </div>

      {brands.length === 0 ? (
        <div className="flex flex-col items-center border border-dashed border-ink/15 bg-white px-6 py-16 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
            <Layers aria-hidden className="size-5 text-ink/60" />
          </span>
          <p className="mt-4 text-[15px] font-semibold">Add the brands you&apos;re authorised to sell</p>
          <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted">Upload each manufacturer&apos;s dealership certificate. Once MarchGear verifies it, the brand shows on your public page and you can list its new cars.</p>
          <Button className="mt-5" variant="dark" size="sm" onClick={() => open()} icon={<Plus className="size-4" aria-hidden />}>
            Add brand
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {brands.map((b) => {
            const branchNames = showrooms.filter((s) => b.showroomIds.includes(s.id)).map((s) => s.name);
            const status = b.status === "approved" && b.validity === "expired" ? "expired" : b.status;
            return (
              <li key={b.id} className="flex flex-col border border-line bg-white transition-colors duration-500 hover:border-ink/25">
                <div className="flex items-start gap-4 p-5">
                  <span className="flex h-14 w-20 shrink-0 items-center justify-center border border-line bg-white">
                    {hasBrandLogo(b.brand) ? <BrandLogo slug={b.brand} title={b.name} className="max-h-[60%]" /> : <span className="text-[13px] font-semibold">{b.name.slice(0, 3).toUpperCase()}</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[16px] font-semibold leading-tight">{b.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone={BRAND_STATUS_TONE[status]}>{BRAND_STATUS_LABEL[status]}</Badge>
                      {b.validity === "soon" && status === "approved" && <Badge tone="amber">Expiring in {b.daysLeft} {b.daysLeft === 1 ? "day" : "days"}</Badge>}
                    </div>
                  </div>
                </div>
                <dl className="grid grid-cols-1 gap-3 border-t border-line px-5 py-4 text-[13px]">
                  <div className="flex items-start gap-2.5">
                    <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                    <dt className="sr-only">Certificate</dt>
                    <dd className="min-w-0">
                      {b.certificate ? (
                        <a href={fileUrl(b.certificate)} target="_blank" rel="noreferrer" className="block truncate font-medium hover:text-red">
                          {b.certificate.filename}
                        </a>
                      ) : (
                        <span className="text-[#9a5b00]">No certificate uploaded</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                    <dt className="sr-only">Valid until</dt>
                    <dd className={cn(b.validity === "expired" && "font-medium text-red", b.validity === "soon" && "font-medium text-[#9a5b00]")}>
                      {b.validUntilLabel ? `${b.validity === "expired" ? "Expired" : "Valid until"} ${b.validUntilLabel}` : "No expiry date"}
                    </dd>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Store aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                    <dt className="sr-only">Branches</dt>
                    <dd className="min-w-0 text-ink/80">{branchNames.length ? branchNames.join(", ") : <span className="text-muted">No branch mapped</span>}</dd>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Layers aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                    <dt className="sr-only">Models</dt>
                    <dd>
                      {b.status === "rejected" ? (
                        <span className="text-muted">Models unlock after approval</span>
                      ) : (
                        <a href={`/dealer/models?brand=${b.brand}`} className="font-medium hover:text-red">
                          {b.models ? `${b.models} model${b.models === 1 ? "" : "s"} · ${b.variants} variant${b.variants === 1 ? "" : "s"}` : "Choose models you sell →"}
                        </a>
                      )}
                    </dd>
                  </div>
                </dl>
                {(b.remarks || b.lastEvent) && (
                  <div className="border-t border-line px-5 py-3 text-[12.5px]">
                    {b.remarks && (
                      <p className="border-l-2 border-line pl-3">
                        <span className="font-medium">MarchGear:</span> {b.remarks}
                      </p>
                    )}
                    {b.lastEvent && <p className="mt-1 text-muted">{b.lastEvent}</p>}
                  </div>
                )}
                <div className="mt-auto flex gap-2 border-t border-line px-5 py-3">
                  <Button size="sm" variant="ghost" onClick={() => open(b)} icon={<Pencil className="size-3.5" aria-hidden />}>
                    {b.validity === "expired" || b.validity === "soon" || b.status === "rejected" ? "Renew certificate" : "Edit"}
                  </Button>
                  <Button size="sm" variant="ghost" className="ml-auto text-muted hover:text-red" onClick={() => setRemoving(b)} icon={<Trash2 className="size-3.5" aria-hidden />}>
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? `${editing?.name ?? "Brand"} authorisation` : "Add a brand"} description={draft?.id ? undefined : "MarchGear verifies the certificate before the brand goes live on your page."} size="lg">
        {draft && (
          <div className="space-y-5 px-6 py-6 sm:px-8">
            {!draft.id && (
              <div>
                <label htmlFor="br-brand" className="mb-1.5 block text-[12.5px] font-medium">
                  Brand
                </label>
                <select id="br-brand" value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} className={cn(inputCls, "cursor-pointer")} aria-invalid={Boolean(errors.brand) || undefined}>
                  <option value="">Choose a brand</option>
                  {available.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <FieldError msg={errors.brand} />
              </div>
            )}
            <DocumentUploader kind="brand_authorization" label="Dealership authorisation certificate" required value={draft.certificate} onChange={(f) => setDraft({ ...draft, certificate: f })} error={errors.certificate} hint="The letter or certificate from the manufacturer naming your dealership." />
            <div className="sm:max-w-xs">
              <label htmlFor="br-valid" className="mb-1.5 block text-[12.5px] font-medium">
                Valid until <span className="font-normal text-muted">(optional)</span>
              </label>
              <input id="br-valid" type="date" value={draft.validUntil} onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })} className={inputCls} aria-invalid={Boolean(errors.validUntil) || undefined} />
              <FieldError msg={errors.validUntil} />
            </div>
            {showrooms.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-[12.5px] font-medium">Branches that sell this brand</legend>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {showrooms.map((s) => (
                    <Check2
                      key={s.id}
                      checked={draft.showroomIds.includes(s.id)}
                      onChange={(on) => setDraft({ ...draft, showroomIds: on ? [...draft.showroomIds, s.id] : draft.showroomIds.filter((x) => x !== s.id) })}
                      label={s.name}
                    />
                  ))}
                </div>
              </fieldset>
            )}
            {willResubmit && <p className="border-l-2 border-[#2456a6] bg-[#e9f0fb]/50 px-3 py-2 text-[12.5px]">A new certificate or expiry date goes back to MarchGear for review. Until it&apos;s approved, the brand shows as pending.</p>}
            <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button variant="dark" size="sm" onClick={save} disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
                {draft.id ? (willResubmit ? "Send for review" : "Save") : "Submit for review"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name ?? "brand"}?`}
        body="The brand disappears from your public page and its model selection is cleared. Vehicles you've already listed stay as they are. You can add it again later — it will need a fresh review."
        confirm="Remove brand"
        busy={busy}
        onConfirm={remove}
      />
    </>
  );
}

