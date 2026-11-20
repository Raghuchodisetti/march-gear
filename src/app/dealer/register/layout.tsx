import type { ReactNode } from "react";
import { getPartnerContext } from "@/server/partner/context";
import { wizardCatalogData } from "@/server/partner/application";
import { CatalogProvider } from "@/components/providers/catalog-provider";
import { RegisterFrame } from "@/components/portal/register/frame";

/** Registration has its own quiet chrome — no portal sidebar. Each page checks access itself. */
export default async function RegisterLayout({ children }: { children: ReactNode }) {
  const [ctx, catalog] = await Promise.all([getPartnerContext(), wizardCatalogData()]);
  const site = catalog.content.site;
  return (
    <CatalogProvider data={catalog}>
      <RegisterFrame signedIn={Boolean(ctx)} support={{ phone: site.phone, email: site.supportEmail }}>
        {children}
      </RegisterFrame>
    </CatalogProvider>
  );
}
