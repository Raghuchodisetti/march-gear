import type { Metadata } from "next";
import { getCatalog } from "@/server/catalog";
import { LegalDocument } from "@/components/editorial/legal-document";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms that apply when you use March Gear. Sample text for a demonstration product.",
};

export default async function TermsPage() {
  const { legal } = (await getCatalog()).content;
  return (
    <LegalDocument
      eyebrow="Terms of use"
      title="The terms of the road"
      intro="The ground rules for using March Gear, publishing reviews and connecting with dealers through our platform."
      sections={legal.terms}
      updated={legal.updated}
      sibling={{ label: "Read the privacy policy", href: "/privacy" }}
    />
  );
}
