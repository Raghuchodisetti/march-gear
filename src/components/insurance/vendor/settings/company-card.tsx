import Link from "next/link";
import { ArrowRight, BellRing, Building2 } from "lucide-react";

/* Settings → Company: read-only company facts and how notifications reach you (no email/SMS provider yet). */

export function InsCompanyCard({ facts, links }: { facts: { label: string; value: string }[]; links: { href: string; label: string }[] }) {
  return (
    <div className="space-y-6">
      <section className="border border-line bg-white">
        <header className="flex items-center gap-2 border-b border-line px-5 py-4 md:px-7">
          <Building2 aria-hidden className="size-4 text-muted" />
          <h2 className="text-[14px] font-semibold">Company</h2>
        </header>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2 md:px-7 md:py-6 lg:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-[12px] text-muted">{f.label}</dt>
              <dd className="mt-0.5 break-words text-[13.5px] font-medium">{f.value || "—"}</dd>
            </div>
          ))}
        </dl>
        {links.length > 0 && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line px-5 py-4 md:px-7">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink underline-offset-4 hover:text-red hover:underline">
                {l.label} <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="border border-line bg-white">
        <header className="flex items-center gap-2 border-b border-line px-5 py-4 md:px-7">
          <BellRing aria-hidden className="size-4 text-muted" />
          <h2 className="text-[14px] font-semibold">Notifications</h2>
        </header>
        <div className="px-5 py-5 md:px-7 md:py-6">
          <p className="max-w-2xl text-[13.5px] leading-relaxed text-ink/80">
            Application updates, quote requests, approvals and billing notices arrive in the portal — the bell in the top bar and the Notifications page — for everyone at your company, or for the person they concern.
          </p>
          <p className="mt-4 border border-dashed border-ink/15 px-4 py-3 text-[13px] leading-relaxed text-muted">
            MarchGear doesn&apos;t send vendor alerts by email or SMS yet, so there&apos;s no notification email to set. We&apos;ll add delivery options here when they&apos;re available.
          </p>
        </div>
      </section>
    </div>
  );
}
