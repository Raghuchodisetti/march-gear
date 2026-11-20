import type { Metadata } from "next";
import { and, count, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { adCampaigns } from "@/db/schema";
import { AD_FORMAT_LABEL } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { listPlacements, placementDefinition, toPlacementView } from "@/server/ads/placements";
import { AdminHeader } from "@/components/admin/ui";
import { StatusPill } from "@/components/admin/partner-ui";
import { istDate, rupees } from "@/components/portal/billing/shared";
import { PlacementArt } from "@/components/ads/placement-art";
import { AUDIENCE_LABEL } from "@/components/ads/shared";
import { PlacementEditor } from "@/components/admin/advertising/placement-editor";

export const metadata: Metadata = { title: "Placements & pricing" };

export default async function PlacementsPage() {
  await requireStaff();
  const placements = await listPlacements();
  const today = istDate();
  const active = await getDb()
    .select({ placementId: adCampaigns.placementId, n: count() })
    .from(adCampaigns)
    .where(and(inArray(adCampaigns.status, ["approved", "paused", "pending_approval", "changes_requested"]), gte(adCampaigns.endsOn, today)))
    .groupBy(adCampaigns.placementId);
  const upcoming = new Map(active.map((r) => [r.placementId, r.n]));

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/advertising", label: "Ad campaigns" }}
        title="Placements & pricing"
        description="Where ads appear on MarchGear, what they cost and how many advertisers rotate in each. The slots themselves are placed in the site's code; new bookings use the price set here."
      />
      <div className="space-y-4">
        {placements.map((p) => {
          const def = placementDefinition(p.key);
          const changed = def
            ? def.name !== p.name || def.pricePerDay !== p.pricePerDay || def.slots !== p.slots || def.minDays !== p.minDays || def.maxDays !== p.maxDays || def.audience !== p.audience || def.desktopSize !== p.desktopSize || def.mobileSize !== p.mobileSize || def.description !== p.description || def.location !== p.location || !p.isActive
            : false;
          return (
            <section key={p.id} id={`placement-${p.id}`} className="scroll-mt-24 border border-line bg-white">
              <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_auto]">
                <div className="overflow-hidden rounded-[3px] border border-line bg-[#F6F6F6] p-2.5">
                  <PlacementArt placementKey={p.key} format={p.format} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[16px] font-semibold">{p.name}</h2>
                    <StatusPill tone={p.isActive ? "green" : "neutral"}>{p.isActive ? "On" : "Off"}</StatusPill>
                    {changed && <span className="text-[11.5px] text-muted">Edited from launch settings</span>}
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{p.description}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5 text-[12.5px] sm:grid-cols-3 xl:grid-cols-6">
                    {[
                      ["Price", `${rupees(p.pricePerDay)}/day`],
                      ["Format", AD_FORMAT_LABEL[p.format]],
                      ["Length", `${p.minDays}–${p.maxDays} days`],
                      ["Slots", String(p.slots)],
                      ["Sizes", p.format === "banner" ? `${p.desktopSize ?? "—"} · ${p.mobileSize ?? "—"}` : "Product card"],
                      ["Booked by", AUDIENCE_LABEL[p.audience]],
                    ].map(([k, val]) => (
                      <div key={k}>
                        <dt className="text-muted">{k}</dt>
                        <dd className="font-medium num">{val}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-[12px] text-muted">
                    {p.location} · key <code className="rounded-[2px] bg-mist px-1 py-0.5 font-mono text-[11px]">{p.key}</code> · {upcoming.get(p.id) ?? 0} current or upcoming booking{upcoming.get(p.id) === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="md:col-span-2 lg:col-span-1">
                  <PlacementEditor placement={toPlacementView(p)} hasDefaults={Boolean(def) && changed} />
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
