"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Calculator, Check, Clock3, Loader2, Lock, Save, Send } from "lucide-react";
import type { InsProductCategory, InsProductStatus, InsVendorCategory } from "@/db/enums";
import { CATEGORY_TERMS, DEFAULT_PRODUCT_PRICING } from "@/insurance/estimator";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { useCatalog } from "@/components/providers/catalog-provider";
import { useUI } from "@/components/providers/app-provider";
import { ConfirmDialog } from "@/components/portal/profile/kit";
import { saveProductAction } from "@/server/actions/ins-products";
import { IndicativePreview } from "./preview-panel";
import type { Group } from "./section";
import { BasicsSection, EligibilitySection, InsurerSection } from "./sections-a";
import { AddOnsSection, CoverageSection, DeductiblesSection, DocumentsSection, ExclusionsSection, GaragesSection, PricingSection, TermsSection } from "./sections-b";
import {
  PRODUCT_LIVE,
  PRODUCT_LOCKED,
  SECTIONS,
  coverageForCategory,
  isIntermediary,
  pricingConfigOf,
  readiness,
  sectionOf,
  type CompanyOption,
  type CoverOption,
  type ProductFormValue,
  type SectionKey,
} from "./shared";

/* ──────────────────────────────────────────────────────────────
   Create / edit an insurance product: eleven sections with a
   sticky section nav (scroll-spy, readiness ticks), a live
   indicative preview and a fixed action bar. "Save draft" works
   any time; "Submit for approval" needs everything MarchGear
   checks. Editing an approved or published product sends it back
   to review (offline until re-approved) — confirmed first.
   ────────────────────────────────────────────────────────────── */

export interface ProductFormProps {
  product?: { id: number; reference: string; status: InsProductStatus; submittedAt: string | null };
  initial: ProductFormValue;
  covers: CoverOption[];
  companies: CompanyOption[];
  vendorCategory: InsVendorCategory | null;
  canManage: boolean;
  /** Opened from a failed "Submit" in the list — show what's missing straight away. */
  check?: boolean;
}

