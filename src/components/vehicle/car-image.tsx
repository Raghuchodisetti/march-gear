import Image from "next/image";
import type { CSSProperties } from "react";
import type { BodyType, CarModel } from "@/types";
import { cn } from "@/lib/utils";
import { PROFILES } from "./silhouettes";

/* ──────────────────────────────────────────────────────────────
   Catalogue photos, with a neutral placeholder for models whose
   licensed photos haven't been uploaded yet. Server- and
   client-safe (no hooks). The placeholder adapts to its box with
   container queries: a thumbnail shows only the silhouette, a
   card adds "Photos coming soon", a hero adds the model name.
   ────────────────────────────────────────────────────────────── */

/** The body-type profile as line art; `paint` fills the body with a colour swatch (e.g. the selected factory colour). */
export function CarSilhouette({ bodyType, className, paint }: { bodyType: BodyType; className?: string; paint?: string }) {
  const p = PROFILES[bodyType] ?? PROFILES.SUV;
  const cy = 73;
  return (
    <svg viewBox="0 0 240 96" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <ellipse cx="120" cy="86" rx="104" ry="3.2" fill="currentColor" stroke="none" opacity="0.12" />
      <path d={p.body} strokeWidth="1.6" vectorEffect="non-scaling-stroke" fill={paint} style={paint ? { transition: "fill 400ms ease" } : undefined} />
      {p.glass.map((d) => (
        <path key={d} d={d} strokeWidth="1.1" opacity="0.7" vectorEffect="non-scaling-stroke" fill={paint ? "#ffffff" : undefined} fillOpacity={paint ? 0.55 : undefined} />
      ))}
      {p.extra && <path d={p.extra} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />}
      {p.wheels.map((x) => (
        <g key={x}>
          <circle cx={x} cy={cy} r={p.r} strokeWidth="1.6" vectorEffect="non-scaling-stroke" fill={paint ? "#1c1c1c" : undefined} />
          <circle cx={x} cy={cy} r={p.r * 0.42} strokeWidth="1.1" opacity="0.7" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </svg>
  );
}

/**
 * Fills its (relative, sized) parent like an `<Image fill>`: a light panel with the body-type silhouette,
 * "Photos coming soon", and — in large boxes — the model name.
 */
export function CarPlaceholder({
  bodyType,
  name,
  className,
  tone = "light",
  label = "Photos coming soon",
  paint,
}: {
  bodyType: BodyType;
  /** Shown in large boxes only (heroes); cards already print the name. */
  name?: string;
  className?: string;
  tone?: "light" | "dark";
  label?: string | null;
  /** Fill the silhouette with a colour swatch. */
  paint?: string;
}) {
  const dark = tone === "dark";
  return (
    <div
      role="img"
      aria-label={name ? `${name} — photos coming soon` : "Photos coming soon"}
      className={cn(
        "@container absolute inset-0 flex flex-col items-center justify-center overflow-hidden",
        dark ? "bg-[radial-gradient(120%_90%_at_50%_45%,#2a2a2a_0%,#161616_70%)] text-white" : "bg-[radial-gradient(120%_90%_at_50%_42%,#fbfbfb_0%,#f0f0f0_72%)] text-ink",
        className,
      )}
    >
      <CarSilhouette bodyType={bodyType} paint={paint} className={cn("w-[62%] max-w-[560px] @max-[90px]:w-[78%]", paint ? "text-ink/45" : dark ? "text-white/35" : "text-ink/30")} />
      {name && <p className={cn("mt-[3cqw] hidden max-w-[86%] truncate text-center font-display text-[clamp(15px,3.2cqw,30px)] font-semibold tracking-[-0.02em] @[420px]:block", dark ? "text-white/85" : "text-ink/80")}>{name}</p>}
      {label && (
        <p className={cn("mt-2 hidden items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] @[150px]:flex @[420px]:mt-2.5 @[420px]:text-[11px]", dark ? "text-white/55" : "text-muted")}>
          <span className={cn("size-1.5 rounded-full", dark ? "bg-white/40" : "bg-ink/25")} aria-hidden />
          {label}
        </p>
      )}
    </div>
  );
}

type PhotoCar = Pick<CarModel, "images" | "bodyType" | "name"> & { focus?: string };

/**
 * A catalogue car's photo (`index`, falling back to the first) as an `<Image fill>`, or the placeholder when the
 * model has no photos yet. The parent must be `relative` and sized, as for any `fill` image.
 */
export function CarImage({
  car,
  index = 0,
  alt,
  sizes,
  className,
  style,
  preload,
  quality,
  name,
  label,
  tone,
  placeholderClassName,
}: {
  car: PhotoCar;
  index?: number;
  alt: string;
  sizes: string;
  className?: string;
  style?: CSSProperties;
  preload?: boolean;
  quality?: number;
  /** Placeholder: the model name for large boxes. */
  name?: string;
  label?: string | null;
  tone?: "light" | "dark";
  placeholderClassName?: string;
}) {
  const src = car.images[index] ?? car.images[0];
  if (!src) return <CarPlaceholder bodyType={car.bodyType} name={name} label={label} tone={tone} className={placeholderClassName} />;
  return <Image src={src} alt={alt} fill sizes={sizes} preload={preload} quality={quality} className={className} style={style} />;
}

const BODY_TYPES: readonly string[] = ["SUV", "Sedan", "Hatchback", "MUV", "Coupe"];
/** A stored body-type string (partner listings, saved items keep it as text) as a BodyType for the placeholder. */
export const asBodyType = (b: string | null | undefined): BodyType => (b && BODY_TYPES.includes(b) ? (b as BodyType) : "SUV");

/** The model's first photo, or undefined — for places that build their own `<Image>` or need a URL (OG, JSON-LD). */
export const primaryImage = (car: Pick<CarModel, "images">) => car.images[0] || undefined;
