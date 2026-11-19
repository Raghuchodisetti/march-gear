import type { Metadata } from "next";
import { AppProvider } from "@/components/providers/app-provider";
import { Toaster } from "@/components/layout/toaster";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · MarchGear Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppProvider>
      {children}
      <Toaster />
    </AppProvider>
  );
}
