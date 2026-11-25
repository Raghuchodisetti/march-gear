import type { CSSProperties, ReactNode } from "react";
import { ArrowUpRight, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DESKTOP_ASPECT, MOBILE_ASPECT } from "./shared";

/* ──────────────────────────────────────────────────────────────
   The banner creative as visitors see it. Server-safe (no hooks),
   so <AdSlot> renders it on the server and the booking wizard and
   admin reuse it for live previews.

   - "responsive": a <picture> with the mobile image below 768px and
     the desktop one above; the box takes each image's recommended
     aspect ratio, so nothing shifts while it loads.
   - "desktop" / "mobile": one fixed variant (previews).
   ────────────────────────────────────────────────────────────── */

export interface BannerContent {
  desktopImage: string | null;
  mobileImage: string | null;
  alt: string;
  headline?: string | null;
  body?: string | null;
  ctaLabel?: string | null;
  advertiser: string;
}

/** The small "Sponsored · Advertiser" tag. Also used on sponsored product cards. */
export function SponsoredTag({ advertiser, className, tone = "glass" }: { advertiser?: string | null; className?: string; tone?: "glass" | "plain" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.5 rounded-[3px] px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em]",
        tone === "glass" ? "bg-white/90 text-ink shadow-[0_1px_2px_rgb(17_17_17/0.08)] backdrop-blur-sm" : "bg-mist text-ink/75 ring-1 ring-inset ring-line",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-red" />
      <span className="shrink-0">Sponsored</span>
      {advertiser && (
        <>
          <span aria-hidden className="shrink-0 text-ink/35">
            ·
          </span>
          <span className="truncate normal-case tracking-normal">{advertiser}</span>
        </>
      )}
    </span>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <span className="flex size-full flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(135deg,#f3f3f3_0_10px,#ececec_10px_20px)] text-[12px] text-muted">
      <ImageIcon aria-hidden className="size-5" />
      {label}
    </span>
  );
}

