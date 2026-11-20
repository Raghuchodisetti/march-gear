import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { Settings2 } from "lucide-react";
import { getDb } from "@/db";
import { partnerNotifications, users } from "@/db/schema";
import { cn } from "@/lib/utils";
import { requirePartner } from "@/server/partner/context";
import { Pagination, PortalHeader, formatDateTime, pageParam } from "@/components/portal/ui";
import { ALL_CATEGORIES, CATEGORY_LABEL, DEFAULT_DEALER_PREFS, categoryOf, notificationVisible, type DealerNotificationPrefs, type NotificationCategory } from "@/components/portal/notifications/categories";
import { NotificationList, type NotificationView } from "@/components/portal/notifications/notification-list";

export const metadata: Metadata = { title: "Notifications" };

const PAGE = 30;

export default async function NotificationsPage(props: PageProps<"/dealer/notifications">) {
  const ctx = await requirePartner({ approved: false });
  const sp = await props.searchParams;
  const db = getDb();
  const [rows, [me]] = await Promise.all([
    db
      .select()
      .from(partnerNotifications)
      .where(and(eq(partnerNotifications.partnerId, ctx.partner.id), or(isNull(partnerNotifications.userId), eq(partnerNotifications.userId, ctx.user.id))))
      .orderBy(desc(partnerNotifications.createdAt), desc(partnerNotifications.id))
      .limit(1000),
    db.select({ preferences: users.preferences }).from(users).where(eq(users.id, ctx.user.id)),
  ]);
  const prefs: DealerNotificationPrefs = { ...DEFAULT_DEALER_PREFS, ...((me?.preferences as { dealer?: DealerNotificationPrefs } | null)?.dealer ?? {}) };

  const c = typeof sp.c === "string" && (ALL_CATEGORIES as string[]).includes(sp.c) ? (sp.c as NotificationCategory) : null;
  const view = sp.view === "unread" ? "unread" : "all";
  const showMuted = sp.muted === "1";
  const page = pageParam(sp.page);

  const all = rows.filter((n) => notificationVisible(n, ctx.can)).map((n) => ({ ...n, category: categoryOf(n.kind) }));
  const isMuted = (cat: NotificationCategory) => prefs.muted.includes(cat);
  const counts = new Map<NotificationCategory, { total: number; unread: number }>();
  for (const n of all) {
    const e = counts.get(n.category) ?? { total: 0, unread: 0 };
    e.total++;
    if (!n.readAt) e.unread++;
    counts.set(n.category, e);
  }
  const listed = all.filter((n) => (c ? n.category === c : showMuted || !isMuted(n.category)));
  const mutedHidden = c ? 0 : all.filter((n) => isMuted(n.category)).length;
  const toView = (n: (typeof all)[number]): NotificationView => ({
    id: n.id,
    title: n.title,
    body: n.body,
    href: n.href,
    category: n.category,
    when: formatDateTime(n.createdAt),
    unread: !n.readAt,
    personal: n.userId !== null,
  });
  // Unread ones sit above the paginated "Earlier" list — only on its first page.
  const unread = page > 1 ? [] : listed.filter((n) => !n.readAt).map(toView);
  const readAll = view === "unread" ? [] : listed.filter((n) => n.readAt);
  const earlier = readAll.slice((page - 1) * PAGE, page * PAGE).map(toView);
  const totalUnread = all.filter((n) => !n.readAt).length;

  const base = "/dealer/notifications";
  const params = { c: c ?? undefined, view: view === "unread" ? "unread" : undefined, muted: showMuted ? "1" : undefined };
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...patch, page: undefined })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  const chip = (active: boolean) =>
    cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors duration-300", active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/75 hover:border-ink/40");
  const present = ALL_CATEGORIES.filter((k) => counts.has(k));

  return (
    <>
      <PortalHeader
        title="Notifications"
        description={totalUnread ? `${totalUnread} unread. Updates from MarchGear and activity at your dealership.` : "Updates from MarchGear and activity at your dealership."}
        actions={
          <Link href="/dealer/settings?tab=notifications" className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-ink/15 px-3.5 text-[13px] font-medium transition-colors hover:border-ink">
            <Settings2 aria-hidden className="size-4" /> Preferences
          </Link>
        }
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Show" className="inline-flex shrink-0 self-start rounded-[3px] bg-white p-1 ring-1 ring-line lg:self-center">
          {(["all", "unread"] as const).map((v) => (
            <Link key={v} href={href({ view: v === "unread" ? "unread" : undefined })} aria-current={view === v ? "page" : undefined} className={cn("inline-flex h-7 items-center whitespace-nowrap rounded-[2px] px-3 text-[12.5px] font-medium transition-colors", view === v ? "bg-ink text-white" : "text-muted hover:text-ink")}>
              {v === "all" ? "All" : `Unread${totalUnread ? ` · ${totalUnread}` : ""}`}
            </Link>
          ))}
        </nav>
        {present.length > 0 && (
          <nav aria-label="Categories" className="no-scrollbar -mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:justify-end lg:px-0">
            <Link href={href({ c: undefined })} className={chip(!c)}>
              Everything
            </Link>
            {present.map((k) => (
              <Link key={k} href={href({ c: k })} className={chip(c === k)}>
                {CATEGORY_LABEL[k]}
                {counts.get(k)!.unread > 0 && <span className={cn("num", c === k ? "text-white/70" : "text-red")}>{counts.get(k)!.unread}</span>}
                {isMuted(k) && <span className={cn("text-[11px]", c === k ? "text-white/60" : "text-muted")}>muted</span>}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {mutedHidden > 0 && (
        <p className="mb-4 border border-line bg-white px-4 py-3 text-[13px] text-muted">
          {showMuted ? "Showing muted categories too. " : `${mutedHidden} notification${mutedHidden === 1 ? " is" : "s are"} in categories you muted. `}
          <Link href={href({ muted: showMuted ? undefined : "1" })} className="font-medium text-ink underline-offset-4 hover:underline">
            {showMuted ? "Hide them" : "Show them"}
          </Link>
        </p>
      )}

      <NotificationList unread={unread} earlier={earlier} category={c} unreadCount={totalUnread} />
      {readAll.length > PAGE && <Pagination base={base} params={params} page={page} pageSize={PAGE} total={readAll.length} />}
      <p className="mt-6 text-[12px] text-muted">Notifications for the whole dealership share one read state — marking one as read marks it for your team too. Ones marked “Just for you” are personal.</p>
    </>
  );
}