export function ProductForm({ product, initial, covers, companies, vendorCategory, canManage, check }: ProductFormProps) {
  const router = useRouter();
  const { toast } = useUI();
  const cat = useCatalog();
  const config = useMemo(() => pricingConfigOf(cat.content.insurancePricing), [cat.content.insurancePricing]);
  const [v, setV] = useState<ProductFormValue>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [confirmLive, setConfirmLive] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [active, setActive] = useState<SectionKey>("basics");
  const [showMissing, setShowMissing] = useState(Boolean(check));
  const navRef = useRef<HTMLDivElement>(null);

  const status = product?.status;
  const live = status ? PRODUCT_LIVE.includes(status) : false;
  const locked = !canManage || (status ? PRODUCT_LOCKED.includes(status) : false);
  const dirty = JSON.stringify(v) !== saved;
  const intermediary = isIntermediary(vendorCategory);
  const ready = useMemo(() => readiness(v, { intermediary, covers, config }), [v, intermediary, covers, config]);
  const readyCount = SECTIONS.filter((s) => ready[s.key].ok).length;
  const errorSections = useMemo(() => new Set(Object.keys(errors).map(sectionOf)), [errors]);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty || locked) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, locked]);

  // Scroll-spy for the section nav.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(`sec-${s.key}`)).filter((x): x is HTMLElement => Boolean(x));
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.getAttribute("data-section") as SectionKey);
      },
      { rootMargin: "-140px 0px -55% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Keep the active chip in view inside the horizontally scrolling nav.
  useEffect(() => {
    const chip = navRef.current?.querySelector<HTMLElement>(`[data-nav="${active}"]`);
    const nav = navRef.current;
    if (!chip || !nav) return;
    const left = chip.offsetLeft - nav.clientWidth / 2 + chip.clientWidth / 2;
    nav.scrollTo({ left, behavior: "smooth" });
  }, [active]);

  const clear = (keys: string[]) =>
    setErrors((e) => {
      if (!keys.some((k) => Object.keys(e).some((x) => x === k || x.startsWith(`${k}.`)))) return e;
      const n = { ...e };
      for (const x of Object.keys(n)) if (keys.some((k) => x === k || x.startsWith(`${k}.`))) delete n[x];
      return n;
    });
  const set = <K extends keyof ProductFormValue>(k: K, val: ProductFormValue[K]) => {
    setV((x) => ({ ...x, [k]: val }));
    clear([k as string]);
  };
  const setIn = <G extends Group>(g: G, p: Partial<ProductFormValue[G]>) => {
    setV((x) => ({ ...x, [g]: { ...x[g], ...p } }));
    clear(Object.keys(p).map((k) => `${g}.${k}`).concat(g === "coverage" ? ["coverage"] : []));
  };
  const err = (k: string) => errors[k];

  const onCategory = (category: InsProductCategory) => {
    const t = CATEGORY_TERMS[category];
    const d = DEFAULT_PRODUCT_PRICING(category, config);
    const cov = coverageForCategory(category);
    setV((x) => ({
      ...x,
      category,
      coverage: { ...x.coverage, ...cov, tpPropertyLimit: cov.thirdParty ? x.coverage.tpPropertyLimit || "₹7.5 lakh" : x.coverage.tpPropertyLimit },
      pricing: { ...x.pricing, odYears: String(t.odYears || d.odYears), tpYears: String(t.tpYears || d.tpYears) },
    }));
    clear(["category", "coverage", "pricing.odYears", "pricing.tpYears"]);
  };

  const jump = (key: SectionKey) => document.getElementById(`sec-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const save = async (intent: "draft" | "submit", acknowledgeLive = false) => {
    setConfirmLive(false);
    setSaving(intent);
    try {
      const res = await saveProductAction({ id: product?.id, intent, acknowledgeLive, values: v });
      if (!res.ok) {
        const fe = res.fieldErrors ?? {};
        setErrors(fe);
        setShowMissing(true);
        toast(res.error ?? "Couldn't save. Please try again.", { tone: "error" });
        const keys = Object.keys(fe);
        if (keys.length) {
          requestAnimationFrame(() => {
            const el = Array.from(document.querySelectorAll<HTMLElement>("[data-field]")).find((n) => keys.some((k) => k === n.dataset.field || k.startsWith(`${n.dataset.field}.`)));
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            else jump(sectionOf(keys[0]));
          });
        }
        return;
      }
      setErrors({});
      setSaved(JSON.stringify(v));
      if (res.status === "pending_approval") {
        toast(`${res.reference} sent to MarchGear for approval`, { tone: "success" });
        if (!product) router.replace(`/insurance-vendor/products/${res.id}`);
        router.refresh();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      toast(product ? `${res.reference} saved` : `Draft ${res.reference} created`, { tone: "success" });
      if (!product) router.replace(`/insurance-vendor/products/${res.id}`);
      router.refresh();
    } catch {
      toast("Couldn't reach the server. Please try again.", { tone: "error" });
    } finally {
      setSaving(null);
    }
  };
  const request = (intent: "draft" | "submit") => (live ? setConfirmLive(true) : save(intent));

  const stateOf = (key: SectionKey, optional = false): "ready" | "todo" | "error" | "optional" =>
    errorSections.has(key) ? "error" : optional && ready[key].ok && ready[key].note === "Optional" ? "optional" : ready[key].ok ? "ready" : "todo";
  const props = { v, set, setIn, err, disabled: locked };
  const busy = saving !== null;
  const missing = SECTIONS.filter((s) => !ready[s.key].ok);
  const companyGarages = companies.find((c) => String(c.id) === v.companyId)?.garages ?? null;

  return (
    // Enter in a field must never submit for approval, so the buttons act directly.
    <form noValidate onSubmit={(e) => e.preventDefault()} className={cn(!locked && "pb-28")}>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {/* Section nav */}
          <div className="sticky top-16 z-20 -mx-4 mb-6 border-b border-line bg-[#F6F6F6]/95 px-4 backdrop-blur md:-mx-8 md:px-8 xl:mx-0 xl:border xl:bg-white/95 xl:px-2">
            <div ref={navRef} className="no-scrollbar relative flex gap-1 overflow-x-auto py-2" role="navigation" aria-label="Form sections">
              {SECTIONS.map((s, i) => {
                const st = stateOf(s.key);
                const on = active === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    data-nav={s.key}
                    onClick={() => jump(s.key)}
                    aria-current={on ? "true" : undefined}
                    className={cn("inline-flex h-9 shrink-0 items-center gap-2 rounded-[3px] px-2.5 text-[12.5px] font-medium transition-colors duration-200", on ? "bg-ink text-white" : "text-muted hover:bg-mist hover:text-ink")}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "inline-flex size-[18px] items-center justify-center rounded-full text-[10px] num",
                        st === "ready" ? (on ? "bg-white text-ink" : "bg-[#e8f5ec] text-[#1e7a3c]") : st === "error" ? "bg-red text-white" : on ? "border border-white/40" : "border border-line",
                      )}
                    >
                      {st === "ready" ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                    </span>
                    {s.label}
                    <span className="sr-only">{st === "ready" ? " — ready" : st === "error" ? " — needs checking" : " — to do"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            {live && canManage && (
              <div className="flex gap-3 border border-line border-l-2 border-l-red bg-white px-4 py-3 text-[13.5px]" role="note">
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
                <p>
                  <span className="font-semibold">This product is {status === "published" ? "live on the website" : "approved"}.</span> Saving any change sends it back to MarchGear for approval
                  {status === "published" ? " and takes it off the website until it's approved again" : " — it can't be published until then"}.
                </p>
              </div>
            )}
            {showMissing && missing.length > 0 && !locked && (
              <div className="border border-line border-l-2 border-l-[#c98a1b] bg-white px-4 py-3 text-[13.5px]" role="status">
                <p className="font-semibold">To submit for approval, complete:</p>
                <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  {missing.map((s) => (
                    <li key={s.key}>
                      <button type="button" onClick={() => jump(s.key)} className="text-[13px] text-[#9a5b00] underline-offset-4 hover:underline">
                        {s.label} — {ready[s.key].note.toLowerCase()}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <fieldset disabled={locked} className="min-w-0 space-y-6">
              <BasicsSection {...props} state={stateOf("basics")} onCategory={onCategory} />
              <InsurerSection {...props} state={stateOf("insurer")} companies={companies} vendorCategory={vendorCategory} />
              <EligibilitySection {...props} state={stateOf("eligibility")} maxAge={config.maxVehicleAgeYears} />
              <CoverageSection {...props} state={stateOf("coverage")} covers={covers} />
              <AddOnsSection {...props} state={stateOf("addons", true)} covers={covers} />
              <PricingSection {...props} state={stateOf("pricing")} config={config} />
              <DeductiblesSection {...props} state={stateOf("deductibles")} />
              <GaragesSection {...props} state={stateOf("garages", true)} companyGarages={companyGarages} />
              <ExclusionsSection {...props} state={stateOf("exclusions")} />
              <DocumentsSection {...props} state={stateOf("documents")} />
              <TermsSection {...props} state={stateOf("terms", true)} />
            </fieldset>
          </div>
        </div>

        {/* Readiness + preview */}
        <aside className="hidden min-w-0 xl:block">
          <div className="no-scrollbar space-y-4 xl:sticky xl:top-[5.5rem] xl:max-h-[calc(100dvh-6.5rem)] xl:overflow-y-auto xl:pb-24">
            <section className="border border-line bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12.5px] font-medium text-muted">{product ? product.reference : "New product"}</p>
                <p className="text-[12.5px] font-medium num">
                  {readyCount} / {SECTIONS.length} ready
                </p>
              </div>
              <span aria-hidden className="mt-3 block h-1 overflow-hidden rounded-full bg-mist">
                <span className={cn("block h-full rounded-full transition-[width] duration-700", readyCount === SECTIONS.length ? "bg-[#1e7a3c]" : "bg-red")} style={{ width: `${(readyCount / SECTIONS.length) * 100}%` }} />
              </span>
              <p className={cn("mt-3 text-[12.5px]", readyCount === SECTIONS.length ? "font-medium text-[#1e7a3c]" : "text-muted")}>
                {readyCount === SECTIONS.length ? "Everything MarchGear needs is filled in." : `${missing.map((s) => s.label).slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""} still to do. Drafts save any time.`}
              </p>
            </section>
            <IndicativePreview v={v} covers={covers} config={config} />
          </div>
        </aside>
      </div>

      {/* Action bar */}
      {!locked && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:left-[264px]">
          <div className="mx-auto flex max-w-[1384px] items-center justify-between gap-3 px-4 py-3 md:px-8">
            <p className="hidden min-w-0 truncate text-[13px] text-muted sm:block" aria-live="polite">
              {saving ? "Saving…" : dirty ? <span className="text-ink">Unsaved changes</span> : product ? "All changes saved" : "Not saved yet"}
              <span className="text-muted"> · {readyCount} of {SECTIONS.length} sections ready</span>
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button variant="ghost" size="sm" className="xl:hidden" icon={<Calculator aria-hidden className="size-4" />} onClick={() => setPreviewOpen(true)}>
                <span className="hidden sm:inline">Preview</span>
                <span className="sr-only sm:hidden">Indicative preview</span>
              </Button>
              {!live && (
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none" disabled={busy} onClick={() => request("draft")} icon={saving === "draft" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Save aria-hidden className="size-4" />}>
                  Save draft
                </Button>
              )}
              <Button size="sm" className="flex-1 sm:flex-none" disabled={busy || (live && !dirty)} onClick={() => request("submit")} icon={saving === "submit" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}>
                <span className="sm:hidden">{live || product?.submittedAt ? "Resubmit" : "Submit"}</span>
                <span className="hidden sm:inline">{live ? "Save and resubmit" : product?.submittedAt ? "Resubmit for approval" : "Submit for approval"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
      {locked && status && canManage && (
        <p className="mt-6 flex items-center gap-2 text-[13px] text-muted">
          {status === "suspended" ? <Lock aria-hidden className="size-4" /> : <Clock3 aria-hidden className="size-4" />}
          {status === "suspended" ? "Suspended by MarchGear — the product is locked." : "Waiting for MarchGear's review — the product is locked until it's decided. Withdraw it above to make changes."}
        </p>
      )}

      <Drawer open={previewOpen} onClose={() => setPreviewOpen(false)} title="Indicative preview" className="sm:max-w-md">
        <div className="p-4">
          <IndicativePreview v={v} covers={covers} config={config} className="border-0" bare />
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmLive}
        onClose={() => setConfirmLive(false)}
        title={status === "published" ? "Take this product offline and resubmit?" : "Send this approved product back for approval?"}
        confirm="Save and resubmit"
        tone="primary"
        busy={busy}
        onConfirm={() => save("submit", true)}
        body={
          <>
            Your changes go back to MarchGear for approval.{" "}
            <strong className="font-semibold text-ink">{status === "published" ? "The product goes offline — customers can't see it or ask for quotes until it's approved again." : "It stays offline until it's approved again."}</strong>
          </>
        }
      />
    </form>
  );
}
