import Image from "next/image";
import { BRAND_LOGOS } from "@/data/brand-logos";
import { cn } from "@/lib/utils";

/* Full-colour manufacturer logos (local files in /public/brands).
   Logos keep their original colours, so they always sit on a light surface. */

const NAME_TO_SLUG: Record<string, string> = {
  "Maruti Suzuki": "maruti-suzuki",
  Hyundai: "hyundai",
  "Tata Motors": "tata",
  Tata: "tata",
  Mahindra: "mahindra",
  Toyota: "toyota",
  Honda: "honda",
  Kia: "kia",
  Skoda: "skoda",
  MG: "mg",
  BYD: "byd",
  Tesla: "tesla",
  BMW: "bmw",
  "Mercedes-Benz": "mercedes-benz",
  Audi: "audi",
  "Land Rover": "land-rover",
  Porsche: "porsche",
  Ford: "ford",
  Volkswagen: "volkswagen",
  Jaguar: "jaguar",
  Nissan: "nissan",
  Fiat: "fiat",
};

export const brandSlugFromName = (name: string) => NAME_TO_SLUG[name];

export const hasBrandLogo = (slug?: string) => Boolean(slug && BRAND_LOGOS[slug]);

/** Width ÷ height of the trimmed artwork. */
export function logoAspect(slug: string) {
  const logo = BRAND_LOGOS[slug];
  return logo ? logo.width / logo.height : 1;
}

/**
 * Height-based sizing inside a fixed-height box, stepped by proportion so a
 * round badge and a long wordmark carry the same visual weight.
 */
export function logoFit(slug: string) {
  const a = logoAspect(slug);
  if (a < 1.25) return "h-[66%]";
  if (a < 1.75) return "h-[54%]";
  if (a < 2.3) return "h-[46%]";
  return "h-[36%]";
}

export function BrandLogo({ slug, className, title }: { slug: string; className?: string; title?: string }) {
  const logo = BRAND_LOGOS[slug];
  if (!logo) return null;
  return (
    <Image
      src={logo.src}
      alt={title ?? ""}
      width={logo.width}
      height={logo.height}
      unoptimized
      draggable={false}
      className={cn("w-auto max-w-[80%] object-contain", className)}
    />
  );
}

/** Initials for a brand with no logo file: "Aston Martin" → "AM", "Citroën" → "C". */
export const brandInitials = (name: string) =>
  name
    .replace(/-/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * The brand's logo, or — for brands added before their logo file (public/brands/<slug>.webp) exists — a
 * typographic monogram sized to sit in the same box. Pass `logoClassName` for the logo's own sizing.
 */
export function BrandMark({ slug, name, className, logoClassName }: { slug: string; name: string; className?: string; logoClassName?: string }) {
  if (hasBrandLogo(slug)) return <BrandLogo slug={slug} className={cn(logoFit(slug), logoClassName)} />;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex aspect-square h-[62%] max-h-14 items-center justify-center rounded-full border border-ink/15 font-display text-[clamp(13px,1.1vw+8px,19px)] font-semibold tracking-[-0.04em] text-ink/75 [font-stretch:112%]",
        className,
      )}
    >
      {brandInitials(name)}
    </span>
  );
}
