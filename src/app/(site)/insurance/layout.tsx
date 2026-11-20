import { getCatalog } from "@/server/catalog";
import { ComplianceBand } from "@/components/insurance/public/compliance-band";
import { InsuranceSubnav } from "@/components/insurance/public/subnav";

/** Chrome for every /insurance page: the sticky section navigation and the compliance band above the site footer. */
export default async function InsuranceLayout({ children }: LayoutProps<"/insurance">) {
  const { insuranceSettings } = (await getCatalog()).content;
  return (
    <>
      <InsuranceSubnav />
      {children}
      <ComplianceBand complianceNote={insuranceSettings.complianceNote} />
    </>
  );
}
