import type { Metadata } from "next";
import { loadWizard } from "@/server/partner/application";
import { Wizard } from "@/components/portal/register/wizard";

export const metadata: Metadata = { title: "Bank details · Partner application" };

export default async function Page() {
  const { props } = await loadWizard("bank-details");
  return <Wizard {...props} />;
}
