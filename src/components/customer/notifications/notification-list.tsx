"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CalendarClock, CheckCheck, Circle, CircleDot, Inbox, Loader2, ShieldCheck, Star, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { markAllCustomerNotificationsReadAction, setCustomerNotificationReadAction } from "@/server/actions/customer-notifications";
import { Button } from "@/components/ui/button";
import { useRun } from "@/components/portal/crm/use-run";

/* The customer's notification list: open (marks read and follows the link), toggle read, mark all read. */

export interface CustomerNotificationView {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  /** "3 h ago" — worked out on the server so it never differs after hydration. */
  ago: string;
  /** Full IST date and time, for the tooltip. */
  at: string;
  unread: boolean;
}

const ICON: Record<string, LucideIcon> = {
  enquiry: Inbox,
  test_drive: CalendarClock,
  insurance: ShieldCheck,
  review: Star,
  account: UserRound,
  reminder: BellRing,
};
const KIND_LABEL: Record<string, string> = { enquiry: "Enquiry", test_drive: "Test drive", insurance: "Insurance", review: "Review", account: "Account", reminder: "Reminder" };

export function MarkAllRead({ count }: { count: number }) {
  const router = useRouter();
  const { run, busy } = useRun();
  if (!count) return null;
  const markAll = async () => {
    if (await run("all", () => markAllCustomerNotificationsReadAction(), "All caught up")) router.refresh();
  };
  return (
    <Button variant="outline" size="sm" onClick={markAll} disabled={busy !== null} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCheck className="size-4" aria-hidden />}>
      Mark all as read
    </Button>
  );
}

export function CustomerNotificationList({ items }: { items: CustomerNotificationView[] }) {
  const router = useRouter();
  const { run } = useRun();
  const [pending, setPending] = useState<number | null>(null);

  const toggle = async (n: CustomerNotificationView) => {
    setPending(n.id);
    const res = await run("toggle", () => setCustomerNotificationReadAction({ id: n.id, read: n.unread }));
    setPending(null);
    if (res) router.refresh();
  };
  const open = async (n: CustomerNotificationView) => {
    setPending(n.id);
    if (n.unread) await setCustomerNotificationReadAction({ id: n.id, read: true }).catch(() => null);
    setPending(null);
    if (n.href) router.push(n.href);
    else router.refresh();
  };

  return (
    <ul className="divide-y divide-line border border-line bg-white">
      {items.map((n) => {
        const Icon = ICON[n.kind] ?? Bell;
        return (
          <li key={n.id} className={cn("relative flex gap-4 px-5 py-4 transition-colors duration-300 md:px-6", n.unread ? "bg-white" : "bg-white/60")}>
            {n.unread && <span aria-hidden className="absolute inset-y-3 left-0 w-[2px] bg-red" />}
            <span className={cn("mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full", n.unread ? "bg-ink text-white" : "bg-mist text-ink/60")}>
              <Icon aria-hidden className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => open(n)}
                disabled={pending === n.id}
                className={cn("block text-left text-[14px] leading-snug transition-colors hover:text-red disabled:opacity-60", n.unread ? "font-semibold text-ink" : "font-medium text-ink/80")}
              >
                {n.title}
              </button>
              {n.body && <p className="mt-1 break-words text-[13px] leading-relaxed text-muted">{n.body}</p>}
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted">
                <span>{KIND_LABEL[n.kind] ?? "Update"}</span>
                <span aria-hidden>·</span>
                <time title={n.at} className="num">
                  {n.ago}
                </time>
                {n.href && (
                  <>
                    <span aria-hidden>·</span>
                    <button type="button" onClick={() => open(n)} className="font-medium text-ink/70 hover:text-ink">
                      Open
                    </button>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggle(n)}
              disabled={pending === n.id}
              aria-label={n.unread ? `Mark “${n.title}” as read` : `Mark “${n.title}” as unread`}
              title={n.unread ? "Mark as read" : "Mark as unread"}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-mist hover:text-ink disabled:opacity-40"
            >
              {pending === n.id ? <Loader2 aria-hidden className="size-4 animate-spin" /> : n.unread ? <CircleDot aria-hidden className="size-4 text-red" /> : <Circle aria-hidden className="size-4" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
