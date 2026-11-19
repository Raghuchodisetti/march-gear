import type { Metadata, Viewport } from "next";
import { Archivo, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/providers/app-provider";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SearchOverlay } from "@/components/layout/search-overlay";
import { LocationModal } from "@/components/layout/location-modal";
import { CompareTray } from "@/components/layout/compare-tray";
import { Toaster } from "@/components/layout/toaster";
import { EnquiryModal } from "@/components/forms/enquiry-modal";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: {
    default: "March Gear — Find the car that moves you",
    template: "%s · March Gear",
  },
  description:
    "Explore, compare and discover new and used cars in India with confidence. Expert reviews, on-road prices, EV insights and smart tools.",
  applicationName: "March Gear",
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${geist.variable} ${geistMono.variable} ${archivo.variable} ${instrument.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <AppProvider>
          <a
            href="#main"
            className="sr-only z-[100] bg-ink px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
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
      </body>
    </html>
  );
}
