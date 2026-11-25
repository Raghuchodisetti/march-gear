import type { ReactNode } from "react";
import { getClientCatalogData } from "@/server/catalog";
import { CatalogProvider } from "@/components/providers/catalog-provider";
import { AppProvider } from "@/components/providers/app-provider";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SearchOverlay } from "@/components/layout/search-overlay";
import { LocationModal } from "@/components/layout/location-modal";
import { CompareTray } from "@/components/layout/compare-tray";
import { Toaster } from "@/components/layout/toaster";
import { EnquiryModal } from "@/components/forms/enquiry-modal";

/** Public-site chrome: catalogue, header, footer and the global overlays. */
export async function SiteShell({ children }: { children: ReactNode }) {
  const catalog = await getClientCatalogData();
  return (
    <CatalogProvider data={catalog}>
      <AppProvider>
        <a href="#main" className="sr-only z-[100] bg-ink px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        <AnnouncementBar />
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <CompareTray />
        <SearchOverlay />
        <LocationModal />
        <EnquiryModal />
        <Toaster />
      </AppProvider>
    </CatalogProvider>
  );
}
