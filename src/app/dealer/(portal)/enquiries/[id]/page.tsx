import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePartner } from "@/server/partner/context";
import { getLeadDetail, leadAccess, modelOptions, salesMembers, showroomOptions, vehicleOptions } from "@/server/partner/crm";
import { PortalHeader } from "@/components/portal/ui";
import { LeadWorkspace } from "@/components/portal/crm/lead-workspace";

export const metadata: Metadata = { title: "Enquiry" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePartner();
  const access = leadAccess(ctx);
  if (!access) redirect("/dealer/dashboard?denied=1");
  const id = Number.parseInt((await params).id, 10);
  if (!Number.isFinite(id) || id <= 0) notFound();
  const lead = await getLeadDetail(ctx, id);
  if (!lead) notFound();

  const canTd = ctx.can("test_drives.manage");
  const canAssign = ctx.can("leads.assign") && access === "all";
  const [members, vehicles, models, showrooms] = await Promise.all([
    salesMembers(ctx.partner.id),
    canTd ? vehicleOptions(ctx.partner.id) : Promise.resolve([]),
    canTd ? modelOptions(ctx.partner.id) : Promise.resolve([]),
    canTd ? showroomOptions(ctx.partner.id) : Promise.resolve([]),
  ]);

  return (
    <>
      <PortalHeader title={`Enquiry ${lead.reference}`} description={lead.carLabel ? `Interested in the ${lead.carLabel}` : "Customer enquiry"} back={{ href: "/dealer/enquiries", label: "All enquiries" }} />
      <LeadWorkspace
        layout="page"
        lead={lead}
        members={members}
        now={new Date().getTime()}
        can={{ manage: ctx.can("leads.manage"), assign: canAssign, testDrives: canTd }}
        tdOptions={canTd ? { vehicles, models, showrooms, members, canAssign, selfId: ctx.member.id } : null}
      />
    </>
  );
}
