import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { getCustomerSessions } from "@/server/customer/account";
import { PortalHeader, formatDateTime, formatDay } from "@/components/portal/ui";
import { PasswordCard, SessionsCard } from "@/components/customer/security/security-panel";

export const metadata: Metadata = { title: "Password & security" };

export default async function SecurityPage() {
  const user = await requireUser("/account/security");
  const sessions = await getCustomerSessions(user.id);

  return (
    <>
      <PortalHeader title="Password & security" description="Change your password and see every browser that's signed in to your MarchGear account." />
      <div className="space-y-6">
        <PasswordCard email={user.email} />
        <SessionsCard sessions={sessions.map((s) => ({ ...s, started: formatDateTime(s.started), expires: formatDay(s.expires) }))} />
        <p className="text-[12px] leading-relaxed text-muted">
          Your website account is separate from MarchGear&apos;s dealer, insurer and staff sign-ins — signing out here doesn&apos;t affect them. We never ask for your password by phone or email.
        </p>
      </div>
    </>
  );
}
