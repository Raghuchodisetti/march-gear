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
