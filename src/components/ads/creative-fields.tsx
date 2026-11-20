"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { Segmented, TextArea, TextField } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { BannerView } from "./banner";
import { DESKTOP_ASPECT, MOBILE_ASPECT, aspectOf, sizeLabel } from "./shared";

/* ──────────────────────────────────────────────────────────────
   Banner creative fields with a live preview — the vendor wizard
   (uploads) and the admin house-campaign form (media picker) pass
   their own image control through `renderImage`.
   ────────────────────────────────────────────────────────────── */

export interface CreativeDraft {
  name: string;
  desktopImage: string | null;
  mobileImage: string | null;
  headline: string;
  body: string;
  ctaLabel: string;
  alt: string;
}

export const EMPTY_CREATIVE: CreativeDraft = { name: "", desktopImage: null, mobileImage: null, headline: "", body: "", ctaLabel: "", alt: "" };

export const creativePayload = (c: CreativeDraft) => ({
  name: c.name.trim() || null,
  desktopImage: c.desktopImage,
  mobileImage: c.mobileImage,
  headline: c.headline.trim() || null,
  body: c.body.trim() || null,
  ctaLabel: c.ctaLabel.trim() || null,
  alt: c.alt.trim(),
});

export interface ImageSlotProps {
  slot: "desktop" | "mobile";
  value: string | null;
  onChange: (url: string | null) => void;
  error?: string;
  /** Aspect class for thumbnails (the recommended ratio, via a CSS variable set by the wrapper). */
  aspectClass: string;
  size: string;
}

const counter = (v: string, max: number) => `${v.length}/${max}`;

export function CreativeFields({
  value,
  onChange,
  errors,
  sizes,
  advertiser,
  renderImage,
  prefix = "creative",
  showName = false,
}: {
  value: CreativeDraft;
  /** Receives updater functions too (uploads finish asynchronously — never overwrite a newer value). */
  onChange: (next: CreativeDraft | ((prev: CreativeDraft) => CreativeDraft)) => void;
  errors: Record<string, string>;
  sizes: { desktopSize: string | null; mobileSize: string | null };
  advertiser: string;
  renderImage: (p: ImageSlotProps) => ReactNode;
  prefix?: string;
  showName?: boolean;
}) {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const set = <K extends keyof CreativeDraft>(k: K, v: CreativeDraft[K]) => onChange((prev) => ({ ...prev, [k]: v }));
  const err = (k: string) => errors[`${prefix}.${k}`];
  const dAspect = aspectOf(sizes.desktopSize, DESKTOP_ASPECT);
  const mAspect = aspectOf(sizes.mobileSize, MOBILE_ASPECT);
  // Thumbnails take the recommended ratio through a CSS variable (class names can't be built at runtime).
  const thumb = "aspect-[var(--ad-thumb)]";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[12.5px] font-medium">
            <Monitor aria-hidden className="size-4 text-muted" /> Desktop banner
          </p>
          <p className="mb-2.5 text-[12px] text-muted">
            Recommended <span className="font-medium text-ink num">{sizeLabel(sizes.desktopSize)}</span> · shown from tablet width up
          </p>
          <div style={{ "--ad-thumb": dAspect } as CSSProperties}>
            {renderImage({ slot: "desktop", value: value.desktopImage, onChange: (u) => set("desktopImage", u), error: err("desktopImage"), aspectClass: thumb, size: sizes.desktopSize ?? "" })}
          </div>
        </div>
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[12.5px] font-medium">
            <Smartphone aria-hidden className="size-4 text-muted" /> Mobile banner
          </p>
          <p className="mb-2.5 text-[12px] text-muted">
            Recommended <span className="font-medium text-ink num">{sizeLabel(sizes.mobileSize)}</span> · shown on phones
          </p>
          <div style={{ "--ad-thumb": mAspect } as CSSProperties}>
            {renderImage({ slot: "mobile", value: value.mobileImage, onChange: (u) => set("mobileImage", u), error: err("mobileImage"), aspectClass: thumb, size: sizes.mobileSize ?? "" })}
          </div>
        </div>
      </div>
      <p className="-mt-2 text-[12px] leading-relaxed text-muted">
        Keep logos and key text away from the edges — the banner is cropped to fit, never stretched. Text below is optional: leave it empty if your images already carry the message.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {showName && <TextField label="Creative name (for your records)" value={value.name} maxLength={120} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Monsoon renewal — version A" className="md:col-span-2" />}
        <TextField label="Headline (optional)" value={value.headline} maxLength={120} onChange={(e) => set("headline", e.target.value)} placeholder="e.g. Renew in minutes, keep your NCB" hint={counter(value.headline, 120)} error={err("headline")} />
        <TextField label="Button label (optional)" value={value.ctaLabel} maxLength={40} onChange={(e) => set("ctaLabel", e.target.value)} placeholder="e.g. See plans" hint={counter(value.ctaLabel, 40)} error={err("ctaLabel")} />
        <div className="md:col-span-2">
          <TextArea label="Supporting text (optional)" value={value.body} maxLength={240} rows={2} onChange={(e) => set("body", e.target.value)} placeholder="One short sentence. Shown under the headline on wider screens." />
          <p className={cn("mt-1.5 text-xs", err("body") ? "text-red" : "text-muted")}>{err("body") ?? counter(value.body, 240)}</p>
        </div>
        <TextField
          label="Alt text"
          value={value.alt}
          maxLength={200}
          onChange={(e) => set("alt", e.target.value)}
          placeholder="Describe the banner, e.g. Family car on a coastal road with the offer text"
          hint="Read out by screen readers. Required."
          error={err("alt")}
          className="md:col-span-2"
        />
      </div>

      <div className="border border-line bg-[#F6F6F6] p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="type-eyebrow text-muted">Live preview</p>
          <Segmented
            ariaLabel="Preview size"
            value={view}
            onChange={setView}
            options={[
              { value: "desktop", label: "Desktop" },
              { value: "mobile", label: "Mobile" },
            ]}
          />
        </div>
        {/* The desktop banner is previewed at a realistic width (scrolls sideways on a phone). */}
        <div className={cn("mx-auto", view === "mobile" ? "max-w-[360px]" : "max-w-none overflow-x-auto pb-1")}>
          <BannerView
            className={view === "desktop" ? "min-w-[640px]" : undefined}
            variant={view}
            desktopAspect={dAspect}
            mobileAspect={mAspect}
            ad={{ desktopImage: value.desktopImage, mobileImage: value.mobileImage, alt: value.alt || "Banner preview", headline: value.headline, body: value.body, ctaLabel: value.ctaLabel, advertiser }}
          />
        </div>
        {view === "desktop" && <p className="mt-2 text-[11.5px] text-muted md:hidden">Scroll sideways to see the whole desktop banner.</p>}
        <p className="mt-3 text-[12px] text-muted">How it appears on the site, with the Sponsored label MarchGear adds. Clicks go through MarchGear so they can be counted.</p>
      </div>
    </div>
  );
}
