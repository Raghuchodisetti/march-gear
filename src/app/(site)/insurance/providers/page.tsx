import type { Metadata } from "next";
import { getPublicProviders } from "@/server/insurance/public";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ProvidersDirectory } from "@/components/insurance/public/market/providers-directory";

export const metadata: Metadata = {
  title: "Car insurance providers",
  description: "Insurers listed on MarchGear: their plans, cashless garage networks, claim process and verified claim figures.",
};

export default async function InsuranceProvidersPage() {
  const providers = await getPublicProviders();
  return (
    <>
      <section className="border-b border-line">
        <div className="container-x pb-10 pt-8 md:pb-14 md:pt-10">
          <Breadcrumbs items={[{ label: "Insurance", href: "/insurance" }, { label: "Providers" }]} />
          <div className="mt-10 max-w-3xl md:mt-14">
            <p className="type-eyebrow inline-flex items-center gap-3 text-ink">
              <span aria-hidden className="h-px w-6 bg-red" />
              Providers
            </p>
            <h1 className="type-h1 mt-5 text-balance">
              The insurers <span className="type-editorial font-normal">behind the plans.</span>
            </h1>
            <p className="type-lead mt-5 max-w-2xl text-muted">
              Every insurer here has been reviewed by MarchGear. See their plans, garage networks and how claims work — claim figures appear only once we&apos;ve verified them.
            </p>
          </div>
        </div>
      </section>
      <ProvidersDirectory providers={providers} />
    </>
  );
}
