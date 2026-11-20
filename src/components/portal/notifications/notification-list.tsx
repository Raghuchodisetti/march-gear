"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Bell, CalendarClock, CarFront, CheckCheck, CircleDot, Circle, Inbox, LifeBuoy, Receipt, Sparkles, Star, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { markAllNotificationsReadAction, setNotificationReadAction } from "@/server/actions/partner-notifications";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/portal/profile/kit";
import type { NotificationCategory } from "./categories";

export interface NotificationView {
  id: number;
  title: string;
  body: string | null;
  href: string | null;
  category: NotificationCategory;
  when: string;
  unread: boolean;
  personal: boolean;
}

const ICON: Record<NotificationCategory, LucideIcon> = {
  enquiries: Inbox,
  test_drives: CalendarClock,
  inventory: CarFront,
  offers: Sparkles,
  account: BadgeCheck,
  billing: Receipt,
  support: LifeBuoy,
  reviews: Star,
  other: Bell,
};

/** Only follow links inside the portal or the public site (never an external URL from a notification). */
const safeHref = (h: string | null) => (h && h.startsWith("/") && !h.startsWith("//") ? h : null);

export function NotificationList({ unread, earlier, category, unreadCount }: { unread: NotificationView[]; earlier: NotificationView[]; category: NotificationCategory | null; unreadCount: number }) {
  const router = useRouter();
  const { busy, run } = useAction();
  const [pending, setPending] = useState<number | null>(null);

  const toggle = async (n: NotificationView) => {
    setPending(n.id);
    const res = await run(() => setNotificationReadAction({ id: n.id, read: n.unread }));
    setPending(null);
    if (res) router.refresh();
  };
  const open = async (n: NotificationView) => {
    const href = safeHref(n.href);
    if (n.unread) await setNotificationReadAction({ id: n.id, read: true }).catch(() => null);
    if (href) router.push(href);
    else router.refresh();
  };
  const markAll = async () => {
    const res = await run(() => markAllNotificationsReadAction({ category }));
    if (res) router.refresh();
  };

  const row = (n: NotificationView) => {
    const Icon = ICON[n.category];
    const href = safeHref(n.href);
    return (
      <li key={n.id} className={cn("group relative flex gap-4 px-5 py-4 transition-colors duration-300 md:px-6", n.unread ? "bg-white" : "bg-white/60")}>
        {n.unread && <span aria-hidden className="absolute inset-y-3 left-0 w-[2px] bg-red" />}
        <span className={cn("mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full", n.unread ? "bg-ink text-white" : "bg-mist text-ink/60")}>
          <Icon aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => open(n)} className={cn("block text-left text-[14px] leading-snug transition-colors hover:text-red", n.unread ? "font-semibold text-ink" : "font-medium text-ink/80")}>
            {n.title}
          </button>
          {n.body && <p className="mt-1 text-[13px] leading-relaxed text-muted">{n.body}</p>}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted">
            <span>{n.when}</span>
            {n.personal && <span>· Just for you</span>}
            {href && (
              <button type="button" onClick={() => open(n)} className="font-medium text-ink/70 hover:text-ink">
                · Open
              </button>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggle(n)}
          disabled={busy && pending === n.id}
          aria-label={n.unread ? `Mark “${n.title}” as read` : `Mark “${n.title}” as unread`}
          title={n.unread ? "Mark as read" : "Mark as unread"}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-mist hover:text-ink disabled:opacity-40"
        >
          {n.unread ? <CircleDot aria-hidden className="size-4 text-red" /> : <Circle aria-hidden className="size-4" />}
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      {unread.length > 0 && (
        <section className="border border-line bg-white">
          <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 md:px-6">
            <h2 className="text-[14px] font-semibold">
              Unread <span className="ml-1 text-red num">{unread.length}</span>
            </h2>
            <Button size="sm" variant="ghost" onClick={markAll} disabled={busy} icon={<CheckCheck className="size-4" aria-hidden />}>
              Mark {category ? "these" : "all"} as read
            </Button>
          </header>
          <ul className="divide-y divide-line">{unread.map(row)}</ul>
        </section>
      )}
      {unread.length === 0 && unreadCount === 0 && earlier.length > 0 && (
        <p className="flex items-center gap-2 text-[13px] text-muted">
          <CheckCheck aria-hidden className="size-4" /> You&apos;re all caught up.
        </p>
      )}
      {earlier.length > 0 && (
        <section className="border border-line bg-white">
          <header className="border-b border-line px-5 py-3.5 md:px-6">
            <h2 className="text-[14px] font-semibold">Earlier</h2>
          </header>
          <ul className="divide-y divide-line">{earlier.map(row)}</ul>
        </section>
      )}
      {unread.length === 0 && earlier.length === 0 && (
        <div className="flex flex-col items-center border border-dashed border-ink/15 bg-white px-6 py-16 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
            <Bell aria-hidden className="size-5 text-ink/60" />
          </span>
          <p className="mt-4 text-[15px] font-semibold">{category ? "Nothing here" : "No notifications yet"}</p>
          <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">Approval decisions, new enquiries, test-drive requests and billing updates will appear here.</p>
        </div>
      )}
    </div>
  );
}
