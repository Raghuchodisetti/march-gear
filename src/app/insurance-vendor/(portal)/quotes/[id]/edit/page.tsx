import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { insQuotes } from "@/db/schema";
import { requireInsurer, vendorName } from "@/server/insurance/context";
import { enquiryInScope, quoteScope } from "@/server/insurance/crm";
import { builderEnquiry, builderProducts, insuranceSettings, pricingConfig } from "@/server/insurance/quote-builder";
import { PortalHeader } from "@/components/portal/ui";
import { addDays, istDate } from "@/components/portal/billing/shared";
import { QuoteBuilder } from "@/components/insurance/vendor/quotes/quote-builder";
import type { QuoteForm } from "@/components/insurance/vendor/quotes/pricing";

export const metadata: Metadata = { title: "Edit quote" };

export default async function Page({ params }: PageProps<"/insurance-vendor/quotes/[id]/edit">) {
  const ctx = await requireInsurer({ perm: "quotes.manage" });
  const id = Number.parseInt((await params).id, 10);
  if (!Number.isFinite(id) || id <= 0) notFound();
  const [quote] = await getDb().select().from(insQuotes).where(and(quoteScope(ctx), eq(insQuotes.id, id)));
  if (!quote) notFound();
  if (quote.status !== "draft") redirect(`/insurance-vendor/quotes/${quote.id}`);
  const row = await enquiryInScope(ctx, quote.enquiryId);
  if (!row) notFound();

  const [enquiry, products, config, settings] = await Promise.all([builderEnquiry(row), builderProducts(ctx.vendor.id), pricingConfig(), insuranceSettings()]);
  const today = istDate();
  const b = quote.breakdown;
  const product = products.find((p) => p.id === quote.productId);
  const form: QuoteForm = {
    productId: product ? product.id : null,
    idv: b.odYears > 0 ? b.idv : null,
    ncbPct: b.ncbPct,
    includePa: b.pa > 0,
    addOnIds: b.addOns.filter((a) => !a.included && a.coverId !== null).map((a) => a.coverId as number),
    voluntaryDeductible: product ? Math.max(0, b.deductible - (product.deductibles.compulsory || 0)) : 0,
    adjustment: b.adjustment,
    coverage: quote.coverage,
    validUntil: quote.validUntil < today ? addDays(today, settings.quoteValidityDays) : quote.validUntil,
    authorization: quote.authorization,
    insurerQuoteRef: quote.insurerQuoteRef ?? "",
    declaration: false,
    notes: quote.notes ?? "",
    terms: quote.terms ?? "",
  };

  return (
    <>
      <PortalHeader title={`Edit draft ${quote.reference}`} description={`For ${row.name} · enquiry ${row.reference}`} back={{ href: `/insurance-vendor/quotes/${quote.id}`, label: "Back to the quote" }} />
      <QuoteBuilder
        enquiry={enquiry}
        products={products}
        config={config}
        validityDays={settings.quoteValidityDays}
        today={today}
        vendorName={vendorName(ctx.vendor)}
        quote={{ id: quote.id, reference: quote.reference, form }}
      />
    </>
  );
}
