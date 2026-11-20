"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  CheckCheck,
  Circle,
  CircleDot,
  FileText,
  Inbox,
  LifeBuoy,
  Loader2,
  Megaphone,
  Presentation,
  Receipt,
  RefreshCw,
  Shield,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { markAllInsNotificationsReadAction, setInsNotificationReadAction } from "@/server/actions/ins-notifications";
import { Button } from "@/components/ui/button";
import { useRun } from "@/components/portal/crm/use-run";
import { safeHref } from "@/components/insurance/vendor/crm/shared";

export interface InsNotificationView {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  relative: string;
  absolute: string;
  unread: boolean;
  personal: boolean;
}

const ICONS: [RegExp, LucideIcon][] = [
  [/^conversion/, ShieldCheck],
  [/^(enquir|lead|assign)/, Inbox],
  [/^quote/, FileText],
  [/^renewal/, RefreshCw],
  [/^(product|cover|addon|coverage)/, Shield],
  [/^campaign/, Megaphone],
  [/^(ad|advert)/, Presentation],
  [/^(invoice|payment|billing|plan|refund|subscription)/, Receipt],
  [/^(ticket|support)/, LifeBuoy],
  [/^(account|vendor|application|approval|document|profile|verification|team|member)/, BadgeCheck],
];
const iconFor = (kind: string) => ICONS.find(([re]) => re.test(kind.toLowerCase()))?.[1] ?? Bell;

export function InsNotificationList({ items, unreadCount, view }: { items: InsNotificationView[]; unreadCount: number; view: "all" | "unread" }) {
  const router = useRouter();
  const { run, busy } = useRun();
  const [pending, setPending] = useState<number | null>(null);

  const toggle = async (n: InsNotificationView) => {
    setPending(n.id);
    await run(`t-${n.id}`, () => setInsNotificationReadAction({ id: n.id, read: n.unread }));
    setPending(null);
  };
  const open = async (n: InsNotificationView) => {
    const href = safeHref(n.href);
    setPending(n.id);
    if (n.unread) await setInsNotificationReadAction({ id: n.id, read: true }).catch(() => null);
    if (href) router.push(href);
    else {
      setPending(null);
      router.refresh();
    }
  };
  const markAll = () => run("all", () => markAllInsNotificationsReadAction(), (r) => (r.count ? `${r.count} notification${r.count === 1 ? "" : "s"} marked as read` : "Nothing to mark"));

  return (
    <section className="border border-line bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5 md:px-6">
        <h2 className="text-[14px] font-semibold">
          {view === "unread" ? "Unread" : "All notifications"}
          {unreadCount > 0 && <span className="ml-2 text-[12.5px] font-medium text-red num">{unreadCount} unread</span>}
        </h2>
        <Button size="sm" variant="ghost" onClick={markAll} disabled={busy !== null || unreadCount === 0} icon={busy === "all" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCheck className="size-4" aria-hidden />}>
          Mark all as read
        </Button>
      </header>
      {items.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
            {view === "unread" ? <CheckCheck aria-hidden className="size-5 text-ink/60" /> : <Bell aria-hidden className="size-5 text-ink/60" />}
          </span>
          <p className="mt-4 text-[15px] font-semibold">{view === "unread" ? "You're all caught up" : "No notifications yet"}</p>
          <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">New enquiries, quote responses, approval decisions, renewals and billing updates appear here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((n) => {
            const Icon = iconFor(n.kind);
            const href = safeHref(n.href);
            return (
              <li key={n.id} className={cn("relative flex gap-4 px-5 py-4 transition-colors duration-300 md:px-6", n.unread ? "bg-white" : "bg-[#fcfcfc]")}>
                {n.unread && <span aria-hidden className="absolute inset-y-3 left-0 w-[2px] bg-red" />}
                <span className={cn("mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full", n.unread ? "bg-ink text-white" : "bg-mist text-ink/60")}>
                  <Icon aria-hidden className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => open(n)} className={cn("block text-left text-[14px] leading-snug transition-colors hover:text-red", n.unread ? "font-semibold text-ink" : "font-medium text-ink/80")}>
                    {n.title}
                    {pending === n.id && busy === null && <Loader2 aria-hidden className="ml-2 inline size-3.5 animate-spin text-muted" />}
                  </button>
                  {n.body && <p className="mt-1 break-words text-[13px] leading-relaxed text-muted">{n.body}</p>}
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted">
                    <time title={n.absolute}>{n.relative}</time>
                    <span aria-hidden>·</span>
                    <span className="num">{n.absolute}</span>
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
                  disabled={busy !== null}
                  aria-label={n.unread ? `Mark “${n.title}” as read` : `Mark “${n.title}” as unread`}
                  title={n.unread ? "Mark as read" : "Mark as unread"}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-mist hover:text-ink disabled:opacity-40"
                >
                  {busy === `t-${n.id}` ? <Loader2 aria-hidden className="size-4 animate-spin" /> : n.unread ? <CircleDot aria-hidden className="size-4 text-red" /> : <Circle aria-hidden className="size-4" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
