import type { Metadata } from "next";
import { loadWizard } from "@/server/partner/application";
import { Wizard } from "@/components/portal/register/wizard";

export const metadata: Metadata = { title: "Brand authorisation · Partner application" };

export default async function Page() {
  const { props } = await loadWizard("brand-authorization");
  return <Wizard {...props} />;
}
