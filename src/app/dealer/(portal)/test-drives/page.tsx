import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gte, inArray, isNotNull, isNull, like, lt, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerTestDrives } from "@/db/schema";
import { TEST_DRIVE_STATUS, type TestDriveStatus } from "@/db/enums";
import { TEST_DRIVE_STATUS_LABEL } from "@/partner/labels";
import { requirePartner } from "@/server/partner/context";
import { leadAccess, modelOptions, queryTestDrives, salesMembers, showroomOptions, testDriveScope, vehicleOptions } from "@/server/partner/crm";
import { Pagination, PortalHeader, filterInput, hrefWith, pageParam, strParam } from "@/components/portal/ui";
import { cn } from "@/lib/utils";
import { Initials, TestDriveBadge } from "@/components/portal/crm/badges";
import { formatWhen, istDay } from "@/components/portal/crm/pipeline";
import type { TestDriveItem } from "@/components/portal/crm/types";
import { CalendarView, calendarRange, istMidnight } from "@/components/portal/test-drives/calendar";
import { NewTestDriveButton, RequestQueue, TestDriveDrawer } from "@/components/portal/test-drives/test-drive-panels";

export const metadata: Metadata = { title: "Test drives" };

const PAGE_SIZE = 25;
const ACTIVE: TestDriveStatus[] = ["accepted", "scheduled", "rescheduled"];
type Tab = "requests" | "upcoming" | "all" | "calendar";

