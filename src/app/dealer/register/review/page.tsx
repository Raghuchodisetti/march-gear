import type { Metadata } from "next";
import { loadWizard } from "@/server/partner/application";
import { Wizard } from "@/components/portal/register/wizard";

export const metadata: Metadata = { title: "Review & submit · Partner application" };

export default async function Page() {
  const { props } = await loadWizard("review");
  return <Wizard {...props} />;
}
