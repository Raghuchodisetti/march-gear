import type { Metadata, Viewport } from "next";
import { Archivo, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { INDEXABLE, SITE_LOCALE, SITE_NAME, SITE_URL } from "@/components/seo/site";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  // Canonical origin (NEXT_PUBLIC_SITE_URL, else https://marchgear.in in production): canonicals, og:url and share images resolve against it.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — new & used cars, prices and reviews in India`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Explore, compare and discover new and used cars in India with confidence. Expert reviews, on-road prices, EV insights, car insurance and smart tools.",
  applicationName: SITE_NAME,
  // Pages set their own title/description/url; these (and the opengraph-image file) are the shared defaults.
  openGraph: { siteName: SITE_NAME, locale: SITE_LOCALE, type: "website" },
  twitter: { card: "summary_large_image" },
  // Preview deployments stay out of search; production is indexable page by page.
  ...(INDEXABLE ? {} : { robots: { index: false, follow: false } }),
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" data-scroll-behavior="smooth" className={`${geist.variable} ${geistMono.variable} ${archivo.variable} ${instrument.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
