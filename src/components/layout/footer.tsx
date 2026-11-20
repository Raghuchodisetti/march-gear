import Link from "next/link";
import { ArrowUpRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { footerColumns, footerLegal } from "@/data/navigation";
import { getCatalog } from "@/server/catalog";
import { Logo } from "@/components/ui/logo";
import { socials } from "@/components/ui/social-icons";
import { BackToTop, CallbackButton } from "./footer-actions";

/** "+91 91283 33777" → "tel:+919128333777" */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export async function Footer() {
  const { site } = (await getCatalog()).content;
  const links = socials.map((s) => ({ ...s, href: site.socials[s.key] })).filter((s) => s.href);
  return (
    <footer className="bg-ink text-white">
      <div className="container-x">
        {/* 1 · Expert help */}
        <div className="grid grid-cols-1 gap-8 border-b border-white/10 py-14 md:py-16 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="type-eyebrow flex items-center gap-3 text-white/60">
              <span aria-hidden className="h-px w-6 bg-red" />
              Need a hand choosing?
            </p>
            <p className="type-h2 mt-5 max-w-2xl text-balance">
              Talk to a March Gear car expert — <span className="type-editorial font-normal text-white/85">free, and no pressure.</span>
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:col-span-5 lg:justify-end">
            <CallbackButton />
            <a
              href={telHref(site.phone)}
              className="inline-flex h-13 items-center justify-center gap-2 rounded-[3px] border border-white/30 px-6 text-[15px] font-medium transition-colors duration-[250ms] hover:border-white hover:bg-white hover:text-ink num"
            >
              <Phone className="size-4" aria-hidden />
              {site.phone}
            </a>
          </div>
        </div>

        {/* 2 · Brand + navigation */}
        <div className="grid grid-cols-1 gap-12 py-14 md:py-16 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <Logo tone="light" />
            <p className="mt-6 max-w-sm text-[14.5px] leading-relaxed text-white/60">
              An independent automotive discovery platform helping India research, compare and buy cars with confidence.
            </p>
            <ul className="mt-7 space-y-3 text-[14px] text-white/75">
              <li className="flex items-center gap-3">
                <Mail className="size-4 shrink-0 text-red" aria-hidden />
                <a href={`mailto:${site.email}`} className="transition-colors hover:text-white">
                  {site.email}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Clock className="size-4 shrink-0 text-red" aria-hidden />
                <span>Open {site.hours}</span>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-red" aria-hidden />
                <span>{site.address}</span>
              </li>
            </ul>
            {links.length > 0 && (
              <div className="mt-8 flex gap-2">
                {links.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`March Gear on ${label}`}
                    className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition-[border-color,background-color,color] duration-[250ms] hover:border-white hover:bg-white hover:text-ink"
                  >
                    <Icon className="size-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:col-span-8 lg:pl-8">
            {footerColumns.map((col) => (
              <div key={col.title}>
                <p className="type-eyebrow text-white/45">{col.title}</p>
                <ul className="mt-5 space-y-3">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="group inline-flex items-center gap-1 text-[14px] text-white/75 transition-colors duration-[250ms] hover:text-white">
                        {link.label}
                        <ArrowUpRight aria-hidden className="size-3 text-red opacity-0 transition-opacity duration-[250ms] group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* 3 · Legal */}
        <div className="border-t border-white/10 py-8">
          <p className="max-w-4xl text-[12px] leading-relaxed text-white/40">
            All vehicle prices, specifications, listings, reviews and dealer details on this site are demonstration data and do not constitute an offer.
            Photography is representative, sourced from Unsplash, and may not depict the exact model or variant described.
          </p>
          <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 text-[12.5px] sm:flex-row sm:items-center sm:gap-6">
              <p className="text-white/50">© 2026 MarchGear. All rights reserved.</p>
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {footerLegal.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-white/60 transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <BackToTop />
          </div>
        </div>
      </div>
    </footer>
  );
}
