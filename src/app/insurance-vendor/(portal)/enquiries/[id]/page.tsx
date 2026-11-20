import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireInsurer, vendorName } from "@/server/insurance/context";
import { enquiryAccess, getEnquiryDetail, teamMembers } from "@/server/insurance/crm";
import { PortalHeader } from "@/components/portal/ui";
import { istDate } from "@/components/portal/billing/shared";
import { EnquiryWorkspace } from "@/components/insurance/vendor/crm/enquiry-workspace";
import { vehicleLine } from "@/components/insurance/vendor/crm/shared";

export const metadata: Metadata = { title: "Enquiry" };

export default async function Page({ params }: PageProps<"/insurance-vendor/enquiries/[id]">) {
  const ctx = await requireInsurer();
  const access = enquiryAccess(ctx);
  if (!access) redirect("/insurance-vendor/dashboard?denied=1");
  const id = Number.parseInt((await params).id, 10);
  if (!Number.isFinite(id) || id <= 0) notFound();
  const lead = await getEnquiryDetail(ctx, id);
  if (!lead) notFound();

  const canAssign = ctx.can("enquiries.assign") && access === "all";
  const members = canAssign ? await teamMembers(ctx.vendor.id) : [];
  const car = vehicleLine(lead);

  return (
    <>
      <PortalHeader
        title={`Enquiry ${lead.reference}`}
        description={[car || "Car insurance enquiry", lead.regNumber].filter(Boolean).join(" · ")}
        back={{ href: "/insurance-vendor/enquiries", label: "All enquiries" }}
      />
      <EnquiryWorkspace
        lead={lead}
        members={members}
        now={new Date().getTime()}
        today={istDate()}
        vendorName={vendorName(ctx.vendor)}
        can={{ manage: ctx.can("enquiries.manage"), assign: canAssign, quotes: ctx.can("quotes.manage"), renewals: ctx.can("renewals.manage") }}
      />
    </>
  );
}
