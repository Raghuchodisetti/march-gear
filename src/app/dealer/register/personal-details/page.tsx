import type { Metadata } from "next";
import { loadWizard } from "@/server/partner/application";
import { Wizard } from "@/components/portal/register/wizard";

export const metadata: Metadata = { title: "Personal details · Partner application" };

export default async function Page() {
  const { props } = await loadWizard("personal-details");
  return <Wizard {...props} />;
}
