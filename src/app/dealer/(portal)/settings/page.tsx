import type { Metadata } from "next";
import { createHash } from "node:crypto";
import { and, count, desc, eq, gt, isNull, like, notInArray, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { partnerActivity, partnerMembers, partnerNotifications, partnerTickets, sessions, users } from "@/db/schema";
import { PARTNER_ROLE_LABEL, PARTNER_STATUS_LABEL } from "@/partner/labels";
import { SESSION_COOKIE } from "@/server/auth";
import { requirePartner } from "@/server/partner/context";
import { EmptyRow, FilterForm, FilterSelect, Pagination, PortalHeader, SearchInput, Table, Td, Th, formatDateTime, formatDay, pageParam, strParam } from "@/components/portal/ui";
import { PageTabs } from "@/components/portal/profile/kit";
import { AccountForm, DeactivateCard, NotificationPrefs, SecurityPanel, type SessionView } from "@/components/portal/settings/settings-forms";
import { DEACTIVATION_SUBJECT } from "@/components/portal/settings/shared";
import { DEFAULT_DEALER_PREFS, categoryOf, type DealerNotificationPrefs, type NotificationCategory } from "@/components/portal/notifications/categories";

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
  profile: "Profile",
  profile_change: "Change request",
  showroom: "Showrooms",
  brand: "Brands",
  brand_models: "Models",
  staff: "Staff",
  account: "Account",
  security: "Security",
  preferences: "Preferences",
  media: "Media",
  document: "Documents",
  vehicle: "Vehicles",
  offer: "Offers",
  lead: "Enquiries",
  test_drive: "Test drives",
  ticket: "Support",
  invoice: "Billing",
  payment: "Billing",
  subscription: "Billing",
  review: "Reviews",
  analytics: "Analytics",
  partner: "Dealership",
};

