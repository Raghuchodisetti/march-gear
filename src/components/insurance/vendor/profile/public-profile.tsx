"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Globe, Mail, Phone, ShieldCheck, Wrench } from "lucide-react";
import type { InsurerProfile } from "@/insurance/types";
import { cn } from "@/lib/utils";
import { saveInsurerProfileAction } from "@/server/actions/ins-profile";
import { InsImageUploader } from "@/components/insurance/vendor/uploader";
import { FieldError, FormSection, SaveBar, inputCls, useAction } from "@/components/portal/profile/kit";

/* The public profile tab: logo, about, contacts and support hours (+ the cashless network for insurers), with a live card preview. */

type Value = InsurerProfile & { garageCount: string; garageNote: string };

export function PublicProfileForm({
  initial,
  name,
  company,
}: {
  initial: Value;
  name: string;
  /** The insurer's own company listing (mirrored on save), or null for intermediaries / not linked yet. */
  company: { name: string; slug: string; isActive: boolean } | null;
}) {
  const router = useRouter();
  const [v, setV] = useState<Value>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const { busy, errors, run } = useAction();
  const dirty = JSON.stringify(v) !== saved;
  const set = <K extends keyof Value>(k: K, value: Value[K]) => setV((p) => ({ ...p, [k]: value }));

  const save = async () => {
    const res = await run(() => saveInsurerProfileAction(v), company ? "Profile saved — your company listing is updated too." : "Profile saved.");
    if (res) {
      setSaved(JSON.stringify(v));
      router.refresh();
    }
  };

  const input = (k: keyof Value, label: string, opts: { placeholder?: string; type?: string; inputMode?: "tel" | "email" | "url" | "numeric"; hint?: string; wide?: boolean } = {}) => (
    <div className={cn(opts.wide && "sm:col-span-2")}>
      <label htmlFor={`pp-${k}`} className="mb-1.5 block text-[12.5px] font-medium">
        {label}
      </label>
      <input
        id={`pp-${k}`}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        value={String(v[k] ?? "")}
        onChange={(e) => set(k, e.target.value as Value[typeof k])}
        placeholder={opts.placeholder}
        className={inputCls}
        aria-invalid={Boolean(errors[k]) || undefined}
      />
      {errors[k] ? <FieldError msg={errors[k]} /> : opts.hint ? <p className="mt-1.5 text-xs text-muted">{opts.hint}</p> : null}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="@container min-w-0 border border-line bg-white p-5 md:p-7">
        <FormSection title="Logo" description="Shown in the portal and, once you have published products, beside them on the website. A square image on a plain background works best.">
          <div className="max-w-[180px]">
            <InsImageUploader value={v.logo ? [v.logo] : []} onChange={(u) => set("logo", u[0] ?? "")} label="Upload logo" aspect="aspect-square" error={errors.logo} />
          </div>
        </FormSection>

        <FormSection title="About" description="A short introduction customers read on your products and provider page.">
          <textarea
            id="pp-about"
            aria-label="About your company"
            rows={5}
            maxLength={2000}
            value={v.about}
            onChange={(e) => set("about", e.target.value)}
            className={cn(inputCls, "h-auto py-2.5 leading-relaxed")}
            placeholder="Who you are, how long you've been insuring cars, and what makes your service different."
            aria-invalid={Boolean(errors.about) || undefined}
          />
          <div className="mt-1.5 flex justify-between text-xs text-muted">
            <FieldError msg={errors.about} />
            <span className="ml-auto num">{v.about.length.toLocaleString("en-IN")} / 2,000</span>
          </div>
        </FormSection>

        <FormSection title="Support" description="How customers reach you before and after buying.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {input("website", "Website", { placeholder: "https://", inputMode: "url", wide: true })}
            {input("supportPhone", "Support phone", { placeholder: "1800 000 000", inputMode: "tel" })}
            {input("supportEmail", "Support email", { type: "email", inputMode: "email" })}
            {input("supportHours", "Support hours", { placeholder: "e.g. 24×7, or Mon–Sat 9:30–18:30", wide: true })}
          </div>
        </FormSection>

        <FormSection title="Claims" description="Where customers go to make a claim. MarchGear doesn't process claims — these details are shown as you give them.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {input("claimsPhone", "Claims phone", { inputMode: "tel" })}
            {input("claimsEmail", "Claims email", { type: "email", inputMode: "email" })}
          </div>
        </FormSection>

        {company && (
          <FormSection title="Cashless network" description="As stated by you. MarchGear shows it on your company listing; staff may ask for evidence.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
              {input("garageCount", "Network garages", { inputMode: "numeric", placeholder: "e.g. 1200" })}
              {input("garageNote", "Note", { placeholder: "e.g. Across 300 cities" })}
            </div>
          </FormSection>
        )}

        <SaveBar
          busy={busy}
          dirty={dirty}
          onSave={save}
          onReset={() => setV(JSON.parse(saved))}
          note={dirty ? "You have unsaved changes." : company ? `Saving also updates the ${company.name} listing. Claim figures and regulator numbers are managed by MarchGear.` : "Changes publish straight away — no re-approval."}
        />
      </div>

      <aside className="min-w-0 space-y-3 xl:sticky xl:top-24 xl:self-start">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">How customers see it</p>
        <article className="border border-line bg-white">
          <div className="flex items-center gap-4 border-b border-line p-5">
            <span className="inline-flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-line bg-mist">
              {/* Vendor-uploaded logo from /media. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {v.logo ? <img src={v.logo} alt="" className="size-full object-contain p-1" /> : <ShieldCheck aria-hidden className="size-6 text-muted" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{company?.name ?? name}</p>
              <p className="text-[12px] text-muted">{company ? "Insurer" : "Registered intermediary"}</p>
            </div>
          </div>
          <div className="space-y-3 p-5 text-[13px]">
            <p className={cn("line-clamp-4 leading-relaxed", v.about ? "text-ink/80" : "text-muted")}>{v.about || "Your introduction appears here."}</p>
            <ul className="space-y-2 text-ink/80">
              {v.website && (
                <li className="flex items-center gap-2">
                  <Globe aria-hidden className="size-3.5 shrink-0 text-muted" /> <span className="min-w-0 truncate">{v.website.replace(/^https?:\/\//, "")}</span>
                </li>
              )}
              {(v.supportPhone || v.supportEmail) && (
                <li className="flex items-center gap-2">
                  <Phone aria-hidden className="size-3.5 shrink-0 text-muted" /> <span className="min-w-0 truncate">{[v.supportPhone, v.supportEmail].filter(Boolean).join(" · ")}</span>
                </li>
              )}
              {v.supportHours && (
                <li className="flex items-center gap-2">
                  <Clock aria-hidden className="size-3.5 shrink-0 text-muted" /> <span className="min-w-0 truncate">{v.supportHours}</span>
                </li>
              )}
              {(v.claimsPhone || v.claimsEmail) && (
                <li className="flex items-center gap-2">
                  <Mail aria-hidden className="size-3.5 shrink-0 text-muted" /> <span className="min-w-0 truncate">Claims: {[v.claimsPhone, v.claimsEmail].filter(Boolean).join(" · ")}</span>
                </li>
              )}
              {company && (v.garageCount || v.garageNote) && (
                <li className="flex items-center gap-2">
                  <Wrench aria-hidden className="size-3.5 shrink-0 text-muted" /> <span className="min-w-0 truncate">{[v.garageCount ? `${Number(v.garageCount).toLocaleString("en-IN")} cashless garages` : "", v.garageNote].filter(Boolean).join(" · ")}</span>
                </li>
              )}
            </ul>
          </div>
        </article>
        <p className="px-1 text-[12px] leading-relaxed text-muted">MarchGear lists insurance products from registered insurers and intermediaries; it doesn&rsquo;t issue policies or settle claims.</p>
      </aside>
    </div>
  );
}
