import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { getPreferences } from "@/server/customer/account";
import { PortalHeader } from "@/components/portal/ui";
import { PreferencesForm } from "@/components/customer/preferences/preferences-form";

export const metadata: Metadata = { title: "Preferences" };

export default async function PreferencesPage() {
  const user = await requireUser("/account/preferences");
  const { preferences, chosen } = await getPreferences(user.id);
  return (
    <>
      <PortalHeader title="Preferences" description="Choose what we tell you about and how you'd like to be contacted." />
      <PreferencesForm initial={preferences} chosen={chosen} />
    </>
  );
}
