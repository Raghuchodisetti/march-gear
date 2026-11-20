"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, ExternalLink, Globe, MapPin, MessageCircle, Plus, X } from "lucide-react";
import type { PartnerProfile } from "@/partner/types";
import { cn } from "@/lib/utils";
import { savePublicProfileAction } from "@/server/actions/partner-profile";
import { ImageUploader } from "@/components/portal/uploader";
import { HoursEditor } from "@/components/portal/showrooms/hours-editor";
import { hoursSummary } from "@/components/portal/showrooms/shared";
import { FacebookIcon, InstagramIcon, YoutubeIcon } from "@/components/ui/social-icons";
import { FieldError, FormSection, SaveBar, inputCls, useAction } from "./kit";

const FACILITIES = [
  "Customer lounge",
  "Free Wi-Fi",
  "Test-drive fleet",
  "Service centre",
  "Body & paint shop",
  "Finance desk",
  "Insurance desk",
  "Exchange evaluation",
  "Accessories store",
  "EV charging",
  "Wheelchair access",
  "Kids' play area",
  "Ample parking",
  "Café",
  "Doorstep test drives",
  "Pick-up & drop",
];

export interface ListingContext {
  name: string;
  city: string;
  area: string;
  brandLabel: string;
  publicId: string | null;
  approved: boolean;
}

