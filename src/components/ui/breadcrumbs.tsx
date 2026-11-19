import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, tone = "dark", className }: { items: Crumb[]; tone?: "dark" | "light"; className?: string }) {
  const all: Crumb[] = [{ label: "Home", href: "/" }, ...items];
  return (
    <nav aria-label="Breadcrumb" className={cn("text-[12.5px]", className)}>
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
