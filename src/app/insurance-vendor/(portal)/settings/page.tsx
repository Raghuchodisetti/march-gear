import type { Metadata } from "next";
import { and, count, desc, eq, gt, inArray, isNotNull, like } from "drizzle-orm";
import { History } from "lucide-react";
import { getDb } from "@/db";
import { insActivity, insEnquiries, insMembers, sessions, users } from "@/db/schema";
import { insurerPlans } from "@/content/blocks/insurer-plans";
import { INS_BUSINESS_TYPE_LABEL, INS_LEAD_OPEN, INS_ROLE_LABEL, INS_VENDOR_CATEGORY_LABEL, INS_VENDOR_STATUS_LABEL } from "@/insurance/labels";
import { insPermissionsFor } from "@/insurance/permissions";
import { currentSessionId } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { INS_PORTAL_BLOCKED, requireInsurer, vendorName } from "@/server/insurance/context";
import { FilterForm, FilterSelect, Pagination, PortalHeader, SearchInput, Table, Td, Th, formatDateTime, formatDay, pageParam, strParam } from "@/components/portal/ui";
import { PageTabs } from "@/components/portal/profile/kit";
import { InsAccountDetails, InsSecurityPanel, type InsSessionView } from "@/components/insurance/vendor/settings/account-forms";
import { InsTeamManager, type InsMemberView } from "@/components/insurance/vendor/settings/team-manager";
import { InsCompanyCard } from "@/components/insurance/vendor/settings/company-card";

export const metadata: Metadata = { title: "Settings" };

const PAGE = 25;

function device(ua: string | null) {
  if (!ua) return { label: "Unknown device", mobile: false };
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return { label: os ? `${browser} on ${os}` : browser, mobile: /Mobile|Android|iPhone/.test(ua) };
}

