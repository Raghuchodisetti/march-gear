import type { Metadata } from "next";
import { requireStaff } from "@/server/auth";
import { publicProductOptions } from "@/server/ads/admin";
import { bookedRanges } from "@/server/ads/booking";
import { listPlacements, toPlacementView } from "@/server/ads/placements";
import { AdminHeader } from "@/components/admin/ui";
import { addDays, istDate } from "@/components/portal/billing/shared";
import { BOOKING_HORIZON_DAYS } from "@/components/ads/shared";
import { HouseCampaignForm } from "@/components/admin/advertising/house-form";

export const metadata: Metadata = { title: "New house campaign" };

export default async function NewHouseCampaignPage() {
  await requireStaff();
  const today = istDate();
  const placements = await listPlacements();
  const [ranges, products] = await Promise.all([bookedRanges(placements.map((p) => p.id), today, addDays(today, BOOKING_HORIZON_DAYS + 365)), publicProductOptions()]);
  return (
    <>
      <AdminHeader
        back={{ href: "/admin/advertising", label: "Ad campaigns" }}
        title="New house campaign"
        description="Run MarchGear's own banner or sponsored listing in any placement — no fee, no invoice. It's approved as soon as you create it and rotates with paid bookings."
      />
      <HouseCampaignForm
        today={today}
        placements={placements.map(toPlacementView)}
        booked={Object.fromEntries(placements.map((p) => [p.id, ranges.get(p.id) ?? []]))}
        products={products.map((p) => ({ id: p.id, label: `${p.name} — ${p.company} · ${p.reference}` }))}
      />
    </>
  );
}
