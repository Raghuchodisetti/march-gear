import Image from "next/image";
import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";
import { Eyebrow } from "./section-heading";
import { cn } from "@/lib/utils";
import { BrandLogo, brandSlugFromName, hasBrandLogo, logoFit } from "./brand-logo";

/**
 * Inner-page opener. Without an image it's a quiet, typographic header on
 * white; with an image it becomes a dark, full-bleed editorial banner.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  crumbs,
  image,
  imageFocus,
  children,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  crumbs: Crumb[];
  image?: string;
  imageFocus?: string;
  children?: ReactNode;
  className?: string;
}) {
  if (image) {
    return (
      <section className={cn("relative isolate overflow-hidden bg-ink text-white", className)}>
        <Image
          src={image}
          alt=""
          fill
          preload
          sizes="100vw"
          className="-z-10 animate-kenburns object-cover opacity-60"
          style={{ objectPosition: imageFocus ?? "50% 55%" }}
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/50 to-ink/20" />
        <div className="container-x pb-14 pt-10 md:pb-20 md:pt-14">
          <Breadcrumbs items={crumbs} tone="light" />
          <div className="mt-16 max-w-3xl animate-rise md:mt-28">
            {eyebrow && <Eyebrow tone="light">{eyebrow}</Eyebrow>}
            <h1 className="type-h1 mt-5 text-balance">{title}</h1>
            {description && <p className="type-lead mt-5 max-w-2xl text-white/70">{description}</p>}
          </div>
          {children && <div className="mt-10">{children}</div>}
        </div>
      </section>
    );
  }

  return (
    <section className={cn("border-b border-line", className)}>
      <div className="container-x pb-12 pt-8 md:pb-16 md:pt-10">
        <Breadcrumbs items={crumbs} />
        <div className="mt-10 max-w-3xl animate-rise md:mt-14">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1 className="type-h1 mt-5 text-balance">{title}</h1>
          {description && <p className="type-lead mt-5 max-w-2xl text-muted">{description}</p>}
        </div>
        {children && <div className="mt-10">{children}</div>}
      </div>
    </section>
  );
}

/** Typographic brand tile — avoids reproducing manufacturer logos. */
/** Brand tile: the manufacturer's mark when we have one, initials otherwise (e.g. dealers). */
export function BrandMonogram({ name, className, tone = "light" }: { name: string; className?: string; tone?: "light" | "dark" }) {
  const slug = brandSlugFromName(name);
  if (slug && hasBrandLogo(slug)) {
    return (
      <span aria-hidden className={cn("inline-flex items-center justify-center overflow-hidden", className, "bg-white ring-1 ring-inset ring-line")}>
        <BrandLogo slug={slug} className={logoFit(slug)} />
      </span>
    );
  }
  const letters = name
    .replace(/-/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center font-display font-semibold tracking-[-0.04em] [font-stretch:115%]",
        tone === "light" ? "bg-mist text-ink" : "bg-white/10 text-white",
        className,
      )}
    >
      {letters}
    </span>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-line px-6 py-20 text-center">
      {icon && <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-mist text-ink">{icon}</div>}
      <h3 className="type-h3">{title}</h3>
      {description && <p className="mt-2 max-w-md text-[15px] text-muted">{description}</p>}
      {action && <div className="mt-7">{action}</div>}
    </div>
  );
}

/** Icon + label + value spec cell. */
export function Spec({ icon, label, value, tone = "dark", className }: { icon?: ReactNode; label: string; value: ReactNode; tone?: "dark" | "light"; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      {icon && <span className={cn("mt-0.5 shrink-0 [&>svg]:size-[18px]", tone === "dark" ? "text-ink/70" : "text-white/60")}>{icon}</span>}
      <div className="min-w-0">
        <p className={cn("text-[12px]", tone === "dark" ? "text-muted" : "text-white/55")}>{label}</p>
        <p className={cn("mt-0.5 text-[15px] font-medium num", tone === "dark" ? "text-ink" : "text-white")}>{value}</p>
      </div>
    </div>
  );
}
