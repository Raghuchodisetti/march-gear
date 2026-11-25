import type { Metadata } from "next";
import { AppProvider } from "@/components/providers/app-provider";
import { Toaster } from "@/components/layout/toaster";
import { getDesk } from "@/server/auth";
import { DESK_LABEL } from "@/lib/staff-access";

// Serves both desks: /admin (admins) and /staff (staff, via src/proxy.ts).
export async function generateMetadata(): Promise<Metadata> {
  const label = DESK_LABEL[await getDesk()];
  return { title: { default: label, template: `%s · MarchGear ${label}` }, robots: { index: false, follow: false } };
}

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppProvider>
      {children}
      <Toaster />
    </AppProvider>
  );
}
