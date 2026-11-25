import { getCatalog } from "@/server/catalog";
import { SiteShell } from "@/components/layout/site-shell";
import { SiteSchema } from "@/components/seo/site-schema";
import { ConsentManager } from "@/components/consent/consent-banner";
import { measurementId } from "@/components/consent/consent";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const { site } = (await getCatalog()).content;
  // GA4 measurement ID from the `site` content block (admin → Content → Site); analytics stays off while it's empty.
  const gaId = measurementId(site.gaMeasurementId);
  return (
    <>
      <SiteSchema />
      <SiteShell>{children}</SiteShell>
      <ConsentManager gaId={gaId} />
    </>
  );
}
