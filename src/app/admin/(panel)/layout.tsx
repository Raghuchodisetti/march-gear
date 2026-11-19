import { count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { leads, ownerReviews } from "@/db/schema";
import { requireStaff } from "@/server/auth";
import { AdminShell } from "@/components/admin/admin-shell";

// Each page and action re-checks access too; this only builds the chrome.
export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();
  const db = getDb();
  const [[{ n: newLeads }], [{ n: pendingReviews }]] = await Promise.all([
    db.select({ n: count() }).from(leads).where(eq(leads.status, "new")),
    db.select({ n: count() }).from(ownerReviews).where(eq(ownerReviews.status, "pending")),
  ]);
  return (
    <AdminShell user={{ name: user.name, email: user.email, role: user.role }} newLeads={newLeads} pendingReviews={pendingReviews}>
      {children}
    </AdminShell>
  );
}
