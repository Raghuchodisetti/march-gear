import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { countCustomerNotifications, countUnreadCustomerNotifications, getCustomerNotifications } from "@/server/customer/notifications";
import { Pagination, PortalHeader, formatDateTime, formatDay, pageParam } from "@/components/portal/ui";
import { CustomerNotificationList, MarkAllRead, type CustomerNotificationView } from "@/components/customer/notifications/notification-list";
import type { CustomerNotification } from "@/server/customer/notifications";

export const metadata: Metadata = { title: "Notifications" };

const PAGE = 20;
const BASE = "/account/notifications";

/** "Just now", "12 min ago", "3 h ago", "Yesterday", "4 days ago", else the date. */
function ago(iso: string, now: number) {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDay(iso);
}

const toViews = (items: CustomerNotification[], now = Date.now()): CustomerNotificationView[] =>
  items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, href: n.href, ago: ago(n.createdAt, now), at: formatDateTime(n.createdAt), unread: !n.read }));

export default async function NotificationsPage({ searchParams }: PageProps<"/account/notifications">) {
  const user = await requireUser(BASE);
  const sp = await searchParams;
  const view = sp.view === "unread" ? "unread" : "all";
  const unreadOnly = view === "unread";
  const [total, unread] = await Promise.all([countCustomerNotifications(user.id, { unreadOnly }), countUnreadCustomerNotifications(user.id)]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const page = Math.min(pageParam(sp.page), pages);
  const items = await getCustomerNotifications(user.id, { limit: PAGE, offset: (page - 1) * PAGE, unreadOnly });
  const params = { view: unreadOnly ? "unread" : undefined };

  return (
    <>
      <PortalHeader
        title="Notifications"
        description={unread ? `${unread} unread · updates on your enquiries, test drives, insurance quotes and reviews.` : "Updates on your enquiries, test drives, insurance quotes and reviews."}
        actions={<MarkAllRead count={unread} />}
      />

      <nav aria-label="Show" className="mb-5 inline-flex rounded-[3px] bg-white p-1 ring-1 ring-line">
        {(["all", "unread"] as const).map((v) => (
          <Link
            key={v}
            href={v === "unread" ? `${BASE}?view=unread` : BASE}
            aria-current={view === v ? "page" : undefined}
            className={cn("inline-flex h-8 items-center whitespace-nowrap rounded-[2px] px-3.5 text-[13px] font-medium transition-colors", view === v ? "bg-ink text-white" : "text-muted hover:text-ink")}
          >
            {v === "all" ? "All" : `Unread${unread ? ` · ${unread}` : ""}`}
          </Link>
        ))}
      </nav>

      {items.length ? (
        <CustomerNotificationList items={toViews(items)} />
      ) : (
        <div className="flex flex-col items-center border border-dashed border-ink/15 bg-white px-6 py-16 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
            {unreadOnly ? <CheckCheck aria-hidden className="size-5 text-ink/60" /> : <Bell aria-hidden className="size-5 text-ink/60" />}
          </span>
          <p className="mt-4 text-[16px] font-semibold">{unreadOnly ? "You're all caught up" : "No notifications yet"}</p>
          <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-muted">
            {unreadOnly ? "Nothing new since you last looked." : "When a dealer replies, a test drive is confirmed or an insurer sends a quote, you'll see it here."}
          </p>
          {unreadOnly && (
            <Link href={BASE} className="mt-4 text-[13px] font-medium text-ink underline-offset-4 hover:underline">
              Show all notifications
            </Link>
          )}
        </div>
      )}
      {total > PAGE && <Pagination base={BASE} params={params} page={page} pageSize={PAGE} total={total} />}

      <p className="mt-6 max-w-2xl text-[12px] leading-relaxed text-muted">Notifications live here in your account. MarchGear doesn&apos;t send them by SMS or email yet.</p>
    </>
  );
}
