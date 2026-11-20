import { connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import type { PlacementKey } from "@/ads/placements";
import { adClickHref } from "@/ads/links";
import { chooseBanner, type BannerChoice } from "@/server/ads/live";
import { AdImpression } from "./ad-impression";
import { BannerView } from "./banner";
import { DESKTOP_ASPECT, MOBILE_ASPECT, aspectOf } from "./shared";

/**
 * A banner ad slot (server component). Renders nothing when no campaign is live, so pages can
 * place it freely; it never throws. Rotates between live campaigns on every request (so the page
 * it sits on renders per request).
 *
 * Without `className` it is a full-width band in the site container (`container-x`, vertical
 * padding) — drop it between page sections. With `className`, that replaces the band's classes:
 * pass your own spacing, e.g. `className="mt-10"` inside an existing container.
 */
export async function AdSlot({ placement, className }: { placement: PlacementKey; className?: string }) {
  // Rotation and start/end dates are per request — never bake a banner into a prerendered page.
  await connection();
  let choice: BannerChoice | null = null;
  try {
    choice = await chooseBanner(placement);
  } catch (err) {
    unstable_rethrow(err);
    console.error(`[ads] <AdSlot placement="${placement}"> failed`, err);
  }
  if (!choice) return null;
  const c = choice.creative;
  return (
    <aside aria-label="Advertisement" className={className ?? "container-x py-8 md:py-10"}>
      <AdImpression campaignId={choice.campaignId}>
        <BannerView
          href={adClickHref(choice.campaignId)}
          desktopAspect={aspectOf(choice.placement.desktopSize, DESKTOP_ASPECT)}
          mobileAspect={aspectOf(choice.placement.mobileSize, MOBILE_ASPECT)}
          ad={{ desktopImage: c.desktopImage, mobileImage: c.mobileImage, alt: c.alt, headline: c.headline, body: c.body, ctaLabel: c.ctaLabel, advertiser: choice.advertiser }}
        />
      </AdImpression>
    </aside>
  );
}
