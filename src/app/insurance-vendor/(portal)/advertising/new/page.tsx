import type { Metadata } from "next";
import { requireInsurer, vendorName } from "@/server/insurance/context";
import { listPlacements, toPlacementView } from "@/server/ads/placements";
import { bookedRanges, vendorProvider, vendorPublicProducts } from "@/server/ads/booking";
import { addDays, istDate } from "@/components/portal/billing/shared";
import { BOOKING_HORIZON_DAYS, BOOKING_LEAD_DAYS } from "@/components/ads/shared";
import { PortalHeader } from "@/components/portal/ui";
import { BookingWizard } from "@/components/insurance/vendor/advertising/booking-wizard";

export const metadata: Metadata = { title: "Book a placement" };

export default async function NewAdBookingPage({ searchParams }: PageProps<"/insurance-vendor/advertising/new">) {
  const ctx = await requireInsurer({ perm: "ads.manage", next: "/insurance-vendor/advertising/new" });
  const sp = await searchParams;
  const today = istDate();
  const placements = (await listPlacements()).filter((p) => p.isActive && (p.audience === "all" || p.audience === "insurer"));
  const horizonEnd = addDays(today, BOOKING_HORIZON_DAYS + Math.max(0, ...placements.map((p) => p.maxDays)));
  const [ranges, products, provider] = await Promise.all([bookedRanges(placements.map((p) => p.id), today, horizonEnd), vendorPublicProducts(ctx.vendor.id), vendorProvider(ctx.vendor.id)]);
  const preselect = Number(sp.placement);

  return (
    <>
      <PortalHeader
        title="Book a placement"
        description="Choose where your ad appears, pick your dates and add your creatives. MarchGear reviews every booking; an invoice is raised once it's approved."
        back={{ href: "/insurance-vendor/advertising", label: "Advertising" }}
      />
      <BookingWizard
        firstDay={addDays(today, BOOKING_LEAD_DAYS)}
        lastStart={addDays(today, BOOKING_HORIZON_DAYS)}
        placements={placements.map(toPlacementView)}
        booked={Object.fromEntries(placements.map((p) => [p.id, ranges.get(p.id) ?? []]))}
        products={products}
        provider={provider}
        advertiser={vendorName(ctx.vendor)}
        initialPlacementId={placements.some((p) => p.id === preselect) ? preselect : null}
      />
    </>
  );
}