const ENTITY_LABEL: Record<string, string> = {
  application: "Application",
  account: "Account",
  security: "Security",
  team: "Team",
  document: "Documents",
  media: "Media",
  profile: "Profile",
  profile_change: "Change request",
  branch: "Branches",
  product: "Products",
  cover: "Coverage & add-ons",
  enquiry: "Enquiries",
  quote: "Quotes",
  renewal: "Renewals",
  campaign: "Campaigns",
  ad_campaign: "Advertising",
  ad_creative: "Advertising",
  invoice: "Billing",
  payment: "Billing",
  subscription: "Billing",
  ticket: "Support",
  notification: "Notifications",
};
const entityLabel = (e: string) => ENTITY_LABEL[e] ?? e.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export default async function InsuranceSettingsPage(props: PageProps<"/insurance-vendor/settings">) {
  const ctx = await requireInsurer({ approved: false });
  const { vendor } = ctx;
  const sp = await props.searchParams;
  const db = getDb();
  const now = new Date();
  const currentId = await currentSessionId("insurer");
  const canTeam = ctx.can("team.manage");
  const everyone = canTeam || ctx.can("settings.manage");

  // Activity log filters (a GET form inside the Activity tab).
  const q = strParam(sp.q);
  const entity = strParam(sp.entity);
  const userFilter = everyone ? Number(strParam(sp.user)) || undefined : ctx.user.id;
  const page = pageParam(sp.page);
  const actWhere = and(
    eq(insActivity.vendorId, vendor.id),
    userFilter ? eq(insActivity.userId, userFilter) : undefined,
    entity ? eq(insActivity.entity, entity) : undefined,
    q ? like(insActivity.summary, `%${q.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
  );

  const [[u], mySessions, [{ total }], log, entities, memberRows, catalog] = await Promise.all([
    db.select().from(users).where(eq(users.id, ctx.user.id)),
    db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, ctx.user.id), gt(sessions.expiresAt, now)))
      .orderBy(desc(sessions.createdAt)),
    db.select({ total: count() }).from(insActivity).where(actWhere),
    db
      .select({ id: insActivity.id, entity: insActivity.entity, summary: insActivity.summary, createdAt: insActivity.createdAt, who: users.name })
      .from(insActivity)
      .leftJoin(users, eq(users.id, insActivity.userId))
      .where(actWhere)
      .orderBy(desc(insActivity.createdAt), desc(insActivity.id))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    db
      .selectDistinct({ entity: insActivity.entity })
      .from(insActivity)
      .where(and(eq(insActivity.vendorId, vendor.id), everyone ? undefined : eq(insActivity.userId, ctx.user.id))),
    db
      .select({ m: insMembers, name: users.name, email: users.email, phone: users.phone, lastLoginAt: users.lastLoginAt })
      .from(insMembers)
      .innerJoin(users, eq(users.id, insMembers.userId))
      .where(eq(insMembers.vendorId, vendor.id))
      .orderBy(insMembers.id),
    getCatalog(),
  ]);

  const plans = catalog.content.insurerPlans.plans;
  const plan = plans.find((p) => p.id === vendor.plan) ?? insurerPlans.defaults.plans.find((p) => p.id === vendor.plan) ?? insurerPlans.defaults.plans[0];

  // Team: open enquiries per member and recent activity (team tab only).
  let members: InsMemberView[] = [];
  if (canTeam) {
    const ids = memberRows.map((r) => r.m.id);
    const userIds = memberRows.map((r) => r.m.userId);
    const [open, recent] = await Promise.all([
      ids.length
        ? db
            .select({ memberId: insEnquiries.assignedMemberId, n: count() })
            .from(insEnquiries)
            .where(and(eq(insEnquiries.vendorId, vendor.id), isNotNull(insEnquiries.assignedMemberId), inArray(insEnquiries.status, INS_LEAD_OPEN)))
            .groupBy(insEnquiries.assignedMemberId)
        : Promise.resolve([]),
      userIds.length
        ? db
            .select({ id: insActivity.id, userId: insActivity.userId, summary: insActivity.summary, createdAt: insActivity.createdAt })
            .from(insActivity)
            .where(and(eq(insActivity.vendorId, vendor.id), inArray(insActivity.userId, userIds)))
            .orderBy(desc(insActivity.createdAt), desc(insActivity.id))
            .limit(200)
        : Promise.resolve([]),
    ]);
    const openBy = new Map(open.map((o) => [o.memberId, o.n]));
    members = memberRows.map(({ m, name, email, phone, lastLoginAt }) => ({
      id: m.id,
      userId: m.userId,
      name,
      email,
      phone,
      role: m.role,
      permissions: insPermissionsFor(m),
      custom: m.role !== "owner" && m.permissions !== null,
      isActive: m.isActive,
      lastLogin: lastLoginAt ? formatDateTime(lastLoginAt) : null,
      joined: formatDay(m.createdAt),
      openEnquiries: openBy.get(m.id) ?? 0,
      activity: recent
        .filter((a) => a.userId === m.userId)
        .slice(0, 8)
        .map((a) => ({ id: a.id, summary: a.summary, when: formatDateTime(a.createdAt) })),
    }));
  }

  const sessionViews: InsSessionView[] = mySessions.map((s) => {
    const d = device(s.userAgent);
    return { id: s.id, device: d.label, mobile: d.mobile, ip: s.ip, started: formatDateTime(s.createdAt), expires: formatDay(s.expiresAt), current: s.id === currentId };
  });
  sessionViews.sort((a, b) => Number(b.current) - Number(a.current));

  const tab = typeof sp.tab === "string" ? sp.tab : q || entity || sp.user || sp.page ? "activity" : "account";
  const params = { tab: "activity", q, entity, user: everyone && userFilter ? String(userFilter) : undefined };
  const hasFilters = Boolean(q || entity || (everyone && userFilter));
  const app = vendor.application;
  const activeCount = memberRows.filter((r) => r.m.isActive).length;

  const activityPanel = (
    <div>
      <FilterForm resetHref="/insurance-vendor/settings?tab=activity" hasFilters={hasFilters}>
        <input type="hidden" name="tab" value="activity" />
        <SearchInput value={q} placeholder="Search the log…" />
        <FilterSelect name="entity" value={entity} label="All areas" options={entities.map((e) => ({ value: e.entity, label: entityLabel(e.entity) })).sort((a, b) => a.label.localeCompare(b.label))} />
        {everyone && <FilterSelect name="user" value={userFilter ? String(userFilter) : undefined} label="Everyone" options={memberRows.map((t) => ({ value: String(t.m.userId), label: t.name }))} />}
      </FilterForm>
      {log.length ? (
        <Table>
          <thead>
            <tr>
              <Th className="w-[190px]">When</Th>
              <Th className="w-[180px]">Who</Th>
              <Th>What happened</Th>
              <Th className="w-[150px]">Area</Th>
            </tr>
          </thead>
          <tbody>
            {log.map((a) => (
              <tr key={a.id} className="transition-colors hover:bg-mist/40">
                <Td className="whitespace-nowrap text-[12.5px] text-muted">{formatDateTime(a.createdAt)}</Td>
                <Td className="text-[13px]">{a.who ?? "System"}</Td>
                <Td>{a.summary}</Td>
                <Td className="text-[12.5px] text-muted">{entityLabel(a.entity)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="flex flex-col items-center border border-line bg-white px-6 py-14 text-center">
          <History aria-hidden className="size-5 text-muted" />
          <p className="mt-3 text-[14px] font-medium">{hasFilters ? "Nothing matches these filters." : "No activity recorded yet."}</p>
          <p className="mt-1 max-w-sm text-[13px] text-muted">{hasFilters ? "Try another area or clear the search." : "Changes to the application, team and settings will appear here."}</p>
        </div>
      )}
      <Pagination base="/insurance-vendor/settings" params={params} page={page} pageSize={PAGE} total={total} />
      <p className="mt-3 text-[12px] text-muted">{everyone ? "Everything people at your company did in the portal. Times are in IST." : "Your own actions in the portal. Owners and administrators can see the whole team's log."}</p>
    </div>
  );

  const items = [
    { value: "account", label: "Account" },
    ...(canTeam ? [{ value: "team", label: "Team", count: activeCount }] : []),
    { value: "activity", label: "Activity log" },
    { value: "company", label: "Company" },
  ];

  return (
    <>
      <PortalHeader title="Settings" description="Your account and security, your team, the activity log and company settings." />
      <PageTabs
        initial={tab}
        items={items}
        panels={{
          account: (
            <div className="space-y-6">
              <InsAccountDetails
                initial={{ name: u.name, mobile: u.phone ?? "" }}
                facts={[
                  { label: "Sign-in email", value: u.email },
                  { label: "Role", value: INS_ROLE_LABEL[ctx.member.role] },
                  { label: "Company", value: `${vendorName(vendor)} · ${vendor.reference}` },
                  { label: "Company status", value: INS_VENDOR_STATUS_LABEL[vendor.status] },
                  { label: "Member since", value: formatDay(u.createdAt) },
                  { label: "Last sign-in", value: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—" },
                ]}
              />
              <InsSecurityPanel sessions={sessionViews} />
            </div>
          ),
          ...(canTeam
            ? {
                team: (
                  <InsTeamManager
                    members={members}
                    me={ctx.user.id}
                    isOwner={ctx.member.role === "owner"}
                    myPerms={ctx.perms}
                    limit={plan.members ?? null}
                    planName={plan.name}
                    blocked={INS_PORTAL_BLOCKED.includes(vendor.status)}
                  />
                ),
              }
            : {}),
          activity: activityPanel,
          company: (
            <InsCompanyCard
              facts={[
                { label: "Company", value: vendorName(vendor) },
                { label: "Legal name", value: vendor.legalName ?? app.company.legalName },
                { label: "Reference", value: vendor.reference },
                { label: "Status", value: INS_VENDOR_STATUS_LABEL[vendor.status] },
                { label: "Category", value: vendor.category ? INS_VENDOR_CATEGORY_LABEL[vendor.category] : "" },
                { label: "Business type", value: app.company.businessType ? INS_BUSINESS_TYPE_LABEL[app.company.businessType] : "" },
                { label: "Registered office", value: [app.company.city, app.company.state].filter(Boolean).join(", ") },
                { label: "Plan", value: `${plan.name}${plan.members === null ? " · unlimited team" : ` · up to ${plan.members} team accounts`}` },
                { label: "Team", value: `${activeCount} active ${activeCount === 1 ? "account" : "accounts"}` },
              ]}
              links={[
                ...(ctx.approved && ctx.can("profile.manage") ? [{ href: "/insurance-vendor/profile", label: "Company profile" }] : []),
                ...(ctx.approved && ctx.can("billing.manage") ? [{ href: "/insurance-vendor/billing", label: "Plans & billing" }] : []),
                { href: "/insurance-vendor/application-status", label: ctx.approved ? "Verification" : "Application status" },
              ]}
            />
          ),
        }}
      />
    </>
  );
}
