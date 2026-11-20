"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Building2, Check, Loader2, ShieldAlert, X } from "lucide-react";
import type { InsVendorStatus } from "@/db/enums";
import { INS_VENDOR_STATUS_LABEL } from "@/insurance/labels";
import type { CompanyClaimInfo } from "@/insurance/types";
import { saveInsCompanyAction } from "@/server/actions/admin-insurance-config";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { MediaPickerButton } from "@/components/admin/media-picker";
import { cn } from "@/lib/utils";

/* Create / edit an insurance company (underwriter): profile, network, support, claim information and its insurer vendor. */

export interface CompanyFormValues {
  name: string;
  slug: string;
  shortName: string;
  logo: string;
  about: string;
  website: string;
  regulatorRegNo: string;
  headquarters: string;
  establishedYear: string;
  garageCount: string;
  garageNote: string;
  supportPhone: string;
  claimsPhone: string;
  claimsEmail: string;
  isActive: boolean;
  vendorId: string;
  claim: { settlementRatio: string; year: string; source: string; process: string; verified: boolean };
}

export const emptyCompany: CompanyFormValues = {
  name: "",
  slug: "",
  shortName: "",
  logo: "",
  about: "",
  website: "",
  regulatorRegNo: "",
  headquarters: "",
  establishedYear: "",
  garageCount: "",
  garageNote: "",
  supportPhone: "",
  claimsPhone: "",
  claimsEmail: "",
  isActive: true,
  vendorId: "",
  claim: { settlementRatio: "", year: "", source: "", process: "", verified: false },
};

const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const input = "h-11 w-full rounded-[3px] border border-line bg-white px-3.5 text-[14px] outline-none transition-colors placeholder:text-muted/70 hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red";

function Field({ label, error, hint, children, wide, htmlFor, optional }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; wide?: boolean; htmlFor: string; optional?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")} data-field={htmlFor}>
      <label htmlFor={htmlFor} className="mb-2 block text-[12.5px] font-medium">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {(error || hint) && <p className={cn("mt-1.5 text-xs", error ? "text-red" : "text-muted")}>{error ?? hint}</p>}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="border border-line bg-white">
      <header className="border-b border-line px-5 py-4 md:px-6">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </header>
      <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 md:p-6">{children}</div>
    </section>
  );
}

