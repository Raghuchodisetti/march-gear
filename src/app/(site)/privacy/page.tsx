import type { Metadata } from "next";
import { getCatalog } from "@/server/catalog";
import { pageMetadata } from "@/components/seo/metadata";
import { LegalDocument } from "@/components/editorial/legal-document";
import { legalVars } from "@/components/editorial/legal-text";
import { PrivacyChoices } from "@/components/editorial/privacy-choices";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How MarchGear collects, uses, shares and protects your personal data under India's DPDP Act, 2023 — and how to access, correct or delete it.",
  path: "/privacy",
});

export default async function PrivacyPage() {
  const { legal, site } = (await getCatalog()).content;
  const { vars, plain } = legalVars(site);
  return (
    <LegalDocument
      eyebrow="Privacy Policy"
      title="Your data, handled with care"
      intro="What we collect, why we collect it, who sees it and the choices you have — in plain language."
      sections={legal.privacy}
      summary={legal.privacySummary}
      updated={legal.updated}
      current="/privacy"
      site={site}
      vars={vars}
      plain={plain}
      attachments={{ "use-your-rights": <PrivacyChoices supportEmail={site.supportEmail} /> }}
    />
  );
}
