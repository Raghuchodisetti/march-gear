import type { Metadata } from "next";
import { getCatalog } from "@/server/catalog";
import { pageMetadata } from "@/components/seo/metadata";
import { LegalDocument } from "@/components/editorial/legal-document";
import { legalVars } from "@/components/editorial/legal-text";

export const metadata: Metadata = pageMetadata({
  title: "Terms & Conditions",
  description: "The terms for using MarchGear: what the service is and isn't, indicative prices, accounts, reviews, partners, liability and governing law.",
  path: "/terms",
});

export default async function TermsPage() {
  const { legal, site } = (await getCatalog()).content;
  const { vars, plain } = legalVars(site);
  return (
    <LegalDocument
      eyebrow="Terms & Conditions"
      title="The terms of the road"
      intro="The ground rules for using MarchGear, posting reviews and connecting with dealers, insurers and intermediaries through our platform."
      sections={legal.terms}
      summary={legal.termsSummary}
      updated={legal.updated}
      current="/terms"
      site={site}
      vars={vars}
      plain={plain}
    />
  );
}