export default async function Page({ searchParams }: PageProps<"/dealer/test-drives">) {
  const ctx = await requirePartner({ perm: "test_drives.manage" });
  const sp = await searchParams;
  const db = getDb();
  const now = new Date();
  const today = istDay(now);
  const scope = testDriveScope(ctx);

  // Headline numbers (from everything this person can see).
  const all = await db
    .select({ status: partnerTestDrives.status, scheduledAt: partnerTestDrives.scheduledAt, rating: partnerTestDrives.rating, updatedAt: partnerTestDrives.updatedAt })
    .from(partnerTestDrives)
    .where(scope)
    .limit(10_000);
  const requestsCount = all.filter((t) => t.status === "requested").length;
  const todayCount = all.filter((t) => ACTIVE.includes(t.status) && t.scheduledAt && istDay(t.scheduledAt) === today).length;
  const weekEnd = new Date(now.getTime() + 7 * 86_400_000);
  const nextWeek = all.filter((t) => ACTIVE.includes(t.status) && t.scheduledAt && t.scheduledAt >= now && t.scheduledAt < weekEnd).length;
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const recent = all.filter((t) => (t.status === "completed" || t.status === "no_show") && t.updatedAt >= since);
  const completed = recent.filter((t) => t.status === "completed");
  const rated = completed.filter((t) => t.rating);
  const avgRating = rated.length ? rated.reduce((s, t) => s + (t.rating ?? 0), 0) / rated.length : null;
  const noShowPct = recent.length ? Math.round(((recent.length - completed.length) / recent.length) * 100) : null;

  const tabParam = strParam(sp.tab);
  const tab: Tab = tabParam === "upcoming" || tabParam === "all" || tabParam === "calendar" || tabParam === "requests" ? tabParam : requestsCount ? "requests" : "upcoming";
  const q = strParam(sp.q)?.slice(0, 80);
  const statusP = strParam(sp.status);
  const status = TEST_DRIVE_STATUS.includes(statusP as TestDriveStatus) ? (statusP as TestDriveStatus) : undefined;
  const assigned = strParam(sp.assigned);
  const page = pageParam(sp.page);
  const cal = strParam(sp.cal) === "month" ? "month" : "week";
  const dParam = strParam(sp.d);
  const anchor = dParam && /^\d{4}-\d{2}-\d{2}$/.test(dParam) ? dParam : today;
  const tdId = Number.parseInt(strParam(sp.td) ?? "", 10);
  const viewAll = leadAccess(ctx) === "all";

  const filters: (SQL | undefined)[] = [];
  if (q) {
    const pat = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    filters.push(or(like(partnerTestDrives.customerName, pat), like(partnerTestDrives.reference, pat), like(partnerTestDrives.carLabel, pat), like(partnerTestDrives.mobile, `%${q.replace(/\D/g, "") || q}%`)));
  }
  if (assigned === "me") filters.push(eq(partnerTestDrives.assignedMemberId, ctx.member.id));
  else if (assigned === "none") filters.push(isNull(partnerTestDrives.assignedMemberId));
  else if (assigned && /^\d+$/.test(assigned)) filters.push(eq(partnerTestDrives.assignedMemberId, Number(assigned)));

  const canAssign = ctx.can("leads.assign") && viewAll;
  const [members, vehicles, models, showrooms] = await Promise.all([salesMembers(ctx.partner.id), vehicleOptions(ctx.partner.id), modelOptions(ctx.partner.id), showroomOptions(ctx.partner.id)]);
  const options = { vehicles, models, showrooms, members, canAssign, selfId: ctx.member.id };

  let items: TestDriveItem[] = [];
  let total = 0;
  if (tab === "requests") {
    items = await queryTestDrives(ctx, and(eq(partnerTestDrives.status, "requested"), ...filters), { order: "created" });
  } else if (tab === "upcoming") {
    // Booked drives from two hours ago onwards, plus accepted ones still waiting for a time.
    const recentPast = new Date(now.getTime() - 2 * 3_600_000);
    items = await queryTestDrives(
      ctx,
      and(inArray(partnerTestDrives.status, ACTIVE), or(isNull(partnerTestDrives.scheduledAt), gte(partnerTestDrives.scheduledAt, recentPast)), ...filters),
      { limit: 300 },
    );
  } else if (tab === "all") {
    const where = and(status ? eq(partnerTestDrives.status, status) : undefined, ...filters);
    const [[{ n }], rows] = await Promise.all([
      db.select({ n: sql<number>`COUNT(*)` }).from(partnerTestDrives).where(and(scope, where)),
      queryTestDrives(ctx, where, { order: "created", limit: PAGE_SIZE * page }),
    ]);
    total = Number(n);
    items = rows.slice((page - 1) * PAGE_SIZE);
  } else {
    const { from, to } = calendarRange(cal, anchor);
    const start = istMidnight(from);
    const end = istMidnight(to);
    items = await queryTestDrives(
      ctx,
      and(
        inArray(partnerTestDrives.status, ["requested", "accepted", "scheduled", "rescheduled", "completed", "no_show"]),
        or(
          and(isNotNull(partnerTestDrives.scheduledAt), gte(partnerTestDrives.scheduledAt, start), lt(partnerTestDrives.scheduledAt, end)),
          and(isNull(partnerTestDrives.scheduledAt), gte(partnerTestDrives.requestedFor, start), lt(partnerTestDrives.requestedFor, end)),
        ),
        ...filters,
      ),
      { limit: 1000 },
    );
  }
  const [selected] = Number.isFinite(tdId) && tdId > 0 ? await queryTestDrives(ctx, eq(partnerTestDrives.id, tdId)) : [];

  const params: Record<string, string | undefined> = { tab, q, status: tab === "all" ? status : undefined, assigned, cal: tab === "calendar" && cal === "month" ? "month" : undefined, d: tab === "calendar" ? dParam : undefined };
  const href = (patch: Record<string, string | undefined>) => hrefWith("/dealer/test-drives", params, { page: undefined, ...patch });
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "requests", label: "Requests", count: requestsCount },
    { key: "upcoming", label: "Upcoming" },
    { key: "calendar", label: "Calendar" },
    { key: "all", label: "All test drives" },
  ];

  return (
    <>
      <PortalHeader title="Test drives" description="Requests from your listings and showroom page, your schedule and every outcome. Times are in IST." actions={<NewTestDriveButton options={options} />} />

      <section aria-label="Test-drive summary" className="mb-6 grid grid-cols-2 border border-line bg-white lg:grid-cols-5">
        {[
          { label: "Awaiting response", value: requestsCount, note: "New requests", red: requestsCount > 0, href: href({ tab: "requests", td: undefined }) },
          { label: "Today", value: todayCount, note: "Scheduled drives", href: href({ tab: "calendar", cal: undefined, d: undefined, td: undefined }) },
          { label: "Next 7 days", value: nextWeek, note: "Booked", href: href({ tab: "upcoming", td: undefined }) },
          { label: "Completed · 30 days", value: completed.length, note: avgRating ? `Avg. rating ${avgRating.toFixed(1)} / 5` : "No ratings yet" },
          { label: "No-show rate · 30 days", value: noShowPct === null ? "—" : `${noShowPct}%`, note: `${recent.length - completed.length} of ${recent.length} finished` },
        ].map((s, i) => {
          const body = (
            <>
              <p className="text-[12px] text-muted">{s.label}</p>
              <p className={cn("mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.03em] num", s.red && "text-red")}>{s.value}</p>
              <p className="mt-1.5 truncate text-[12px] text-muted">{s.note}</p>
            </>
          );
          const cls = cn("block min-w-0 p-5", i % 2 === 1 && "border-l border-line", i >= 2 && "border-t border-line lg:border-t-0", i > 0 && "lg:border-l", i === 4 && "col-span-2 lg:col-span-1");
          return s.href ? (
            <Link key={s.label} href={s.href} className={cn(cls, "transition-colors hover:bg-mist/50")} scroll={false}>
              {body}
            </Link>
          ) : (
            <div key={s.label} className={cls}>
              {body}
            </div>
          );
        })}
      </section>

      <nav aria-label="Test-drive views" className="no-scrollbar mb-4 flex gap-7 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={hrefWith("/dealer/test-drives", { q, assigned }, { tab: t.key })}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("relative shrink-0 pb-3.5 text-[14px] font-medium transition-colors duration-300", tab === t.key ? "text-ink" : "text-muted hover:text-ink")}
          >
            {t.label}
            {t.count ? <span className={cn("ml-1.5 text-[12px] num", tab === t.key ? "text-red" : "opacity-70")}>{t.count}</span> : null}
            {tab === t.key && <span aria-hidden className="absolute inset-x-0 -bottom-px h-[2px] bg-red" />}
          </Link>
        ))}
      </nav>

      <form method="get" className="mb-4 flex flex-col gap-2 border border-line bg-white p-3 md:flex-row md:flex-wrap md:items-center">
        <input type="hidden" name="tab" value={tab} />
        {tab === "calendar" && cal === "month" && <input type="hidden" name="cal" value="month" />}
        {tab === "calendar" && dParam && <input type="hidden" name="d" value={dParam} />}
        <input type="search" name="q" defaultValue={q} placeholder="Customer, mobile, reference or car" aria-label="Search test drives" className={cn(filterInput, "w-full md:w-72")} />
        {tab === "all" && (
          <select name="status" defaultValue={status ?? ""} aria-label="Status" className={cn(filterInput, "cursor-pointer")}>
            <option value="">All statuses</option>
            {TEST_DRIVE_STATUS.map((s) => (
              <option key={s} value={s}>
                {TEST_DRIVE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        )}
        {viewAll && (
          <select name="assigned" defaultValue={assigned ?? ""} aria-label="Sales executive" className={cn(filterInput, "cursor-pointer")}>
            <option value="">All executives</option>
            <option value="me">Mine</option>
            <option value="none">Not assigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-2 md:ml-auto">
          {(q || assigned || status) && (
            <Link href={hrefWith("/dealer/test-drives", {}, { tab })} className="inline-flex h-10 items-center px-3 text-[13px] font-medium text-muted hover:text-ink">
              Reset
            </Link>
          )}
          <button type="submit" className="inline-flex h-10 flex-1 items-center justify-center rounded-[3px] bg-ink px-5 text-[13px] font-medium text-white transition-colors hover:bg-ink-3 md:flex-none">
            Apply
          </button>
        </div>
      </form>

      {tab === "requests" && <RequestQueue items={items} options={options} />}
      {tab === "calendar" && <CalendarView view={cal} anchor={anchor} today={today} items={items} href={href} />}
      {(tab === "upcoming" || tab === "all") && <DriveList items={items} href={href} empty={tab === "upcoming" ? "No upcoming test drives. Accept a request or book one for a walk-in." : "No test drives match these filters."} />}
      {tab === "all" && total > PAGE_SIZE && <Pagination base="/dealer/test-drives" params={params} page={page} pageSize={PAGE_SIZE} total={total} />}

      <TestDriveDrawer drive={selected ?? null} options={options} />
    </>
  );
}

function DriveList({ items, href, empty }: { items: TestDriveItem[]; href: (p: Record<string, string | undefined>) => string; empty: string }) {
  if (!items.length) return <div className="border border-line bg-white px-6 py-14 text-center text-[14px] text-muted">{empty}</div>;
  return (
    <>
      <ul className="space-y-2 md:hidden">
        {items.map((t) => (
          <li key={t.id}>
            <Link href={href({ td: String(t.id) })} scroll={false} className="block border border-line bg-white p-4 transition-colors hover:border-ink/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-semibold">{t.customerName}</p>
                  <p className="mt-0.5 truncate text-[12.5px] text-ink/75">{t.carLabel}</p>
                </div>
                <TestDriveBadge status={t.status} />
              </div>
              <p className="mt-3 flex flex-wrap justify-between gap-2 text-[12px] text-muted num">
                <span>{t.scheduledAt ? formatWhen(t.scheduledAt, { weekday: true }) : t.requestedFor ? `Asked ${formatWhen(t.requestedFor)}` : "Time to confirm"}</span>
                <span>{t.assigned?.name ?? "Not assigned"}</span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto border border-line bg-white md:block">
        <table className="w-full min-w-[880px] border-collapse text-left text-[13.5px]">
          <thead>
            <tr className="bg-mist/60 text-[12px] text-muted">
              {["Customer", "Car", "When (IST)", "Executive", "Showroom", "Status"].map((h) => (
                <th key={h} className="border-b border-line px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className="group transition-colors duration-300 hover:bg-mist/50">
                <td className="border-b border-line px-4 py-3.5">
                  <Link href={href({ td: String(t.id) })} scroll={false} className="flex items-center gap-3">
                    <Initials name={t.customerName} className="size-8 text-[11px]" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold group-hover:underline group-hover:underline-offset-4">{t.customerName}</span>
                      <span className="block text-[12px] text-muted num">
                        {t.reference} · {t.mobile}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="max-w-[260px] border-b border-line px-4 py-3.5">
                  <p className="truncate">{t.carLabel}</p>
                  {t.lead && <p className="mt-0.5 font-mono text-[11.5px] text-muted">{t.lead.reference}</p>}
                </td>
                <td className="whitespace-nowrap border-b border-line px-4 py-3.5 num">
                  {t.scheduledAt ? formatWhen(t.scheduledAt, { weekday: true }) : <span className="text-muted">{t.requestedFor ? `Asked ${formatWhen(t.requestedFor)}` : "To confirm"}</span>}
                </td>
                <td className="border-b border-line px-4 py-3.5">{t.assigned?.name ?? <span className="text-muted">Not assigned</span>}</td>
                <td className="border-b border-line px-4 py-3.5 text-muted">{t.showroom?.name ?? "—"}</td>
                <td className="border-b border-line px-4 py-3.5">
                  <TestDriveBadge status={t.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
