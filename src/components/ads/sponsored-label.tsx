import { SponsoredTag } from "./banner";

/**
 * The "Sponsored" label for promoted items (e.g. a sponsored product card in quote results or on the
 * compare page). `tone="glass"` sits on an image; the default "plain" sits on white. Server-safe.
 *
 *   <AdImpression campaignId={id}>
 *     <a href={adClickHref(id)} rel="sponsored">… <SponsoredLabel advertiser="Insurer name" /> …</a>
 *   </AdImpression>
 */
export function SponsoredLabel({ advertiser, className, tone = "plain" }: { advertiser?: string | null; className?: string; tone?: "glass" | "plain" }) {
  return <SponsoredTag advertiser={advertiser} className={className} tone={tone} />;
}
