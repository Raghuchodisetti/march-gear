"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sections of the public insurance site. `also` lists extra path prefixes that light the item up. */
export const INSURANCE_NAV: { label: string; href: string; also?: string[] }[] = [
  { label: "Overview", href: "/insurance" },
  { label: "Types", href: "/insurance/types" },
  { label: "Compare", href: "/insurance/compare", also: ["/insurance/products"] },
  { label: "Quotes", href: "/insurance/quotes", also: ["/insurance/quote"] },
  { label: "Providers", href: "/insurance/providers" },
  { label: "New car", href: "/insurance/new-car" },
  { label: "Renewal", href: "/insurance/renewal" },
  { label: "Used car", href: "/insurance/used-car" },
  { label: "EV", href: "/insurance/ev" },
  { label: "Add-ons", href: "/insurance/add-ons" },
  { label: "Claims", href: "/insurance/claims" },
  { label: "Guides", href: "/insurance/guides", also: ["/insurance/articles"] },
];

const under = (pathname: string, root: string) => pathname === root || pathname.startsWith(`${root}/`);

function isActive(pathname: string, item: (typeof INSURANCE_NAV)[number]) {
  if (item.href === "/insurance") return pathname === "/insurance";
  return [item.href, ...(item.also ?? [])].some((r) => under(pathname, r));
}

/** Sticky section navigation under the site header, on every /insurance page. Scrolls sideways on small screens. */
export function InsuranceSubnav() {
  const pathname = usePathname() ?? "/insurance";
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the current section in view when the bar scrolls sideways (mobile).
  useEffect(() => {
    const el = scroller.current;
    const on = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !on) return;
    const left = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: "auto" });
  }, [pathname]);

  return (
    <nav aria-label="Insurance" className="sticky top-[72px] z-30 border-b border-line bg-white/95 backdrop-blur-md">
      <div className="container-x flex h-12 items-stretch gap-6">
        <Link href="/insurance" className="hidden shrink-0 items-center gap-2 pr-2 text-[13px] font-semibold tracking-[-0.005em] xl:flex">
          <ShieldCheck aria-hidden className="size-4 text-red" />
          Insurance
          <span aria-hidden className="ml-4 h-5 w-px bg-line" />
        </Link>
        <div className="relative min-w-0 flex-1">
          <div ref={scroller} className="no-scrollbar flex h-full items-stretch overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)] lg:[mask-image:none]">
            <ul className="flex shrink-0 items-stretch gap-0.5 pr-8 lg:pr-0">
              {INSURANCE_NAV.map((item) => {
                const on = isActive(pathname, item);
                return (
                  <li key={item.href} className="flex">
                    <Link
                      href={item.href}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "relative flex items-center whitespace-nowrap px-2.5 text-[13.5px] transition-colors duration-[250ms] xl:px-3",
                        on ? "font-medium text-ink" : "text-muted hover:text-ink",
                      )}
                    >
                      {item.label}
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-x-2.5 bottom-0 h-[2px] origin-left bg-red transition-transform duration-[350ms] ease-[var(--ease-premium)] xl:inset-x-3",
                          on ? "scale-x-100" : "scale-x-0",
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <Link
          href="/insurance#quote"
          className="group hidden shrink-0 items-center gap-1.5 self-center rounded-[3px] bg-ink px-3.5 py-2 text-[12.5px] font-medium text-white transition-colors duration-[250ms] hover:bg-red md:inline-flex"
        >
          Get quotes
          <ArrowRight aria-hidden className="size-3.5 transition-transform duration-[250ms] group-hover:translate-x-0.5" />
        </Link>
      </div>
    </nav>
  );
}
