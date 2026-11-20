import { and, count, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerLeads, partnerNotifications, partnerTestDrives } from "@/db/schema";
import { PARTNER_ROLE_LABEL, PARTNER_STATUS_LABEL, PARTNER_STATUS_TONE } from "@/partner/labels";
import type { Permission } from "@/partner/permissions";
import { requirePartner } from "@/server/partner/context";
import { testDriveScope } from "@/server/partner/crm";
import { PortalShell, type PortalNavItem } from "@/components/portal/portal-shell";
import { notificationVisible } from "@/components/portal/notifications/categories";

// Every page re-checks access itself; this only builds the chrome.
export default async function PortalLayout({ children }: LayoutProps<"/dealer">) {
  const ctx = await requirePartner({ approved: false });
  const { partner, member, user } = ctx;
  const db = getDb();
  const mine = or(isNull(partnerNotifications.userId), eq(partnerNotifications.userId, user.id));
  const [unreadRows, [{ newLeads }], [{ requests }]] = await Promise.all([
    db
      .select({ kind: partnerNotifications.kind, userId: partnerNotifications.userId })
      .from(partnerNotifications)
      .where(and(eq(partnerNotifications.partnerId, partner.id), isNull(partnerNotifications.readAt), mine))
      .limit(500),
    ctx.approved
      ? db
          .select({ newLeads: count() })
          .from(partnerLeads)
          .where(
            and(
              eq(partnerLeads.partnerId, partner.id),
              eq(partnerLeads.status, "new"),
              // People who only see their own enquiries get a badge for their own.
              ctx.can("leads.view_all") ? undefined : eq(partnerLeads.assignedMemberId, member.id),
            ),
          )
      : Promise.resolve([{ newLeads: 0 }]),
    ctx.approved
      ? // The same requests this person sees on the Test drives page.
        db.select({ requests: count() }).from(partnerTestDrives).where(and(testDriveScope(ctx), eq(partnerTestDrives.status, "requested")))
      : Promise.resolve([{ requests: 0 }]),
  ]);

  // Only what this person can open (e.g. a sales executive's badge doesn't count billing updates).
  const unread = unreadRows.filter((n) => notificationVisible(n, ctx.can)).length;

  // Visible if permitted; locked (not hidden) until the dealership is approved.
  const item = (href: string, label: string, icon: PortalNavItem["icon"], perm: Permission | null, extra: Partial<PortalNavItem> = {}): PortalNavItem | null =>
    perm && !ctx.can(perm) ? null : { href, label, icon, locked: !ctx.approved, ...extra };
  const always = (href: string, label: string, icon: PortalNavItem["icon"], extra: Partial<PortalNavItem> = {}): PortalNavItem => ({ href, label, icon, ...extra });
  const group = (title: string | undefined, items: (PortalNavItem | null)[]) => ({ title, items: items.filter((i): i is PortalNavItem => i !== null) });

  const groups = [
    group(undefined, [
      ctx.approved ? item("/dealer/dashboard", "Dashboard", "dashboard", "dashboard.view") : always("/dealer/application-status", "Application status", "status"),
      always("/dealer/notifications", "Notifications", "notifications", { badge: unread }),
      ctx.approved ? always("/dealer/application-status", "Verification", "status") : null,
    ]),
    group("Sales", [
      item("/dealer/enquiries", "Enquiries", "enquiries", ctx.can("leads.view_all") ? "leads.view_all" : "leads.view_own", { badge: newLeads }),
      item("/dealer/test-drives", "Test drives", "testDrives", "test_drives.manage", { badge: requests }),
      item("/dealer/customers", "Customers", "customers", "customers.view"),
    ]),
    group("Inventory", [
      item("/dealer/inventory", "Vehicles", "inventory", "inventory.view"),
      item("/dealer/brands", "Brands", "brands", "brands.manage"),
      item("/dealer/models", "Models & variants", "models", "brands.manage"),
    ]),
    group("Marketing", [
      item("/dealer/offers", "Offers", "offers", "offers.view"),
      item("/dealer/campaigns", "Campaigns", "campaigns", "offers.view"),
      item("/dealer/reviews", "Reviews", "reviews", "reviews.reply"),
      item("/dealer/media", "Media library", "media", "media.manage"),
    ]),
    group("Dealership", [
      item("/dealer/profile", "Profile", "profile", "profile.manage"),
      item("/dealer/showrooms", "Showrooms", "showrooms", "profile.manage"),
      item("/dealer/staff", "Staff", "staff", "staff.manage"),
      item("/dealer/analytics", "Analytics", "analytics", "analytics.view"),
    ]),
    group("Account", [
      item("/dealer/subscriptions", "Subscription", "subscriptions", "billing.manage"),
      item("/dealer/invoices", "Invoices", "invoices", "billing.manage"),
      ctx.can("support.use") ? always("/dealer/support", "Support", "support") : null,
      always("/dealer/settings", "Settings", "settings"),
    ]),
  ].filter((g) => g.items.length);

  const app = partner.application;
  const name = partner.tradeName || partner.legalName || app.business.tradeName || app.business.legalName || "Your dealership";

  return (
    <PortalShell
      dealership={{
        name,
        reference: partner.reference,
        status: partner.status,
        statusLabel: PARTNER_STATUS_LABEL[partner.status],
        statusTone: PARTNER_STATUS_TONE[partner.status],
        logo: partner.profile?.logo ?? "",
      }}
      user={{ name: user.name, email: user.email, roleLabel: PARTNER_ROLE_LABEL[member.role] }}
      groups={groups}
      unread={unread}
    >
      {children}
    </PortalShell>
  );
}
