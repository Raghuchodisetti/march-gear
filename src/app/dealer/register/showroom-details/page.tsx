import type { Metadata } from "next";
import { loadWizard } from "@/server/partner/application";
import { Wizard } from "@/components/portal/register/wizard";

export const metadata: Metadata = { title: "Showroom details · Partner application" };

export default async function Page() {
  const { props } = await loadWizard("showroom-details");
  return <Wizard {...props} />;
}
