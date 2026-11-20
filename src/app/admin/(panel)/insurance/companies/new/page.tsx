import type { Metadata } from "next";
import { insurerVendorOptions } from "@/server/admin/insurance";
import { requireStaff } from "@/server/auth";
import { AdminHeader } from "@/components/admin/ui";
import { CompanyForm, emptyCompany } from "@/components/admin/insurance/companies/company-form";

export const metadata: Metadata = { title: "Add insurance company" };

export default async function NewInsuranceCompanyPage() {
  await requireStaff();
  const vendors = await insurerVendorOptions();
  return (
    <>
      <AdminHeader
        back={{ href: "/admin/insurance/companies", label: "Insurance companies" }}
        title="Add insurance company"
        description="An underwriting insurer. Never enter a real insurer's details, logo or figures without their confirmation — demo companies end in “(demo)”."
      />
      <CompanyForm companyId={null} initial={emptyCompany} vendors={vendors} products={{ total: 0, published: 0 }} claimInfo={null} verifiedByName={null} />
    </>
  );
}
