import Link from "next/link";
import { ArrowUpRight, Building2, ShieldCheck } from "lucide-react";
import { INDICATIVE_NOTE, NOT_AN_INSURER_NOTE } from "@/insurance/labels";

/** The insurance footer band: what MarchGear is (and isn't), the admin's compliance note, and the way in for insurers. */
export function ComplianceBand({ complianceNote }: { complianceNote: string }) {
  return (
    <section aria-label="About insurance on MarchGear" className="border-t border-line bg-white">
      <div className="container-x grid grid-cols-1 gap-10 py-12 md:py-14 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-8">
          <p className="type-eyebrow flex items-center gap-3 text-muted">
            <ShieldCheck aria-hidden className="size-4 text-red" />
            Important information
          </p>
          <p className="mt-5 max-w-3xl text-[15px] font-medium leading-relaxed text-ink text-pretty">{NOT_AN_INSURER_NOTE}</p>
          <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-muted text-pretty">
            {INDICATIVE_NOTE} Read the policy wording, exclusions and terms carefully before you buy.
          </p>
          {complianceNote && <p className="mt-3 max-w-3xl whitespace-pre-line text-[13px] leading-relaxed text-muted text-pretty">{complianceNote}</p>}
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
            <li>
              <Link href="/insurance/claims" className="text-ink underline-offset-4 hover:text-red hover:underline">
                Claim help
              </Link>
            </li>
            <li>
              <Link href="/insurance/guides" className="text-ink underline-offset-4 hover:text-red hover:underline">
                Insurance guides
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-ink underline-offset-4 hover:text-red hover:underline">
                Privacy policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-ink underline-offset-4 hover:text-red hover:underline">
                Terms
              </Link>
            </li>
          </ul>
        </div>
        <div className="lg:col-span-4">
          <Link href="/insurance-vendor" className="group block border border-line bg-mist p-6 transition-colors duration-[250ms] hover:border-ink">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-white text-ink">
              <Building2 aria-hidden className="size-[18px]" />
            </span>
            <p className="mt-5 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Insurers &amp; intermediaries</p>
            <p className="type-h4 mt-2 text-lg">List your products on MarchGear</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">Registered insurers, brokers and corporate agents can apply, publish approved products and receive quote requests.</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
              List your products
              <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
