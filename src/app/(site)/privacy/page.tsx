import type { Metadata } from "next";
import { getCatalog } from "@/server/catalog";
import { LegalDocument } from "@/components/editorial/legal-document";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How March Gear collects, uses and protects your information. Sample text for a demonstration product.",
};

export default async function PrivacyPage() {
  const { legal } = (await getCatalog()).content;
  return (
    <LegalDocument
      eyebrow="Privacy policy"
      title="Your data, handled with care"
      intro="What we collect, why we collect it and the choices you have — written to be read, not skimmed past."
      sections={legal.privacy}
      updated={legal.updated}
      sibling={{ label: "Read the terms of use", href: "/terms" }}
    />
  );
}