export function PublicProfileForm({ initial, listing }: { initial: PartnerProfile; listing: ListingContext }) {
  const router = useRouter();
  const [v, setV] = useState<PartnerProfile>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [custom, setCustom] = useState("");
  const { busy, errors, run } = useAction();
  const dirty = JSON.stringify(v) !== saved;
  const set = <K extends keyof PartnerProfile>(k: K, value: PartnerProfile[K]) => setV((p) => ({ ...p, [k]: value }));
  const setSocial = (k: keyof PartnerProfile["socials"], value: string) => setV((p) => ({ ...p, socials: { ...p.socials, [k]: value } }));

  const toggleFacility = (f: string) => set("facilities", v.facilities.includes(f) ? v.facilities.filter((x) => x !== f) : [...v.facilities, f]);
  const addCustom = () => {
    const f = custom.trim().replace(/\s+/g, " ");
    if (f.length < 2 || v.facilities.includes(f)) return;
    set("facilities", [...v.facilities, f.slice(0, 60)]);
    setCustom("");
  };

  const save = async () => {
    const res = await run(() => savePublicProfileAction(v), listing.approved ? "Profile saved — your public page is updated." : "Profile saved.");
    if (res) {
      setSaved(JSON.stringify(v));
      router.refresh();
    }
  };

  const extraFacilities = v.facilities.filter((f) => !FACILITIES.includes(f));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="@container min-w-0 border border-line bg-white p-5 md:p-7">
        <FormSection title="Logo & banner" description="Your logo appears in the portal and on your public page. The banner is the large photo at the top of your listing.">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[160px_minmax(0,1fr)]">
            <div className="max-w-[160px]">
              <p className="mb-2 text-[12.5px] font-medium">Logo</p>
              <ImageUploader value={v.logo ? [v.logo] : []} onChange={(u) => set("logo", u[0] ?? "")} label="Upload logo" aspect="aspect-square" error={errors.logo} />
            </div>
            <div>
              <p className="mb-2 text-[12.5px] font-medium">Banner</p>
              <ImageUploader value={v.banner ? [v.banner] : []} onChange={(u) => set("banner", u[0] ?? "")} label="Upload banner" aspect="aspect-[16/9]" hint="Landscape, at least 1600 px wide." error={errors.banner} />
            </div>
          </div>
        </FormSection>

        <FormSection title="About your dealership" description="What makes your showroom worth the visit — brands, experience, service promises.">
          <textarea
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            rows={6}
            maxLength={2000}
            aria-label="Business description"
            aria-invalid={Boolean(errors.description) || undefined}
            placeholder="Family-run since 2009, we're Bengaluru's longest-serving authorised dealer for… "
            className={cn(inputCls, "h-auto py-3 leading-relaxed")}
          />
          <div className="mt-1.5 flex justify-between gap-4">
            <FieldError msg={errors.description} />
            <span className="ml-auto text-xs text-muted num">{v.description.length} / 2000</span>
          </div>
        </FormSection>

        <FormSection title="Showroom gallery" description="Up to 12 photos of your showroom, lounge, workshop and team. The first is the cover.">
          <ImageUploader value={v.gallery} onChange={(u) => set("gallery", u)} multiple max={12} label="Add photos" error={errors.gallery} />
        </FormSection>

        <FormSection title="Business hours" description="Shown on your public page. Each branch can also have its own hours under Showrooms.">
          <HoursEditor value={v.hours} onChange={(h) => set("hours", h)} errors={errors} />
          <p className="mt-3 text-[12.5px] text-muted">
            Public summary: <span className="font-medium text-ink">{hoursSummary(v.hours)}</span>
          </p>
        </FormSection>

        <FormSection title="Facilities" description="Pick everything customers can expect at your showroom.">
          <div className="flex flex-wrap gap-2">
            {[...FACILITIES, ...extraFacilities].map((f) => {
              const on = v.facilities.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleFacility(f)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors duration-300",
                    on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/80 hover:border-ink/40",
                  )}
                >
                  {f}
                  {on && !FACILITIES.includes(f) && <X aria-hidden className="size-3.5" />}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex max-w-md gap-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
              maxLength={60}
              placeholder="Add another facility"
              aria-label="Add another facility"
              className={inputCls}
            />
            <button type="button" onClick={addCustom} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[3px] border border-line px-3.5 text-[13px] font-medium hover:border-ink">
              <Plus aria-hidden className="size-4" /> Add
            </button>
          </div>
          <FieldError msg={errors.facilities} />
        </FormSection>

        <FormSection title="Website & social" description="Links open from your public page.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(
              [
                ["website", "Website", "https://yourdealership.in"],
                ["instagram", "Instagram", "https://instagram.com/yourdealership"],
                ["facebook", "Facebook", "https://facebook.com/yourdealership"],
                ["youtube", "YouTube", "https://youtube.com/@yourdealership"],
                ["whatsapp", "WhatsApp number", "98765 43210"],
              ] as const
            ).map(([k, label, ph]) => (
              <div key={k}>
                <label htmlFor={`social-${k}`} className="mb-1.5 block text-[12.5px] font-medium">
                  {label}
                </label>
                <input id={`social-${k}`} value={v.socials[k]} onChange={(e) => setSocial(k, e.target.value)} placeholder={ph} inputMode={k === "whatsapp" ? "tel" : "url"} className={inputCls} aria-invalid={Boolean(errors[`socials.${k}`]) || undefined} />
                <FieldError msg={errors[`socials.${k}`]} />
              </div>
            ))}
          </div>
        </FormSection>

        <SaveBar
          busy={busy}
          dirty={dirty}
          onSave={save}
          onReset={() => setV(JSON.parse(saved))}
          label="Save profile"
          note={dirty ? "Unsaved changes — the preview shows them already." : listing.approved ? "Changes go live on your public page as soon as you save. No re-approval needed." : "Saved. Your public page goes live once your dealership is approved."}
        />
      </div>

      <aside className="min-w-0">
        <div className="xl:sticky xl:top-24">
          <p className="mb-3 flex items-center justify-between text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
            Live preview
            {listing.publicId && (
              <a href={`/dealers/${listing.publicId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 normal-case tracking-normal text-ink hover:text-red">
                Open public page <ExternalLink aria-hidden className="size-3.5" />
              </a>
            )}
          </p>
          <PreviewCard profile={v} listing={listing} />
        </div>
      </aside>
    </div>
  );
}

function PreviewCard({ profile, listing }: { profile: PartnerProfile; listing: ListingContext }) {
  const hours = useMemo(() => hoursSummary(profile.hours), [profile.hours]);
  const cover = profile.banner || profile.gallery[0];
  const s = profile.socials;
  return (
    <article className="overflow-hidden border border-line bg-white">
      <div className="relative aspect-[16/9] bg-ink">
        {cover ? (
          // Dealer-uploaded banner from /media (live preview).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#2c2c2c,#111111_70%)] px-8 text-center text-[12.5px] text-white/50">Add a banner to replace the default showroom photo</div>
        )}
        <span className="absolute -bottom-7 left-5 inline-flex size-16 items-center justify-center overflow-hidden border border-line bg-white text-[15px] font-semibold shadow-soft">
          {profile.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logo} alt="" className="size-full object-contain p-1" />
          ) : (
            listing.name.slice(0, 2).toUpperCase()
          )}
        </span>
      </div>
      <div className="px-5 pb-5 pt-10">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">{listing.brandLabel}</p>
        <h3 className="mt-1.5 font-display text-[20px] font-semibold leading-tight tracking-[-0.02em]">{listing.name}</h3>
        {(listing.area || listing.city) && (
          <p className="mt-2 flex items-start gap-1.5 text-[13px] text-ink/80">
            <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted" />
            {[listing.area, listing.city].filter(Boolean).join(", ")}
          </p>
        )}
        <p className="mt-1 flex items-start gap-1.5 text-[12.5px] text-muted">
          <Clock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {hours}
        </p>
        <p className="mt-4 line-clamp-4 text-[13px] leading-relaxed text-ink/80">{profile.description || `${listing.name} is a MarchGear dealer partner${listing.city ? ` in ${listing.city}` : ""}.`}</p>
        {profile.facilities.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {profile.facilities.slice(0, 6).map((f) => (
              <li key={f} className="bg-mist px-2.5 py-1 text-[11.5px] font-medium text-ink/80">
                {f}
              </li>
            ))}
            {profile.facilities.length > 6 && <li className="px-1 py-1 text-[11.5px] text-muted">+{profile.facilities.length - 6} more</li>}
          </ul>
        )}
        {profile.gallery.length > 1 && (
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {profile.gallery.slice(0, 4).map((g, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${g}-${i}`} src={g} alt="" className="aspect-square w-full object-cover" />
            ))}
          </div>
        )}
        {(s.website || s.instagram || s.facebook || s.youtube || s.whatsapp) && (
          <div className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-muted">
            <span className="sr-only">Links: website and social profiles</span>
            {s.website && <Globe className="size-4" />}
            {s.instagram && <InstagramIcon className="size-4" />}
            {s.facebook && <FacebookIcon className="size-4" />}
            {s.youtube && <YoutubeIcon className="size-4" />}
            {s.whatsapp && <MessageCircle className="size-4" />}
          </div>
        )}
      </div>
    </article>
  );
}
