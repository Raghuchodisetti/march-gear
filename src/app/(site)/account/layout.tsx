import type { Metadata } from "next";
import { and, count, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { customerNotifications } from "@/db/schema";
import { getSessionUser } from "@/server/auth";
import { getGarageReminders, notifyGarageReminders } from "@/server/customer/garage";
import { AccountShell } from "@/components/customer/account-shell";

export const metadata: Metadata = {
  title: { default: "My account", template: "%s · My account · MarchGear" },
  robots: { index: false, follow: false },
};

// Builds the chrome only. Every page calls requireUser("/account/…") itself, so a signed-out visitor
// is sent to sign in and brought back to the exact page they asked for.
export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const user = await getSessionUser("customer");
  if (!user) return children;
  // Due garage reminders become notifications first (idempotent), so the unread badge counts them.
  await notifyGarageReminders(user.id, await getGarageReminders(user.id));
  const [{ unread }] = await getDb()
    .select({ unread: count() })
    .from(customerNotifications)
    .where(and(eq(customerNotifications.userId, user.id), isNull(customerNotifications.readAt)));
  return (
    <AccountShell user={{ name: user.name, email: user.email, city: user.city, memberSince: user.memberSince }} badges={{ notifications: unread }}>
      {children}
    </AccountShell>
  );
}
