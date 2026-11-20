import type { Metadata } from "next";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { getDb } from "@/db";
import { partnerShowrooms, partnerVehicles } from "@/db/schema";
import { planById } from "@/partner/plans";
import { INDIAN_STATES } from "@/partner/schemas";
import { getCatalog } from "@/server/catalog";
import { requirePartner } from "@/server/partner/context";
import { PortalHeader } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { ShowroomManager } from "@/components/portal/showrooms/showroom-manager";

export const metadata: Metadata = { title: "Showrooms" };

export default async function ShowroomsPage() {
  const ctx = await requirePartner({ perm: "profile.manage" });
  const db = getDb();
  const [rooms, stock, catalog] = await Promise.all([
    db
      .select()
      .from(partnerShowrooms)
      .where(eq(partnerShowrooms.partnerId, ctx.partner.id))
      .orderBy(desc(partnerShowrooms.isActive), desc(partnerShowrooms.isPrimary), asc(partnerShowrooms.id)),
    db
      .select({ showroomId: partnerVehicles.showroomId, n: count() })
      .from(partnerVehicles)
      .where(and(eq(partnerVehicles.partnerId, ctx.partner.id)))
      .groupBy(partnerVehicles.showroomId),
    getCatalog(),
  ]);
  const plan = catalog.content.partnerPlans.plans.find((p) => p.id === ctx.partner.plan);
  const fallback = planById(ctx.partner.plan);
  const byRoom = new Map(stock.map((s) => [s.showroomId, s.n]));

  return (
    <>
      <PortalHeader
        title="Showrooms"
        description="Your branches, map pins, opening hours and photos. Changes appear on your public page straight away."
        actions={
          ctx.partner.publicDealerId ? (
            <Button href={`/dealers/${ctx.partner.publicDealerId}`} target="_blank" variant="outline" size="sm" icon={<ExternalLink className="size-4" aria-hidden />}>
              View public page
            </Button>
          ) : undefined
        }
      />
      <ShowroomManager
        states={INDIAN_STATES}
        limit={plan ? plan.showrooms : fallback.limits.showrooms}
        planName={plan?.name ?? fallback.name}
        rooms={rooms.map((r) => ({
          id: r.id,
          name: r.name,
          address: r.address,
          state: r.state,
          district: r.district,
          city: r.city,
          pin: r.pin,
          lat: r.lat,
          lng: r.lng,
          phone: r.phone,
          hours: r.hours,
          photos: r.photos,
          serviceCentre: r.serviceCentre,
          isPrimary: r.isPrimary,
          isActive: r.isActive,
          vehicles: byRoom.get(r.id) ?? 0,
        }))}
      />
    </>
  );
}
