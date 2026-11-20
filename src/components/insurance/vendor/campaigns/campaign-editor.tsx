"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Info, Loader2, MessageSquareWarning, PackageOpen, Save, Send, ShieldAlert } from "lucide-react";
import type { InsCampaignStatus } from "@/db/enums";
import type { ActionFailure } from "@/lib/action-result";
import { INS_CAMPAIGN_TYPES } from "@/db/enums";
import { cn } from "@/lib/utils";
import { INS_CAMPAIGN_TYPE_LABEL, INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { saveInsCampaignDraftAction, submitInsCampaignAction } from "@/server/actions/ins-campaigns";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Label, SelectField, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { FormSection } from "@/components/portal/profile/kit";
import { Callout } from "@/components/portal/offers/offer-ui";
import { fromIstParts } from "@/components/offers/offer-utils";
import { InsImageUploader } from "@/components/insurance/vendor/uploader";
import { CampaignPreview } from "./campaign-preview";
import {
  CAMPAIGN_DRAFT_STATUSES,
  CAMPAIGN_LIMITS,
  COMPLIANCE_RULES,
  CTA_DEFAULT,
  CTA_SUGGESTIONS,
  complianceFlags,
  type CampaignInput,
  type CampaignProductOption,
} from "./shared";

/* Create / edit a promotional campaign, with a live public preview. */

const OFFLINE: ActionFailure = { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
const area =
  "w-full rounded-[3px] border border-line bg-white px-4 py-3 text-[14.5px] leading-relaxed text-ink outline-none transition-colors placeholder:text-muted/70 hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red";

function Counter({ value, max }: { value: string; max: number }) {
  return <span className={cn("text-[11.5px] num", value.length > max * 0.9 ? "text-[#9a5b00]" : "text-muted")}>{value.length} / {max}</span>;
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1.5 text-xs text-red">{msg}</p> : null;
}

export function CampaignEditor({
  id,
  status,
  initial,
  products,
  vendorName,
  adminRemarks,
  slots,
}: {
  id?: number;
  status?: InsCampaignStatus;
  initial: CampaignInput;
  products: CampaignProductOption[];
  vendorName: string;
  adminRemarks?: string | null;
  slots: { used: number; limit: number | null; planName: string };
}) {
  const router = useRouter();
  const { toast } = useUI();
  const [form, setForm] = useState<CampaignInput>(initial);
  const [saved, setSaved] = useState<CampaignInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const live = Boolean(status && !CAMPAIGN_DRAFT_STATUSES.includes(status));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const flags = useMemo(() => complianceFlags(form.title, form.summary, form.description, form.ctaLabel), [form.title, form.summary, form.description, form.ctaLabel]);
  const start = fromIstParts(form.startDate, form.startTime);
  const end = fromIstParts(form.endDate, form.endTime);
  const days = start && end && end > start ? Math.ceil((end.getTime() - start.getTime()) / 86_400_000) : null;
  const names = products.filter((p) => form.productIds.includes(p.id)).map((p) => p.name);
  const full = slots.limit !== null && slots.used >= slots.limit;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof CampaignInput>(k: K, v: CampaignInput[K], ...clear: string[]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      const keys = [k, ...clear].filter((x) => x in e);
      if (!keys.length) return e;
      const next = { ...e };
      for (const x of keys) delete next[x];
      return next;
    });
  };

  const toggleProduct = (pid: number) => set("productIds", form.productIds.includes(pid) ? form.productIds.filter((x) => x !== pid) : [...form.productIds, pid]);

  const save = async () => {
    setBusy("save");
    const res = await saveInsCampaignDraftAction({ ...form, id }).catch(() => OFFLINE);
    setBusy(null);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return toast(res.error ?? "Couldn't save the draft.", { tone: "error" });
    }
    setSaved(form);
    setErrors({});
    const left = Object.keys(res.issues).length;
    toast(left ? `Draft ${res.reference} saved — ${left} thing${left === 1 ? "" : "s"} to finish before submitting.` : `Draft ${res.reference} saved — ready to submit.`, { tone: "success" });
    if (!id) router.replace(`/insurance-vendor/campaigns/${res.id}/edit`);
    else router.refresh();
  };

  const submit = async () => {
    setBusy("submit");
    const res = await submitInsCampaignAction({ ...form, id, confirmRules: agreed }).catch(() => OFFLINE);
    setBusy(null);
    if (!res.ok) {
      const fe = res.fieldErrors ?? {};
      setErrors(fe);
      if (Object.keys(fe).some((k) => k !== "confirmRules")) setConfirm(false);
      return toast(res.error ?? "Couldn't submit the campaign.", { tone: "error" });
    }
    setSaved(form);
    setConfirm(false);
    toast(`${res.reference} sent to MarchGear for approval.`, { tone: "success" });
    router.push(`/insurance-vendor/campaigns/${res.id}`);
  };

  const dateError = errors.startsAt ?? errors.startDate ?? errors.startTime;
  const endError = errors.endsAt ?? errors.endDate ?? errors.endTime;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        {adminRemarks && (status === "changes_requested" || status === "rejected") && (
          <Callout tone={status === "rejected" ? "red" : "amber"} icon={<MessageSquareWarning />} title="MarchGear says" className="mb-5">
            <p className="whitespace-pre-line">{adminRemarks}</p>
          </Callout>
        )}
        {live && (
          <Callout tone="blue" icon={<Info />} title="This campaign is approved" className="mb-5">
            Your changes go back to MarchGear for approval. While they&apos;re reviewed, the campaign is taken off the insurance pages.
          </Callout>
        )}

        <div className="@container border border-line bg-white p-5 sm:p-7">
          <FormSection title="Basics" description="What customers see first. Keep it factual — MarchGear checks every campaign against the insurance advertising rules.">
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <Label htmlFor="cmp-title" className="mb-0">
                    Title
                  </Label>
                  <Counter value={form.title} max={CAMPAIGN_LIMITS.title} />
                </div>
                <TextField id="cmp-title" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={CAMPAIGN_LIMITS.title} placeholder="e.g. Renew your car cover before it lapses" error={errors.title} />
              </div>
              <SelectField
                label="Campaign type"
                value={form.type}
                onChange={(e) => set("type", e.target.value as CampaignInput["type"])}
                placeholder="Choose a type"
                options={INS_CAMPAIGN_TYPES.map((t) => ({ value: t, label: INS_CAMPAIGN_TYPE_LABEL[t] }))}
                error={errors.type}
              />
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <Label htmlFor="cmp-summary" className="mb-0">
                    Summary
                  </Label>
                  <Counter value={form.summary} max={CAMPAIGN_LIMITS.summary} />
                </div>
                <textarea
                  id="cmp-summary"
                  rows={3}
                  value={form.summary}
                  onChange={(e) => set("summary", e.target.value)}
                  maxLength={CAMPAIGN_LIMITS.summary}
                  aria-invalid={errors.summary ? true : undefined}
                  placeholder="One or two lines on what the campaign offers — shown on the campaign card."
                  className={area}
                />
                <FieldError msg={errors.summary} />
              </div>
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <Label htmlFor="cmp-description" className="mb-0">
                    Description <span className="font-normal text-muted">(optional)</span>
                  </Label>
                  <Counter value={form.description} max={CAMPAIGN_LIMITS.description} />
                </div>
                <textarea
                  id="cmp-description"
                  rows={5}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  maxLength={CAMPAIGN_LIMITS.description}
                  aria-invalid={errors.description ? true : undefined}
                  placeholder="Who it's for, what's covered, any conditions customers should know."
                  className={area}
                />
                <FieldError msg={errors.description} />
              </div>
            </div>
          </FormSection>

          <FormSection title="Products" description="The published products this campaign promotes. Customers who enquire from the campaign are tagged with it.">
            {products.length === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-[4px] border border-dashed border-ink/20 bg-[#FAFAFA] p-5 sm:flex-row sm:items-center">
                <PackageOpen className="size-5 shrink-0 text-muted" aria-hidden />
                <p className="flex-1 text-[13.5px] text-muted">You have no published products yet. Campaigns can only promote products that are live on MarchGear.</p>
                <Button href="/insurance-vendor/products" variant="outline" size="sm">
                  Your products
                </Button>
              </div>
            ) : (
              <fieldset className="min-w-0">
                <legend className="sr-only">Products</legend>
                <ul className={cn("divide-y divide-line overflow-hidden rounded-[4px] border", errors.productIds ? "border-red" : "border-line")}>
                  {products.map((p) => {
                    const on = form.productIds.includes(p.id);
                    return (
                      <li key={p.id}>
                        <label className={cn("flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors", on ? "bg-[#FAFAFA]" : "hover:bg-[#FAFAFA]")}>
                          <input type="checkbox" checked={on} onChange={() => toggleProduct(p.id)} className="peer sr-only" />
                          <span
                            aria-hidden
                            className={cn(
                              "inline-flex size-5 shrink-0 items-center justify-center rounded-[3px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ink/30",
                              on ? "border-ink bg-ink text-white" : "border-ink/25 bg-white",
                            )}
                          >
                            {on && <Check className="size-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium">{p.name}</span>
                            <span className="block truncate text-[12px] text-muted">
                              <span className="font-mono">{p.reference}</span> · {INS_PRODUCT_CATEGORY_LABEL[p.category]}
                            </span>
                          </span>
                          {!p.published && <span className="shrink-0 rounded-full bg-[#fdf3e1] px-2 py-0.5 text-[11px] font-semibold text-[#9a5b00]">Not published</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-1.5 flex justify-between gap-3">
                  <FieldError msg={errors.productIds} />
                  <p className="ml-auto text-[12px] text-muted num">{form.productIds.length} selected</p>
                </div>
              </fieldset>
            )}
          </FormSection>

          <FormSection title="Creative" description="A banner is optional — without one, the card uses a clean MarchGear panel. Use 1600×700 or wider, without small text.">
            <div className="space-y-5">
              <InsImageUploader
                value={form.banner ? [form.banner] : []}
                onChange={(urls) => set("banner", urls[0] ?? "")}
                label="Upload banner"
                aspect="aspect-[16/7]"
                hint="JPEG, PNG or WebP. It's resized in your browser before uploading."
                error={errors.banner}
              />
              <div>
                <TextField
                  label="Button label"
                  value={form.ctaLabel}
                  onChange={(e) => set("ctaLabel", e.target.value)}
                  maxLength={CAMPAIGN_LIMITS.cta}
                  placeholder={CTA_DEFAULT}
                  error={errors.ctaLabel}
                  hint={`Leave empty for “${CTA_DEFAULT}”. The button takes customers to the promoted products.`}
                />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {CTA_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set("ctaLabel", s)}
                      className={cn("h-8 rounded-full border px-3 text-[12.5px] transition-colors", form.ctaLabel === s ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40")}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection title="Schedule" description="India time (IST). Once approved, the campaign goes live on its start and ends on its own — no action needed.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Starts</Label>
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
                  <input type="date" aria-label="Start date" value={form.startDate} onChange={(e) => set("startDate", e.target.value, "startsAt")} aria-invalid={dateError ? true : undefined} className={cn(area, "h-12 py-0")} />
                  <input type="time" aria-label="Start time" value={form.startTime} onChange={(e) => set("startTime", e.target.value, "startsAt")} aria-invalid={dateError ? true : undefined} className={cn(area, "h-12 py-0")} />
                </div>
                <FieldError msg={dateError} />
              </div>
              <div>
                <Label>Ends</Label>
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
                  <input type="date" aria-label="End date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => set("endDate", e.target.value, "endsAt")} aria-invalid={endError ? true : undefined} className={cn(area, "h-12 py-0")} />
                  <input type="time" aria-label="End time" value={form.endTime} onChange={(e) => set("endTime", e.target.value, "endsAt")} aria-invalid={endError ? true : undefined} className={cn(area, "h-12 py-0")} />
                </div>
                <FieldError msg={endError} />
              </div>
            </div>
            <p className="mt-3 text-[12.5px] text-muted">{days ? `Runs for ${days} day${days === 1 ? "" : "s"}.` : "Choose both dates to see how long it runs."} Campaigns can run for up to a year.</p>
          </FormSection>

          <FormSection title="Compliance" description="Promotions on MarchGear must follow the insurance advertising rules. MarchGear rejects campaigns that don't.">
            <ul className="space-y-2.5">
              {COMPLIANCE_RULES.map((r) => (
                <li key={r} className="flex gap-2.5 text-[13.5px] leading-relaxed">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red" aria-hidden />
                  {r}
                </li>
              ))}
            </ul>
            {flags.length > 0 && (
              <Callout tone="amber" icon={<AlertTriangle />} title="Check your wording" className="mt-4">
                <ul className="list-disc space-y-1 pl-4">
                  {flags.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </Callout>
            )}
          </FormSection>

          <div className="mt-2 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12.5px] text-muted">{busy === "save" ? "Saving…" : dirty ? "You have unsaved changes." : id ? "All changes saved." : "Not saved yet."}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {!live && (
                <Button variant="outline" onClick={save} disabled={busy !== null || (!dirty && Boolean(id))} icon={busy === "save" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}>
                  Save draft
                </Button>
              )}
              <Button
                onClick={() => {
                  setAgreed(false);
                  setConfirm(true);
                }}
                disabled={busy !== null}
                icon={<Send className="size-4" aria-hidden />}
              >
                {live ? "Resubmit for approval" : "Submit for approval"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <aside className="min-w-0 space-y-4 xl:sticky xl:top-24 xl:self-start">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Live preview</p>
          <p className="text-[11.5px] text-muted">Updates as you type</p>
        </div>
        <CampaignPreview title={form.title} summary={form.summary} type={form.type} banner={form.banner || null} ctaLabel={form.ctaLabel || null} vendorName={vendorName} endsAt={end} products={names} />
        <p className="text-[12px] leading-relaxed text-muted">How your campaign appears on MarchGear&apos;s insurance pages once approved. Final placement and layout are decided by MarchGear.</p>
        <div className={cn("border px-4 py-3 text-[12.5px] leading-relaxed", full && !live ? "border-red/25 bg-red-50 text-[#8f1418]" : "border-line bg-white text-muted")}>
          <p>
            <span className="font-semibold text-ink num">
              {slots.used} of {slots.limit ?? "unlimited"}
            </span>{" "}
            campaign slots used on your {slots.planName} plan (live, scheduled, paused or in review).
          </p>
          {full && !live && (
            <p className="mt-1">
              You can save drafts, but you&apos;ll need a free slot to submit.{" "}
              <Link href="/insurance-vendor/billing" className="font-medium text-ink underline underline-offset-4">
                Compare plans
              </Link>
            </p>
          )}
        </div>
      </aside>

      <Modal open={confirm} onClose={() => busy === null && setConfirm(false)} title={live ? "Resubmit for approval?" : "Submit for approval?"} size="md">
        <div className="space-y-5 px-6 py-6 sm:px-8">
          <p className="text-[14px] leading-relaxed text-muted">
            {live
              ? "MarchGear reviews your changes before the campaign goes back on the insurance pages. Until then it's offline."
              : "MarchGear reviews the campaign, usually within two working days. You'll get a notification when it's decided."}
          </p>
          {flags.length > 0 && (
            <Callout tone="amber" icon={<AlertTriangle />} title="Your wording may break the rules">
              <ul className="list-disc space-y-1 pl-4">
                {flags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Callout>
          )}
          <label className="flex cursor-pointer gap-3 rounded-[4px] border border-line bg-[#FAFAFA] p-4">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[#111111]" data-autofocus />
            <span className="text-[13.5px] leading-relaxed">
              This campaign follows the insurance advertising rules: no inducements or rebates, no misleading claims, and only discounts the insurer has filed.
            </span>
          </label>
          {errors.confirmRules && <p className="-mt-3 text-xs text-red">{errors.confirmRules}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={busy !== null}>
              Keep editing
            </Button>
            <Button onClick={submit} disabled={busy !== null || !agreed} icon={busy === "submit" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}>
              {live ? "Resubmit" : "Submit"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
