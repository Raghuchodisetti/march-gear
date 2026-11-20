import { and, count, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { insEnquiries, insNotifications } from "@/db/schema";
import { INS_ROLE_LABEL, INS_VENDOR_STATUS_LABEL, INS_VENDOR_STATUS_TONE } from "@/insurance/labels";
import type { InsPermission } from "@/insurance/permissions";
import { requireInsurer, vendorName } from "@/server/insurance/context";
import { insNotificationScope } from "@/server/insurance/records";
import { PortalShell, type PortalNavItem } from "@/components/portal/portal-shell";

// Every page re-checks access itself; this only builds the chrome.
export default async function InsuranceVendorPortalLayout({ children }: LayoutProps<"/insurance-vendor">) {
  const ctx = await requireInsurer({ approved: false });
  const { vendor, member, user } = ctx;
  const db = getDb();
  const [[{ unread }], [{ newEnquiries }]] = await Promise.all([
    db
      .select({ unread: count() })
      .from(insNotifications)
      .where(and(insNotificationScope(ctx), isNull(insNotifications.readAt))),
    ctx.approved
      ? db
          .select({ newEnquiries: count() })
          .from(insEnquiries)
          .where(
            and(
              eq(insEnquiries.vendorId, vendor.id),
              eq(insEnquiries.status, "new"),
              // People who only see their own enquiries get a badge for their own.
              ctx.can("enquiries.view_all") ? undefined : eq(insEnquiries.assignedMemberId, member.id),
            ),
          )
      : Promise.resolve([{ newEnquiries: 0 }]),
  ]);

  // Visible if permitted; locked (not hidden) until the vendor is approved.
  const item = (href: string, label: string, icon: PortalNavItem["icon"], perm: InsPermission | null, extra: Partial<PortalNavItem> = {}): PortalNavItem | null =>
    perm && !ctx.can(perm) ? null : { href, label, icon, locked: !ctx.approved, ...extra };
  const always = (href: string, label: string, icon: PortalNavItem["icon"], extra: Partial<PortalNavItem> = {}): PortalNavItem => ({ href, label, icon, ...extra });
  const group = (title: string | undefined, items: (PortalNavItem | null)[]) => ({ title, items: items.filter((i): i is PortalNavItem => i !== null) });
  const base = "/insurance-vendor";

  const groups = [
    group(undefined, [
      ctx.approved ? item(`${base}/dashboard`, "Dashboard", "dashboard", "dashboard.view") : always(`${base}/application-status`, "Application status", "status"),
      always(`${base}/notifications`, "Notifications", "notifications", { badge: unread }),
      ctx.approved ? always(`${base}/application-status`, "Verification", "status") : null,
    ]),
    group("Products", [
      item(`${base}/products`, "Insurance products", "products", "products.view"),
      item(`${base}/products/create`, "Add new product", "addOns", "products.manage"),
      item(`${base}/coverage`, "Coverage", "coverage", "products.view"),
      item(`${base}/add-ons`, "Add-on covers", "brands", "products.view"),
      item(`${base}/approvals`, "Product approvals", "approvals", "products.view"),
    ]),
    group("Customers", [
      item(`${base}/enquiries`, "Customer enquiries", "enquiries", ctx.can("enquiries.view_all") ? "enquiries.view_all" : "enquiries.view_own", { badge: newEnquiries }),
      item(`${base}/quotes`, "Quotes", "quotes", "quotes.manage"),
      item(`${base}/renewals`, "Renewals", "renewals", "renewals.manage"),
    ]),
    group("Marketing", [
      item(`${base}/campaigns`, "Campaigns", "campaigns", "campaigns.manage"),
      item(`${base}/advertising`, "Advertising", "advertising", "ads.manage"),
      item(`${base}/analytics`, "Analytics", "analytics", "analytics.view"),
    ]),
    group("Company", [
      item(`${base}/profile`, "Company profile", "profile", "profile.manage"),
      item(`${base}/billing`, "Billing", "billing", "billing.manage"),
      item(`${base}/invoices`, "Invoices", "invoices", "billing.manage"),
      item(`${base}/transactions`, "Transactions", "transactions", "billing.manage"),
      ctx.can("support.use") ? always(`${base}/support`, "Support", "support") : null,
      always(`${base}/settings`, "Settings", "settings"),
    ]),
  ].filter((g) => g.items.length);

  return (
    <PortalShell
      variant="insurer"
      dealership={{
        name: vendorName(vendor),
        reference: vendor.reference,
        status: vendor.status,
        statusLabel: INS_VENDOR_STATUS_LABEL[vendor.status],
        statusTone: INS_VENDOR_STATUS_TONE[vendor.status],
        logo: vendor.profile?.logo ?? "",
      }}
      user={{ name: user.name, email: user.email, roleLabel: INS_ROLE_LABEL[member.role] }}
      groups={groups}
      unread={unread}
    >
      {children}
    </PortalShell>
  );
}