function Toggle({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-3 rounded-[3px] border px-4 py-3 transition-colors sm:col-span-2", checked ? "border-ink bg-mist/50" : "border-line hover:border-ink/30")}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-red)]" />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[12.5px] text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function CompanyForm({
  companyId,
  initial,
  vendors,
  products,
  claimInfo,
  verifiedByName,
  extra,
}: {
  companyId: number | null;
  initial: CompanyFormValues;
  vendors: { id: number; name: string; reference: string; status: InsVendorStatus; companyId: number | null }[];
  /** Products underwritten by this company (all statuses) and how many are published. */
  products: { total: number; published: number };
  claimInfo: CompanyClaimInfo | null;
  verifiedByName: string | null;
  /** Rendered under the form sections (e.g. the products using the company). */
  extra?: ReactNode;
}) {
  const router = useRouter();
  const { toast } = useUI();
  const [v, setV] = useState<CompanyFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const clear = (key: string) => setErrors((e) => (e[key] ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e));
  const set = <K extends keyof CompanyFormValues>(key: K, value: CompanyFormValues[K]) => {
    setDirty(true);
    setV((p) => ({ ...p, [key]: value, ...(key === "name" && !slugTouched ? { slug: slugify(String(value)) } : {}) }));
    clear(key);
    if (key === "name" && !slugTouched) clear("slug");
  };
  const setClaim = <K extends keyof CompanyFormValues["claim"]>(key: K, value: CompanyFormValues["claim"][K]) => {
    setDirty(true);
    setV((p) => ({ ...p, claim: { ...p.claim, [key]: value } }));
    clear(`claim.${key}`);
  };
  const err = (k: string) => errors[k];
  const aria = (k: string) => ({ "aria-invalid": errors[k] ? true : undefined });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await saveInsCompanyAction(companyId, {
        ...v,
        claim: { ...v.claim, process: v.claim.process.split("\n") },
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast(res.error ?? "Couldn't save. Check the highlighted fields.", { tone: "error" });
        requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" }));
        return;
      }
      setDirty(false);
      setErrors({});
      toast(companyId ? "Company saved" : "Company created", { tone: "success" });
      if (!companyId) router.push(`/admin/insurance/companies/${res.id}`);
      else router.refresh();
    } catch {
      toast("Couldn't reach the server. Please try again.", { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const linkable = vendors.filter((x) => !x.companyId || x.companyId === companyId || String(x.id) === v.vendorId);
  const goingInactive = initial.isActive && !v.isActive && products.published > 0;

  return (
    <form onSubmit={submit} noValidate className="pb-28">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Section title="Company" description="The underwriting insurer as customers see it on /insurance. Use only details you've confirmed with the insurer.">
            <Field label="Name" htmlFor="co-name" error={err("name")}>
              <input id="co-name" value={v.name} onChange={(e) => set("name", e.target.value)} className={input} placeholder="e.g. Acme General Insurance (demo)" {...aria("name")} />
            </Field>
            <Field label="URL slug" htmlFor="co-slug" error={err("slug")} hint="Used in the provider page's web address. Filled in from the name.">
              <input
                id="co-slug"
                value={v.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value.toLowerCase());
                }}
                className={cn(input, "font-mono text-[13px]")}
                {...aria("slug")}
              />
            </Field>
            <Field label="Short name" htmlFor="co-short" optional error={err("shortName")} hint="For tight spaces, e.g. comparison tables.">
              <input id="co-short" value={v.shortName} onChange={(e) => set("shortName", e.target.value)} className={input} {...aria("shortName")} />
            </Field>
            <Field label="Website" htmlFor="co-web" optional error={err("website")}>
              <input id="co-web" value={v.website} onChange={(e) => set("website", e.target.value)} className={input} placeholder="https://" inputMode="url" {...aria("website")} />
            </Field>
            <div className="sm:col-span-2" data-field="co-logo">
              <p className="mb-2 text-[12.5px] font-medium">
                Logo <span className="font-normal text-muted">(optional)</span>
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-line bg-white">
                  {v.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.logo} alt="Logo preview" className="max-h-full max-w-full object-contain p-2" />
                  ) : (
                    <Building2 aria-hidden className="size-6 text-muted" />
                  )}
                </span>
                <div className="flex flex-wrap gap-2">
                  <MediaPickerButton onPick={(urls) => urls[0] && set("logo", urls[0])} />
                  {v.logo && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => set("logo", "")} icon={<X aria-hidden className="size-4" />}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              {err("logo") ? <p className="mt-1.5 text-xs text-red">{err("logo")}</p> : <p className="mt-1.5 text-xs text-muted">Only use a logo the insurer has given you permission to show.</p>}
            </div>
            <Field label="About" htmlFor="co-about" optional wide error={err("about")}>
              <textarea id="co-about" rows={4} value={v.about} onChange={(e) => set("about", e.target.value)} className={cn(input, "h-auto py-2.5 leading-relaxed")} {...aria("about")} />
            </Field>
            <Field label="Headquarters" htmlFor="co-hq" optional error={err("headquarters")}>
              <input id="co-hq" value={v.headquarters} onChange={(e) => set("headquarters", e.target.value)} className={input} placeholder="City" {...aria("headquarters")} />
            </Field>
            <Field label="Established" htmlFor="co-year" optional error={err("establishedYear")}>
              <input id="co-year" value={v.establishedYear} onChange={(e) => set("establishedYear", e.target.value.replace(/\D/g, "").slice(0, 4))} className={input} inputMode="numeric" placeholder="Year" {...aria("establishedYear")} />
            </Field>
            <Field label="Regulator registration number" htmlFor="co-reg" optional wide error={err("regulatorRegNo")} hint="As supplied by the insurer — check it against the regulator's public register.">
              <input id="co-reg" value={v.regulatorRegNo} onChange={(e) => set("regulatorRegNo", e.target.value)} className={cn(input, "font-mono text-[13px]")} {...aria("regulatorRegNo")} />
            </Field>
          </Section>

          <Section title="Network & support" description="Shown on the provider page and product pages.">
            <Field label="Cashless garages" htmlFor="co-garages" optional error={err("garageCount")}>
              <input id="co-garages" value={v.garageCount} onChange={(e) => set("garageCount", e.target.value.replace(/\D/g, "").slice(0, 6))} className={input} inputMode="numeric" {...aria("garageCount")} />
            </Field>
            <Field label="Garage network note" htmlFor="co-gnote" optional error={err("garageNote")}>
              <input id="co-gnote" value={v.garageNote} onChange={(e) => set("garageNote", e.target.value)} className={input} placeholder="e.g. Across 300 cities" {...aria("garageNote")} />
            </Field>
            <Field label="Support phone" htmlFor="co-sphone" optional error={err("supportPhone")}>
              <input id="co-sphone" value={v.supportPhone} onChange={(e) => set("supportPhone", e.target.value)} className={input} inputMode="tel" {...aria("supportPhone")} />
            </Field>
            <Field label="Claims phone" htmlFor="co-cphone" optional error={err("claimsPhone")}>
              <input id="co-cphone" value={v.claimsPhone} onChange={(e) => set("claimsPhone", e.target.value)} className={input} inputMode="tel" {...aria("claimsPhone")} />
            </Field>
            <Field label="Claims email" htmlFor="co-cemail" optional wide error={err("claimsEmail")}>
              <input id="co-cemail" value={v.claimsEmail} onChange={(e) => set("claimsEmail", e.target.value)} className={input} inputMode="email" {...aria("claimsEmail")} />
            </Field>
          </Section>

          <Section
            title="Claim information"
            description={
              <>
                Settlement figures are shown publicly <strong className="font-semibold text-ink">only when verified</strong>, always with the year and the source. Unverified figures stay here for staff; the claim process steps are always public.
              </>
            }
          >
            <Field label="Claim settlement ratio" htmlFor="co-ratio" optional error={err("claim.settlementRatio")}>
              <div className="relative">
                <input id="co-ratio" value={v.claim.settlementRatio} onChange={(e) => setClaim("settlementRatio", e.target.value.replace(/[^\d.]/g, "").slice(0, 6))} className={cn(input, "pr-9")} inputMode="decimal" {...aria("claim.settlementRatio")} />
                <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[13px] text-muted">%</span>
              </div>
            </Field>
            <Field label="For the year" htmlFor="co-cyear" optional error={err("claim.year")}>
              <input id="co-cyear" value={v.claim.year} onChange={(e) => setClaim("year", e.target.value)} className={input} placeholder="e.g. FY 2024-25" {...aria("claim.year")} />
            </Field>
            <Field label="Source" htmlFor="co-source" optional wide error={err("claim.source")} hint="Where the figure comes from, e.g. the regulator's annual report (with the page or table).">
              <input id="co-source" value={v.claim.source} onChange={(e) => setClaim("source", e.target.value)} className={input} {...aria("claim.source")} />
            </Field>
            <Field label="How to make a claim" htmlFor="co-process" optional wide error={err("claim.process")} hint="One step per line.">
              <textarea id="co-process" rows={5} value={v.claim.process} onChange={(e) => setClaim("process", e.target.value)} className={cn(input, "h-auto py-2.5 leading-relaxed")} {...aria("claim.process")} />
            </Field>
            <Toggle
              id="co-verified"
              checked={v.claim.verified}
              onChange={(x) => setClaim("verified", x)}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck aria-hidden className={cn("size-4", v.claim.verified ? "text-[#1e7a3c]" : "text-muted")} /> I&apos;ve verified the ratio, year and source — show them publicly
                </span>
              }
              hint={
                v.claim.verified && claimInfo?.verified && claimInfo.verifiedAt
                  ? `Verified ${new Date(claimInfo.verifiedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })}${verifiedByName ? ` by ${verifiedByName}` : ""}. Changing the figures re-stamps the verification with your name.`
                  : "Saving with this ticked records you as the verifier, with today's date."
              }
            />
            {(err("claim.verified") || (v.claim.verified && (!v.claim.settlementRatio || !v.claim.year || !v.claim.source))) && (
              <p className="flex items-center gap-1.5 text-[12.5px] text-[#9a5b00] sm:col-span-2">
                <ShieldAlert aria-hidden className="size-4 shrink-0" /> Verified figures need the ratio, the year and the source.
              </p>
            )}
          </Section>
          {extra}
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className="border border-line bg-white">
            <header className="border-b border-line px-5 py-3.5">
              <h2 className="text-[14px] font-semibold">Visibility</h2>
            </header>
            <div className="space-y-4 p-5">
              <label htmlFor="co-active" className="flex cursor-pointer items-start gap-3">
                <input id="co-active" type="checkbox" checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-red)]" />
                <span>
                  <span className="block text-[13.5px] font-medium">Active</span>
                  <span className="block text-[12.5px] text-muted">Inactive companies and every product they underwrite are hidden from the website.</span>
                </span>
              </label>
              {goingInactive && (
                <p className="rounded-[3px] border border-[#e09200]/30 bg-[#fdf3e1] px-3 py-2.5 text-[12.5px] text-[#7a4800]">
                  Saving hides {products.published} published product{products.published === 1 ? "" : "s"} from the website. Their vendors are notified.
                </p>
              )}
              <p className="text-[12.5px] text-muted num">
                {products.total} product{products.total === 1 ? "" : "s"} · {products.published} published
              </p>
            </div>
          </section>
          <section className="border border-line bg-white">
            <header className="border-b border-line px-5 py-3.5">
              <h2 className="text-[14px] font-semibold">Insurer vendor</h2>
            </header>
            <div className="p-5" data-field="co-vendor">
              <label htmlFor="co-vendor" className="mb-2 block text-[12.5px] font-medium">
                Linked vendor account
              </label>
              <select id="co-vendor" value={v.vendorId} onChange={(e) => set("vendorId", e.target.value)} className={cn(input, "cursor-pointer")} {...aria("vendorId")}>
                <option value="">Not linked</option>
                {linkable.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · {x.reference}
                    {x.status !== "approved" ? ` (${INS_VENDOR_STATUS_LABEL[x.status].toLowerCase()})` : ""}
                  </option>
                ))}
              </select>
              <p className={cn("mt-1.5 text-xs", err("vendorId") ? "text-red" : "text-muted")}>{err("vendorId") ?? "When the insurer itself sells on MarchGear. Intermediaries are never linked here."}</p>
            </div>
          </section>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:left-64">
        <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-8">
          <p className="text-[13px] text-muted" aria-live="polite">
            {saving ? "Saving…" : dirty ? <span className="text-ink">Unsaved changes</span> : companyId ? "All changes saved" : "New company"}
          </p>
          <div className="flex gap-2">
            <Button href="/admin/insurance/companies" variant="ghost" size="sm">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving} icon={saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}>
              {companyId ? "Save changes" : "Create company"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
