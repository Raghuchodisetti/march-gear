import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LEAD_STATUS_LABEL, LEAD_STATUS_TONE, LEAD_TYPE_LABEL } from "@/lib/leads";
import { getDashboard } from "@/server/admin/dashboard";
import { recentActivity } from "@/server/admin/activity";
import { getSessionUser } from "@/server/auth";
import { AdminHeader, Badge, Panel, StatCard, formatDateTime, formatDay } from "@/components/admin/ui";
import { ActivityFeed } from "@/components/admin/activity";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const [{ kpis, days, byType, recent, deliveries }, activity, me, sp] = await Promise.all([getDashboard(), recentActivity(8), getSessionUser(), searchParams]);
  const max = Math.max(1, ...days.map((d) => d.n));
  const typeMax = Math.max(1, ...byType.map((t) => t.n));
  const delta = kpis.leadsWeek - kpis.leadsPrevWeek;
  const firstName = me?.name.split(" ")[0] ?? "there";

  return (
    <>
      <AdminHeader title={`Hello, ${firstName}`} description="Here's what's happening on MarchGear." />
      {sp.denied && (
        <p role="alert" className="mb-6 border-l-2 border-red bg-red-50 px-4 py-3 text-[13.5px] text-red">
          That section is for admins only.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="New leads" value={kpis.newLeads} note="Waiting for a first call" href="/admin/leads?status=new" tone={kpis.newLeads ? "red" : undefined} />
        <StatCard label="Leads today" value={kpis.leadsToday} note="Since midnight IST" href="/admin/leads" />
        <StatCard
          label="Last 7 days"
          value={kpis.leadsWeek}
          note={delta === 0 ? "Same as the week before" : `${delta > 0 ? "+" : ""}${delta} vs the week before`}
        />
        <StatCard label="Pending reviews" value={kpis.pendingReviews} note="Owner reviews to check" href="/admin/reviews?status=pending" tone={kpis.pendingReviews ? "red" : undefined} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Leads, last 14 days" className="xl:col-span-2">
          <div className="flex h-48 items-end gap-1.5" role="img" aria-label={`Leads per day: ${days.map((d) => `${d.label} ${d.n}`).join(", ")}`}>
            {days.map((d) => (
              <div key={d.key} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
                <span className="mb-1 text-center text-[11px] text-muted opacity-0 transition-opacity group-hover:opacity-100 num">{d.n}</span>
                <span className="block w-full rounded-t-[2px] bg-ink transition-colors group-hover:bg-red" style={{ height: `${Math.max(2, (d.n / max) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted">
            <span>{days[0].label}</span>
            <span>Today</span>
          </div>
        </Panel>

        <Panel title="By type, last 30 days">
          {byType.length === 0 ? (
            <p className="text-[13.5px] text-muted">No leads in the last 30 days.</p>
          ) : (
            <ul className="space-y-3">
              {byType.map((t) => (
                <li key={t.type}>
                  <Link href={`/admin/leads?type=${t.type}`} className="group block">
                    <div className="flex justify-between text-[13px]">
                      <span className="group-hover:text-red">{LEAD_TYPE_LABEL[t.type] ?? t.type}</span>
                      <span className="text-muted num">{t.n}</span>
                    </div>
                    <span className="mt-1.5 block h-1.5 rounded-full bg-mist">
                      <span className="block h-full rounded-full bg-red" style={{ width: `${(t.n / typeMax) * 100}%` }} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Latest leads"
          className="xl:col-span-2"
          padded={false}
          action={
            <Link href="/admin/leads" className="inline-flex items-center gap-1 text-[13px] font-medium text-red hover:underline">
              View all <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          }
        >
          {recent.length === 0 ? (
            <p className="p-5 text-[13.5px] text-muted">No leads yet. Submit a form on the website to see one here.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((l) => (
                <li key={l.id}>
                  <Link href={`/admin/leads/${l.id}`} className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-mist/50">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium">
                        {l.name ?? "Unnamed"} <span className="font-normal text-muted">· {LEAD_TYPE_LABEL[l.type] ?? l.type}</span>
                      </span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {l.subject ?? l.reference} · {formatDateTime(l.createdAt)}
                      </span>
                    </span>
                    <Badge tone={LEAD_STATUS_TONE[l.status]}>{LEAD_STATUS_LABEL[l.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Upcoming PDI deliveries" padded={false}>
          {deliveries.length === 0 ? (
            <p className="p-5 text-[13.5px] text-muted">No upcoming deliveries from PDI bookings or checklist requests.</p>
          ) : (
            <ul className="divide-y divide-line">
              {deliveries.map((d) => (
                <li key={d.id}>
                  <Link href={`/admin/leads/${d.id}`} className="block px-5 py-3 transition-colors hover:bg-mist/50">
                    <span className="flex justify-between gap-3 text-[13.5px]">
                      <span className="truncate font-medium">{d.name ?? "Unnamed"}</span>
                      <span className="shrink-0 text-muted">{formatDay(d.delivery)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-muted">
                      {d.type === "pdi_booking" ? "Booking" : "Checklist"} · {d.subject ?? `${d.details?.brand ?? ""} ${d.details?.model ?? ""}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Recent activity"
        className="mt-6"
        padded={false}
        action={
          <Link href="/admin/activity" className="inline-flex items-center gap-1 text-[13px] font-medium text-red hover:underline">
            Full log <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        }
      >
        {activity.length === 0 ? <p className="p-5 text-[13.5px] text-muted">No changes yet. Edits, lead updates and sign-ins will show up here.</p> : <ActivityFeed entries={activity} />}
      </Panel>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Live new cars" value={kpis.liveCars} href="/admin/cars" />
        <StatCard label="Used listings" value={kpis.activeUsed} href="/admin/used-cars" />
        <StatCard label="Published stories" value={kpis.liveArticles} href="/admin/news" />
        <StatCard label="Customers" value={kpis.customers} href={me?.role === "admin" ? "/admin/users" : undefined} />
        <StatCard label="Subscribers" value={kpis.subscribers} href="/admin/subscribers" />
      </div>
    </>
  );
}
