import type { Metadata } from "next";
import { AppProvider } from "@/components/providers/app-provider";
import { Toaster } from "@/components/layout/toaster";
import { CatalogProvider } from "@/components/providers/catalog-provider";
import { getCatalogData } from "@/server/catalog";

export const metadata: Metadata = {
  title: { default: "Insurance vendor portal", template: "%s · MarchGear Insurance" },
  robots: { index: false, follow: false },
};

// The catalogue (brands, models, variants, cities, content) is available to every portal page via useCatalog().
export default async function InsuranceVendorRootLayout({ children }: LayoutProps<"/insurance-vendor">) {
  const catalog = await getCatalogData();
  return (
    <CatalogProvider data={catalog}>
      <AppProvider>
        {children}
        <Toaster />
      </AppProvider>
    </CatalogProvider>
  );
}
