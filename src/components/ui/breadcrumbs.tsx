import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl } from "@/components/seo/site";

export interface Crumb {
  label: string;
  href?: string;
}

/** The trail as schema.org BreadcrumbList (the last crumb is the current page, so it carries no URL). */
function breadcrumbList(all: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href && i < all.length - 1 ? { item: absoluteUrl(c.href) } : {}),
    })),
  };
}

export function Breadcrumbs({ items, tone = "dark", className }: { items: Crumb[]; tone?: "dark" | "light"; className?: string }) {
  const all: Crumb[] = [{ label: "Home", href: "/" }, ...items];
  return (
    <nav aria-label="Breadcrumb" className={cn("text-[12.5px]", className)}>
      <JsonLd data={breadcrumbList(all)} />
      <ol className="flex flex-wrap items-center gap-1.5">
        {all.map((item, i) => {
          const last = i === all.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className={cn(
                    "transition-colors duration-[250ms]",
                    tone === "dark" ? "text-muted hover:text-ink" : "text-white/60 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={tone === "dark" ? "text-ink" : "text-white"}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight aria-hidden className={cn("size-3", tone === "dark" ? "text-muted/60" : "text-white/40")} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