export function BannerView({
  ad,
  variant = "responsive",
  desktopAspect = DESKTOP_ASPECT,
  mobileAspect = MOBILE_ASPECT,
  href,
  priority,
  className,
  footer,
}: {
  ad: BannerContent;
  variant?: "responsive" | "desktop" | "mobile";
  desktopAspect?: string;
  mobileAspect?: string;
  /** Wraps the banner in a link (the click route) when set. */
  href?: string;
  priority?: boolean;
  className?: string;
  footer?: ReactNode;
}) {
  const hasText = Boolean(ad.headline || ad.body || ad.ctaLabel);
  const R = variant === "responsive";
  const D = variant === "desktop";
  const style = { "--ad-m": mobileAspect, "--ad-d": desktopAspect } as CSSProperties;
  const label = [ad.headline || ad.alt, `Sponsored by ${ad.advertiser}`].filter(Boolean).join(" — ");

  // Layout classes: mobile = text at the bottom, desktop = text on the left, vertically centred below the
  // Sponsored tag (pt-12 keeps the tag's corner clear). Headline and body are clamped to two lines each, so
  // even the longest copy fits the box. Mobile padding is scoped below md so it never fights the desktop one.
  const box = R ? "aspect-[var(--ad-m)] md:aspect-[var(--ad-d)]" : D ? "aspect-[var(--ad-d)]" : "aspect-[var(--ad-m)]";
  const scrim = R
    ? "bg-gradient-to-t from-ink/80 via-ink/25 to-transparent md:bg-gradient-to-r md:from-ink/75 md:via-ink/30 md:to-transparent"
    : D
      ? "bg-gradient-to-r from-ink/75 via-ink/30 to-transparent"
      : "bg-gradient-to-t from-ink/80 via-ink/25 to-transparent";
  const text = R
    ? "inset-x-0 bottom-0 max-md:p-4 max-md:@md:p-5 md:inset-y-0 md:right-auto md:flex md:w-[58%] md:flex-col md:items-start md:justify-center md:px-[clamp(1.25rem,3.4cqw,3.5rem)] md:pb-[clamp(0.75rem,3cqw,3rem)] md:pt-12"
    : D
      ? "inset-y-0 left-0 flex w-[58%] flex-col items-start justify-center px-[clamp(1rem,3.4cqw,3.5rem)] pb-[clamp(0.75rem,3cqw,3rem)] pt-12"
      : "inset-x-0 bottom-0 p-4 @md:p-5";
  const headline = R
    ? "text-[clamp(1.125rem,5.4cqw,1.625rem)] md:text-[clamp(1rem,2.5cqw,2.125rem)]"
    : D
      ? "text-[clamp(0.9375rem,2.5cqw,2.125rem)]"
      : "text-[clamp(1.125rem,5.4cqw,1.625rem)]";
  // The tag lines up with the text column (same left inset).
  const tag = R
    ? "left-4 top-3 max-md:@md:left-5 max-md:@md:top-4 md:left-[clamp(1.25rem,3.4cqw,3.5rem)] md:top-[clamp(0.75rem,1.8cqw,1.5rem)]"
    : D
      ? "left-[clamp(1rem,3.4cqw,3.5rem)] top-[clamp(0.75rem,1.8cqw,1.5rem)]"
      : "left-4 top-3 @md:left-5 @md:top-4";
  const body = R ? "line-clamp-2 md:hidden md:@3xl:line-clamp-2" : D ? "hidden @3xl:line-clamp-2" : "line-clamp-2";

  const inner = (
    <span className={cn("@container relative block w-full overflow-hidden rounded-[4px] bg-mist", box)} style={style}>
      {ad.desktopImage || ad.mobileImage ? (
        R ? (
          <picture className="absolute inset-0 block">
            {ad.desktopImage && <source media="(min-width: 768px)" srcSet={ad.desktopImage} />}
            {/* Advertiser creative from /media — plain <img> inside <picture> on purpose. */}
            <img
              src={ad.mobileImage || ad.desktopImage || ""}
              alt={ad.alt}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              className="size-full object-cover transition-transform duration-[900ms] ease-[var(--ease-premium)] group-hover/ad:scale-[1.025]"
            />
          </picture>
        ) : (D ? ad.desktopImage : ad.mobileImage) ? (
          // Preview of an uploaded creative.
          // eslint-disable-next-line @next/next/no-img-element
          <img decoding="async" src={(D ? ad.desktopImage : ad.mobileImage) ?? ""} alt={ad.alt} className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="absolute inset-0">
            <Placeholder label={D ? "Upload the desktop banner" : "Upload the mobile banner"} />
          </span>
        )
      ) : (
        <span className="absolute inset-0">
          <Placeholder label="Your banner appears here" />
        </span>
      )}

      {hasText && <span aria-hidden className={cn("pointer-events-none absolute inset-0", scrim)} />}

      <span className={cn("absolute z-[1] max-w-[calc(100%-1.5rem)]", tag)}>
        <SponsoredTag advertiser={ad.advertiser} />
      </span>

      {hasText && (
        <span className={cn("absolute z-[1] block text-white", text)}>
          {ad.headline && <span className={cn("line-clamp-2 font-display font-semibold leading-[1.08] tracking-[-0.02em] [text-wrap:balance]", headline)}>{ad.headline}</span>}
          {ad.body && <span className={cn("mt-1.5 max-w-[46ch] text-[13px] leading-snug text-white/85 @5xl:text-[15px]", body)}>{ad.body}</span>}
          {ad.ctaLabel && (
            <span className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[3px] bg-white px-3.5 text-[13px] font-semibold text-ink transition-colors duration-300 group-hover/ad:bg-red group-hover/ad:text-white @5xl:mt-4 @5xl:h-10 @5xl:px-4 @5xl:text-[13.5px]">
              {ad.ctaLabel}
              <ArrowUpRight aria-hidden className="size-4 transition-transform duration-300 group-hover/ad:-translate-y-0.5 group-hover/ad:translate-x-0.5" />
            </span>
          )}
        </span>
      )}
    </span>
  );

  return (
    <div className={className}>
      {href ? (
        <a href={href} rel="sponsored noopener" aria-label={label} className="group/ad block rounded-[4px] outline-offset-4">
          {inner}
        </a>
      ) : (
        <div className="group/ad">{inner}</div>
      )}
      {footer}
    </div>
  );
}
