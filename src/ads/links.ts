/* Ad links. Client-safe. */

/** Where every ad click goes: the click route counts it, then redirects to the campaign's target. */
export const adClickHref = (campaignId: number) => `/ads/click/${campaignId}`;
