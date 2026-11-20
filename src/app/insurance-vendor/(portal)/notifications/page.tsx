import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { insNotifications } from "@/db/schema";
import { cn } from "@/lib/utils";
import { requireInsurer } from "@/server/insurance/context";
import { insNotificationScope } from "@/server/insurance/records";
import { Pagination, PortalHeader, pageParam } from "@/components/portal/ui";
import { formatIstDateTime, relativeTime } from "@/components/portal/crm/pipeline";
import { InsNotificationList } from "@/components/insurance/vendor/notifications/notification-list";

export const metadata: Metadata = { title: "Notifications" };

const PAGE = 20;
const BASE = "/insurance-vendor/notifications";

export default async function Page({ searchParams }: PageProps<"/insurance-vendor/notifications">) {
  const ctx = await requireInsurer({ approved: false });
  const sp = await searchParams;
  const view = sp.view === "unread" ? "unread" : "all";
  const page = pageParam(sp.page);
  const db = getDb();
  const mine = insNotificationScope(ctx);
  const where = view === "unread" ? and(mine, isNull(insNotifications.readAt)) : mine;
  const [rows, [{ total }], [{ unread }]] = await Promise.all([
    db
      .select()
      .from(insNotifications)
      .where(where)
      .orderBy(desc(insNotifications.createdAt), desc(insNotifications.id))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    db.select({ total: count() }).from(insNotifications).where(where),
    db.select({ unread: count() }).from(insNotifications).where(and(mine, isNull(insNotifications.readAt))),
  ]);
  const now = new Date().getTime();
  const items = rows.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    href: n.href,
    relative: relativeTime(n.createdAt, now),
    absolute: formatIstDateTime(n.createdAt),
    unread: !n.readAt,
    personal: n.userId !== null,
  }));
  const tabs = [
    { key: "all", label: "All", href: BASE },
    { key: "unread", label: `Unread${unread ? ` · ${unread}` : ""}`, href: `${BASE}?view=unread` },
  ];

  return (
    <>
      <PortalHeader title="Notifications" description={unread ? `${unread} unread. Updates from MarchGear and activity at your company.` : "Updates from MarchGear and activity at your company."} />
      <nav aria-label="Show" className="mb-5 inline-flex rounded-[3px] bg-white p-1 ring-1 ring-line">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={view === t.key ? "page" : undefined}
            className={cn("inline-flex h-8 items-center whitespace-nowrap rounded-[2px] px-3.5 text-[13px] font-medium transition-colors", view === t.key ? "bg-ink text-white" : "text-muted hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <InsNotificationList items={items} unreadCount={Number(unread)} view={view} />
      {Number(total) > PAGE && <Pagination base={BASE} params={{ view: view === "unread" ? "unread" : undefined }} page={page} pageSize={PAGE} total={Number(total)} />}
      <p className="mt-6 text-[12px] text-muted">Company-wide notifications share one read state — marking one as read marks it for your team too. Ones marked “Just for you” are personal. Times are in IST.</p>
    </>
  );
}
