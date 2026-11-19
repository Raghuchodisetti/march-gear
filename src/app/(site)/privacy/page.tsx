import type { Metadata } from "next";
import { LEGAL_UPDATED, privacySections } from "@/data/editorial-legal";
import { LegalDocument } from "@/components/editorial/legal-document";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How March Gear collects, uses and protects your information. Sample text for a demonstration product.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Privacy policy"
      title="Your data, handled with care"
      intro="What we collect, why we collect it and the choices you have — written to be read, not skimmed past."
      sections={privacySections}
      updated={LEGAL_UPDATED}
      sibling={{ label: "Read the terms of use", href: "/terms" }}
    />
  );
}
