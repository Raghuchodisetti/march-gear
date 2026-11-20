import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { insStepByKey, isInsStepKey } from "@/insurance/schemas";
import { loadWizard } from "../_lib/wizard";
import { InsWizard } from "@/components/insurance/vendor/register/wizard";

export async function generateMetadata({ params }: PageProps<"/insurance-vendor/register/[step]">): Promise<Metadata> {
  const { step } = await params;
  const s = insStepByKey(step);
  return { title: s ? `${s.title} · Vendor application` : "Vendor application" };
}

export default async function InsuranceRegisterStep({ params }: PageProps<"/insurance-vendor/register/[step]">) {
  const { step } = await params;
  if (!isInsStepKey(step)) notFound();
  const { props } = await loadWizard(step);
  // Keyed by step so every step starts from the database state.
  return <InsWizard key={step} {...props} />;
}
