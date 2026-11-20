import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInsurer, vendorName } from "@/server/insurance/context";
import { enquiryInScope } from "@/server/insurance/crm";
import { builderEnquiry, builderProducts, insuranceSettings, pricingConfig } from "@/server/insurance/quote-builder";
import { PortalHeader } from "@/components/portal/ui";
import { istDate } from "@/components/portal/billing/shared";
import { Button } from "@/components/ui/button";
import { QuoteBuilder } from "@/components/insurance/vendor/quotes/quote-builder";

export const metadata: Metadata = { title: "New quote" };

export default async function Page({ searchParams }: PageProps<"/insurance-vendor/quotes/new">) {
  const ctx = await requireInsurer({ perm: "quotes.manage" });
  const sp = await searchParams;
  const enquiryId = Number.parseInt(typeof sp.enquiry === "string" ? sp.enquiry : "", 10);

  if (!Number.isFinite(enquiryId) || enquiryId <= 0)
    return (
      <>
        <PortalHeader title="New quote" back={{ href: "/insurance-vendor/quotes", label: "All quotes" }} />
        <div className="border border-line bg-white px-6 py-14 text-center">
          <p className="font-display text-[18px] font-semibold">Start from an enquiry</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">Every quote answers a customer&apos;s enquiry. Open the enquiry and choose “Create quote”.</p>
          <Link href="/insurance-vendor/enquiries" className="mt-5 inline-flex h-10 items-center rounded-[3px] bg-ink px-5 text-[13px] font-medium text-white hover:bg-ink-3">
            Go to enquiries
          </Link>
        </div>
      </>
    );

  const row = await enquiryInScope(ctx, enquiryId);
  if (!row) notFound();
  const [enquiry, products, config, settings] = await Promise.all([builderEnquiry(row), builderProducts(ctx.vendor.id), pricingConfig(), insuranceSettings()]);
  const closed = row.status === "policy_issued" || row.status === "closed";

  return (
    <>
      <PortalHeader title="New quote" description={`For ${row.name} · enquiry ${row.reference}`} back={{ href: `/insurance-vendor/enquiries/${row.id}`, label: "Back to the enquiry" }} />
      {closed ? (
        <div className="border border-line bg-white px-6 py-14 text-center">
          <p className="font-display text-[18px] font-semibold">This enquiry is closed</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">Reopen it (change its status) before preparing another quote.</p>
          <Button href={`/insurance-vendor/enquiries/${row.id}`} variant="outline" size="sm" className="mt-6">
            Open the enquiry
          </Button>
        </div>
      ) : (
        <QuoteBuilder enquiry={enquiry} products={products} config={config} validityDays={settings.quoteValidityDays} today={istDate()} vendorName={vendorName(ctx.vendor)} />
      )}
    </>
  );
}
