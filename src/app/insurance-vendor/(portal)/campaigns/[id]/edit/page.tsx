import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { INS_CAMPAIGN_STATUS_LABEL, INS_CAMPAIGN_STATUS_TONE, campaignDisplayStatus } from "@/insurance/labels";
import { requireInsurer, vendorName } from "@/server/insurance/context";
import { campaignSlotsUsed, getInsPlans } from "@/server/insurance/subscription";
import { Badge, PortalHeader } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { toIstParts } from "@/components/offers/offer-utils";
import { insPlanName } from "@/components/insurance/vendor/billing/shared";
import { CampaignEditor } from "@/components/insurance/vendor/campaigns/campaign-editor";
import { getCampaignProducts, getVendorCampaign } from "../../_lib/data";

export const metadata: Metadata = { title: "Edit campaign" };

export default async function Page({ params }: PageProps<"/insurance-vendor/campaigns/[id]/edit">) {
  const ctx = await requireInsurer({ perm: "campaigns.manage" });
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const row = await getVendorCampaign(ctx.vendor.id, Number(id));
  if (!row) notFound();
  const display = campaignDisplayStatus(row);
  const back = { href: `/insurance-vendor/campaigns/${row.id}`, label: row.title };

  if (row.status === "pending_approval" || row.status === "cancelled") {
    return (
      <>
        <PortalHeader back={back} title="Edit campaign" />
        <div className="flex flex-col items-center border border-line bg-white px-6 py-16 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
            <Lock className="size-5 text-muted" aria-hidden />
          </span>
          <div className="mt-4">
            <Badge tone={INS_CAMPAIGN_STATUS_TONE[display]}>{INS_CAMPAIGN_STATUS_LABEL[display]}</Badge>
          </div>
          <p className="mt-3 text-[15px] font-semibold">{row.status === "pending_approval" ? "This campaign is with MarchGear for review" : "Cancelled campaigns can't be edited"}</p>
          <p className="mt-1 max-w-sm text-[13.5px] text-muted">
            {row.status === "pending_approval" ? "Withdraw it from review on the campaign page to make changes." : "Duplicate it from the campaign page to start a new draft with the same details."}
          </p>
          <div className="mt-5">
            <Button href={back.href} variant="dark" size="sm">
              Back to the campaign
            </Button>
          </div>
        </div>
      </>
    );
  }

  const [products, used, plans] = await Promise.all([getCampaignProducts(ctx.vendor.id, row.productIds), campaignSlotsUsed(ctx.vendor.id, row.id), getInsPlans()]);
  const s = toIstParts(row.startsAt);
  const e = toIstParts(row.endsAt);
  return (
    <>
      <PortalHeader
        back={back}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Edit campaign{" "}
            <span className="tracking-normal">
              <Badge tone={INS_CAMPAIGN_STATUS_TONE[display]}>{INS_CAMPAIGN_STATUS_LABEL[display]}</Badge>
            </span>
          </span>
        }
        description={<span className="font-mono text-[13px]">{row.reference}</span>}
      />
      <CampaignEditor
        id={row.id}
        status={row.status}
        adminRemarks={row.adminRemarks}
        initial={{
          title: row.title,
          summary: row.summary,
          description: row.description ?? "",
          type: row.type,
          productIds: row.productIds,
          banner: row.banner ?? "",
          ctaLabel: row.ctaLabel ?? "",
          startDate: s.date,
          startTime: s.time,
          endDate: e.date,
          endTime: e.time,
        }}
        products={products}
        vendorName={vendorName(ctx.vendor)}
        slots={{ used, limit: plans.find((p) => p.id === ctx.vendor.plan)?.limits.activeCampaigns ?? null, planName: insPlanName(plans, ctx.vendor.plan) }}
      />
    </>
  );
}
