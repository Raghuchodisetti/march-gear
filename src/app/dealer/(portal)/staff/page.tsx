import type { Metadata } from "next";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerActivity, partnerLeads, partnerMembers, users } from "@/db/schema";
import { permissionsFor } from "@/partner/permissions";
import { planById } from "@/partner/plans";
import { getCatalog } from "@/server/catalog";
import { requirePartner } from "@/server/partner/context";
import { CRM_DONE } from "@/server/partner/dashboard";
import { PortalHeader, formatDateTime, formatDay } from "@/components/portal/ui";
import { StaffManager, type MemberView } from "@/components/portal/staff/staff-manager";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const ctx = await requirePartner({ perm: "staff.manage" });
  const db = getDb();
  const pid = ctx.partner.id;
  const [rows, leads, catalog] = await Promise.all([
    db
      .select({ m: partnerMembers, name: users.name, email: users.email, phone: users.phone, lastLogin: users.lastLoginAt })
      .from(partnerMembers)
      .innerJoin(users, eq(users.id, partnerMembers.userId))
      .where(eq(partnerMembers.partnerId, pid))
      .orderBy(desc(partnerMembers.isActive), sql`${partnerMembers.role} = 'owner' DESC`, asc(partnerMembers.createdAt)),
    db
      .select({
        memberId: partnerLeads.assignedMemberId,
        total: count(),
        open: sql<number>`SUM(CASE WHEN ${partnerLeads.status} NOT IN (${sql.join(
          CRM_DONE.map((s) => sql`${s}`),
          sql`, `,
        )}) THEN 1 ELSE 0 END)`,
      })
      .from(partnerLeads)
      .where(eq(partnerLeads.partnerId, pid))
      .groupBy(partnerLeads.assignedMemberId),
    getCatalog(),
  ]);
  const userIds = rows.map((r) => r.m.userId);
  const activity = userIds.length
    ? await db
        .select({ id: partnerActivity.id, userId: partnerActivity.userId, summary: partnerActivity.summary, createdAt: partnerActivity.createdAt })
        .from(partnerActivity)
        .where(and(eq(partnerActivity.partnerId, pid), inArray(partnerActivity.userId, userIds)))
        .orderBy(desc(partnerActivity.createdAt), desc(partnerActivity.id))
        .limit(400)
    : [];
  const byLead = new Map(leads.map((l) => [l.memberId, l]));

  const members: MemberView[] = rows.map(({ m, name, email, phone, lastLogin }) => {
    const l = byLead.get(m.id);
    return {
      id: m.id,
      userId: m.userId,
      name,
      email,
      phone,
      role: m.role,
      permissions: permissionsFor(m),
      custom: m.role !== "owner" && m.permissions !== null,
      isActive: m.isActive,
      lastLogin: lastLogin ? formatDateTime(lastLogin) : null,
      joined: formatDay(m.createdAt),
      openLeads: Number(l?.open ?? 0),
      totalLeads: l?.total ?? 0,
      activity: activity
        .filter((a) => a.userId === m.userId)
        .slice(0, 15)
        .map((a) => ({ id: a.id, summary: a.summary, when: formatDateTime(a.createdAt) })),
    };
  });

  const plan = catalog.content.partnerPlans.plans.find((p) => p.id === ctx.partner.plan);
  const fallback = planById(ctx.partner.plan);

  return (
    <>
      <PortalHeader title="Staff" description="Your team, their roles and exactly what each person can do in the portal." />
      <StaffManager
        members={members}
        me={ctx.user.id}
        isOwner={ctx.member.role === "owner"}
        myPerms={ctx.perms}
        limit={plan ? plan.staff : fallback.limits.staff}
        planName={plan?.name ?? fallback.name}
      />
    </>
  );
}
