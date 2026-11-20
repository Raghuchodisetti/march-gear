import type { Metadata } from "next";
import { CalendarDays, Plus } from "lucide-react";
import { requirePartner } from "@/server/partner/context";
import { listOffers } from "@/server/partner/offers";
import { PortalHeader, StatCard, strParam } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { OfferList } from "@/components/portal/offers/offer-list";

export const metadata: Metadata = { title: "Offers" };

export default async function OffersPage(props: PageProps<"/dealer/offers">) {
  const ctx = await requirePartner({ perm: "offers.view" });
  const sp = await props.searchParams;
  const items = await listOffers(ctx);
  const canManage = ctx.can("offers.manage");
  const count = (...s: string[]) => items.filter((i) => s.includes(i.display)).length;
  const enquiries = items.reduce((sum, i) => sum + i.enquiries, 0);
  const conversions = items.reduce((sum, i) => sum + i.conversions, 0);

  return (
    <>
      <PortalHeader
        title="Offers"
        description="Create promotional offers, send them to MarchGear for approval and see how each one performs. Approved offers go live and expire on their own dates."
        actions={
          <>
            <Button href="/dealer/campaigns" variant="outline" size="sm" icon={<CalendarDays className="size-4" aria-hidden />}>
              Campaign calendar
            </Button>
            {canManage && (
              <Button href="/dealer/offers/create" size="sm" icon={<Plus className="size-4" aria-hidden />}>
                Create offer
              </Button>
            )}
          </>
        }
      />
      {items.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Live now" value={count("active")} note={`${count("scheduled")} scheduled`} />
          <StatCard label="Awaiting approval" value={count("submitted", "pending_approval")} note={`${count("changes_requested")} need changes`} tone={count("changes_requested") ? "red" : undefined} />
          <StatCard label="Offer enquiries" value={enquiries.toLocaleString("en-IN")} note={`${items.reduce((s, i) => s + i.views, 0).toLocaleString("en-IN")} views`} />
          <StatCard label="Conversions" value={conversions.toLocaleString("en-IN")} note={enquiries ? `${Math.round((conversions / enquiries) * 100)}% of enquiries` : "Bookings from offer enquiries"} />
        </div>
      )}
      <OfferList
        items={items}
        canManage={canManage}
        renderedAt={new Date().getTime()}
        initial={{ status: strParam(sp.status), q: strParam(sp.q), category: strParam(sp.category), view: strParam(sp.view) }}
      />
    </>
  );
}
