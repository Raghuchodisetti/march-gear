import type { Metadata } from "next";
import { requireInsurer, vendorName } from "@/server/insurance/context";
import { campaignSlotsUsed, getInsPlans } from "@/server/insurance/subscription";
import { PortalHeader } from "@/components/portal/ui";
import { addDays, istDay } from "@/components/offers/offer-utils";
import { insPlanName } from "@/components/insurance/vendor/billing/shared";
import { CampaignEditor } from "@/components/insurance/vendor/campaigns/campaign-editor";
import { EMPTY_CAMPAIGN } from "@/components/insurance/vendor/campaigns/shared";
import { getCampaignProducts } from "../_lib/data";

export const metadata: Metadata = { title: "New campaign" };

export default async function Page() {
  const ctx = await requireInsurer({ perm: "campaigns.manage" });
  const [products, used, plans] = await Promise.all([getCampaignProducts(ctx.vendor.id), campaignSlotsUsed(ctx.vendor.id), getInsPlans()]);
  const start = addDays(istDay(new Date()), 1);
  return (
    <>
      <PortalHeader
        back={{ href: "/insurance-vendor/campaigns", label: "Campaigns" }}
        title="New campaign"
        description="Promote one or more of your published products. Save a draft any time; MarchGear reviews the campaign when you submit it."
      />
      <CampaignEditor
        initial={{ ...EMPTY_CAMPAIGN, startDate: start, endDate: addDays(start, 30) }}
        products={products}
        vendorName={vendorName(ctx.vendor)}
        slots={{ used, limit: plans.find((p) => p.id === ctx.vendor.plan)?.limits.activeCampaigns ?? null, planName: insPlanName(plans, ctx.vendor.plan) }}
      />
    </>
  );
}
