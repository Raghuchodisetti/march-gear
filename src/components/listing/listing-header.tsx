import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";
import { Eyebrow } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils";
import { SwapText } from "./swap-text";

/**
 * Typographic opener for listing pages. Visually matches PageHeader, but
 * renders without an entrance animation so the server fallback and the
 * filter-aware client version swap seamlessly; the title cross-fades when
 * filters change it.
 */
export function ListingHeader({
  crumbs,
  eyebrow,
  title,
  description,
  aside,
  children,
  className,
}: {
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-line", className)}>
      <div className="container-x pb-8 pt-8 md:pb-12 md:pt-10">
        <Breadcrumbs items={crumbs} />
        <div className="mt-10 grid grid-cols-1 gap-8 md:mt-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-16">
          <div className="max-w-3xl">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="type-h1 mt-5 min-h-[1em] text-balance">
              <SwapText text={title} />
            </h1>
            {description && <p className="type-lead mt-5 max-w-2xl text-muted">{description}</p>}
          </div>
          {aside}
        </div>
        {children && <div className="mt-10">{children}</div>}
      </div>
    </section>
  );
}