export default async function SettingsPage(props: PageProps<"/dealer/settings">) {
  const ctx = await requirePartner({ approved: false });
  const sp = await props.searchParams;
  const db = getDb();
  const now = new Date();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const currentId = token ? createHash("sha256").update(token).digest("hex") : null;
  const everyone = ctx.can("settings.manage") || ctx.can("staff.manage");

  // Activity log filters (GET form inside the Activity tab).
  const q = strParam(sp.q);
  const entity = strParam(sp.entity);
  const userFilter = everyone ? Number(strParam(sp.user)) || undefined : ctx.user.id;
  const page = pageParam(sp.page);
  const actWhere = and(
    eq(partnerActivity.partnerId, ctx.partner.id),
    userFilter ? eq(partnerActivity.userId, userFilter) : undefined,
    entity ? eq(partnerActivity.entity, entity) : undefined,
    q ? like(partnerActivity.summary, `%${q.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
  );

  const [[u], mySessions, [{ total }], log, entities, team, ticket, notes] = await Promise.all([
    db.select().from(users).where(eq(users.id, ctx.user.id)),
    db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, ctx.user.id), gt(sessions.expiresAt, now)))
      .orderBy(desc(sessions.createdAt)),
    db.select({ total: count() }).from(partnerActivity).where(actWhere),
    db
      .select({ id: partnerActivity.id, action: partnerActivity.action, entity: partnerActivity.entity, summary: partnerActivity.summary, createdAt: partnerActivity.createdAt, who: users.name })
      .from(partnerActivity)
      .leftJoin(users, eq(users.id, partnerActivity.userId))
      .where(actWhere)
      .orderBy(desc(partnerActivity.createdAt), desc(partnerActivity.id))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    db
      .selectDistinct({ entity: partnerActivity.entity })
      .from(partnerActivity)
      .where(and(eq(partnerActivity.partnerId, ctx.partner.id), everyone ? undefined : eq(partnerActivity.userId, ctx.user.id))),
    everyone
      ? db.select({ id: users.id, name: users.name }).from(partnerMembers).innerJoin(users, eq(users.id, partnerMembers.userId)).where(eq(partnerMembers.partnerId, ctx.partner.id))
      : Promise.resolve([]),
    db
      .select({ id: partnerTickets.id, reference: partnerTickets.reference, createdAt: partnerTickets.createdAt })
      .from(partnerTickets)
      .where(and(eq(partnerTickets.partnerId, ctx.partner.id), eq(partnerTickets.subject, DEACTIVATION_SUBJECT), notInArray(partnerTickets.status, ["resolved", "closed"])))
      .limit(1),
    db
      .select({ kind: partnerNotifications.kind })
      .from(partnerNotifications)
      .where(and(eq(partnerNotifications.partnerId, ctx.partner.id), or(isNull(partnerNotifications.userId), eq(partnerNotifications.userId, ctx.user.id)))),
  ]);

  const prefs: DealerNotificationPrefs = { ...DEFAULT_DEALER_PREFS, ...((u?.preferences as { dealer?: DealerNotificationPrefs } | null)?.dealer ?? {}) };
  const counts: Partial<Record<NotificationCategory, number>> = {};
  for (const n of notes) {
    const c = categoryOf(n.kind);
    counts[c] = (counts[c] ?? 0) + 1;
  }

  const sessionViews: SessionView[] = mySessions.map((s) => {
    const d = device(s.userAgent);
    return { id: s.id, device: d.label, mobile: d.mobile, ip: s.ip, started: formatDateTime(s.createdAt), expires: formatDay(s.expiresAt), current: s.id === currentId };
  });
  sessionViews.sort((a, b) => Number(b.current) - Number(a.current));

  const tab = typeof sp.tab === "string" ? sp.tab : q || entity || sp.user || sp.page ? "activity" : "account";
  const params = { tab: "activity", q, entity, user: everyone && userFilter ? String(userFilter) : undefined };
  const hasFilters = Boolean(q || entity || (everyone && userFilter));

  const activityPanel = (
    <div>
      <FilterForm resetHref="/dealer/settings?tab=activity" hasFilters={hasFilters}>
        <input type="hidden" name="tab" value="activity" />
        <SearchInput value={q} placeholder="Search the log…" />
        <FilterSelect name="entity" value={entity} label="All areas" options={entities.map((e) => ({ value: e.entity, label: ENTITY_LABEL[e.entity] ?? e.entity.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) })).sort((a, b) => a.label.localeCompare(b.label))} />
        {everyone && <FilterSelect name="user" value={userFilter ? String(userFilter) : undefined} label="Everyone" options={team.map((t) => ({ value: String(t.id), label: t.name }))} />}
      </FilterForm>
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
          {log.length ? (
            log.map((a) => (
              <tr key={a.id} className="transition-colors hover:bg-mist/40">
                <Td className="whitespace-nowrap text-[12.5px] text-muted">{formatDateTime(a.createdAt)}</Td>
                <Td className="text-[13px]">{a.who ?? "System"}</Td>
                <Td>{a.summary}</Td>
                <Td className="text-[12.5px] text-muted">{ENTITY_LABEL[a.entity] ?? a.entity.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}</Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={4}>{hasFilters ? "Nothing matches these filters." : "No activity recorded yet."}</EmptyRow>
          )}
        </tbody>
      </Table>
      <Pagination base="/dealer/settings" params={params} page={page} pageSize={PAGE} total={total} />
      <p className="mt-3 text-[12px] text-muted">{everyone ? "Everything people at your dealership did in the portal." : "Your own actions in the portal. Owners and administrators can see the whole team's log."}</p>
    </div>
  );

  return (
    <>
      <PortalHeader title="Settings" description="Your account, security, notification preferences and the activity log." />
      <PageTabs
        initial={tab}
        items={[
          { value: "account", label: "Account" },
          { value: "security", label: "Security" },
          { value: "notifications", label: "Notifications" },
          { value: "activity", label: "Activity log" },
          { value: "dealership", label: "Dealership" },
        ]}
        panels={{
          account: (
            <AccountForm
              initial={{ name: u.name, mobile: u.phone ?? "" }}
              facts={[
                { label: "Sign-in email", value: u.email },
                { label: "Role", value: PARTNER_ROLE_LABEL[ctx.member.role] },
                { label: "Dealership", value: `${ctx.partner.tradeName || ctx.partner.legalName || "Your dealership"} · ${ctx.partner.reference}` },
                { label: "Dealership status", value: PARTNER_STATUS_LABEL[ctx.partner.status] },
                { label: "Member since", value: formatDay(u.createdAt) },
                { label: "Last sign-in", value: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—" },
              ]}
            />
          ),
          security: <SecurityPanel sessions={sessionViews} />,
          notifications: <NotificationPrefs muted={prefs.muted} counts={counts} />,
          activity: activityPanel,
          dealership: (
            <DeactivateCard
              isOwner={ctx.partner.ownerUserId === ctx.user.id}
              status={ctx.partner.status}
              openRequest={ticket[0] ? { id: ticket[0].id, reference: ticket[0].reference, created: formatDay(ticket[0].createdAt) } : null}
            />
          ),
        }}
      />
    </>
  );
}
