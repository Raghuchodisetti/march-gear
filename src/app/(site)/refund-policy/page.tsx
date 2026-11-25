import type { Metadata } from "next";
import { getCatalog } from "@/server/catalog";
import { PAYMENT_TERMS_DAYS, TRIAL_DAYS } from "@/components/portal/billing/shared";
import { pageMetadata } from "@/components/seo/metadata";
import { LegalDocument } from "@/components/editorial/legal-document";
import { legalVars } from "@/components/editorial/legal-text";

export const metadata: Metadata = pageMetadata({
  title: "Refund & Cancellation Policy",
  description: "Cancellations and refunds for MarchGear dealer and insurance vendor subscriptions, advertising campaigns and PDI inspections.",
  path: "/refund-policy",
});

export default async function RefundPolicyPage() {
  const { refundPolicy, insuranceSettings, site } = (await getCatalog()).content;
  // Trial lengths and payment terms come from the billing rules themselves, so the policy can't drift from them.
  const { vars, plain } = legalVars(site, {
    refundTimeline: refundPolicy.refundTimeline,
    pdiCancellation: refundPolicy.pdiCancellation,
    dealerTrialDays: String(TRIAL_DAYS),
    vendorTrialDays: String(insuranceSettings.vendorTrialDays),
    dealerPaymentTerms: String(PAYMENT_TERMS_DAYS),
    vendorPaymentTerms: String(insuranceSettings.paymentTermsDays),
  });
  return (
    <LegalDocument
      eyebrow="Refund & Cancellation Policy"
      title="Cancellations and refunds"
      intro="What you can cancel, when it takes effect and how refunds are paid — for dealer and insurance partners, advertising and PDI inspections."
      sections={refundPolicy.sections}
      summary={refundPolicy.summary}
      updated={refundPolicy.updated}
      current="/refund-policy"
      site={site}
      vars={vars}
      plain={plain}
    />
  );
}
