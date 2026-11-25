"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarClock,
  CarFront,
  GitCompareArrows,
  Heart,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UserRound,
  FileLock2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/account/avatar";
import { useUI, useUser } from "@/components/providers/app-provider";

/* ──────────────────────────────────────────────────────────────
   The customer portal's chrome (/account/*): a sticky sidebar on
   desktop, a scrolling section bar on phones. Lives inside the
   normal site header and footer. Every page re-checks the session
   on the server (requireUser) — this only draws the navigation.
   ────────────────────────────────────────────────────────────── */

export type AccountNavKey =
  | "overview"
  | "garage"
  | "saved"
  | "comparisons"
  | "enquiries"
  | "testDrives"
  | "insurance"
  | "reviews"
  | "notifications"
  | "profile"
  | "security"
  | "preferences"
  | "privacy";

const NAV: { title?: string; items: { key: AccountNavKey; href: string; label: string; icon: LucideIcon }[] }[] = [
  { items: [{ key: "overview", href: "/account", label: "Overview", icon: LayoutDashboard }] },
  {
    title: "My cars",
    items: [
      { key: "garage", href: "/account/garage", label: "My garage", icon: CarFront },
      { key: "saved", href: "/account/saved", label: "Saved cars", icon: Heart },
      { key: "comparisons", href: "/account/comparisons", label: "Comparisons", icon: GitCompareArrows },
    ],
  },
  {
    title: "Requests",
    items: [
      { key: "enquiries", href: "/account/enquiries", label: "Enquiries", icon: Inbox },
      { key: "testDrives", href: "/account/test-drives", label: "Test drives", icon: CalendarClock },
      { key: "insurance", href: "/account/insurance", label: "Insurance", icon: ShieldCheck },
      { key: "reviews", href: "/account/reviews", label: "My reviews", icon: Star },
      { key: "notifications", href: "/account/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    title: "Account",
    items: [
      { key: "profile", href: "/account/profile", label: "Personal details", icon: UserRound },
      { key: "security", href: "/account/security", label: "Password & security", icon: KeyRound },
      { key: "preferences", href: "/account/preferences", label: "Preferences", icon: SlidersHorizontal },
      { key: "privacy", href: "/account/privacy", label: "Privacy & data", icon: FileLock2 },
    ],
  },
];

const ALL = NAV.flatMap((g) => g.items);

export function AccountShell({
  user,
  badges,
  children,
}: {
  user: { name: string; email: string; city: string | null; memberSince: string };
  /** Counts shown next to sections (e.g. unread notifications, open enquiries). */
  badges: Partial<Record<AccountNavKey, number>>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useUser();
  const { toast } = useUI();
  const bar = useRef<HTMLDivElement>(null);

  // Longest matching link wins (/account/garage/12 → My garage, not Overview).
  const active = ALL.filter((i) => (i.href === "/account" ? pathname === "/account" : pathname === i.href || pathname.startsWith(`${i.href}/`))).sort((a, b) => b.href.length - a.href.length)[0]?.key;

  // Keep the current section visible in the phone bar.
  useEffect(() => {
    bar.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  const signOut = async () => {
    await logout();
    toast("You've been signed out");
    router.push("/");
    router.refresh();
  };

  const since = new Date(user.memberSince).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

  return (
    <div className="bg-[#F6F6F6]">
      <div className="container-x grid grid-cols-1 gap-6 py-6 md:py-10 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden lg:block">
          <div className="sticky top-[104px] border border-line bg-white">
            <div className="flex items-center gap-3 border-b border-line p-5">
              <Avatar name={user.name} className="size-11 rounded-[4px] text-[15px]" />
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-semibold">{user.name}</p>
                <p className="truncate text-[12px] text-muted">Member since {since}</p>
              </div>
            </div>
            <nav aria-label="My account" className="space-y-5 px-3 py-4">
              {NAV.map((g, gi) => (
                <div key={gi}>
                  {g.title && <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">{g.title}</p>}
                  <ul className="space-y-0.5">
                    {g.items.map(({ key, href, label, icon: Icon }) => {
                      const on = key === active;
                      const badge = badges[key];
                      return (
                        <li key={key}>
                          <Link
                            href={href}
                            aria-current={on ? "page" : undefined}
                            className={cn(
                              "flex h-9 items-center gap-3 rounded-[3px] px-3 text-[13.5px] transition-colors",
                              on ? "bg-ink font-medium text-white" : "text-ink/75 hover:bg-mist hover:text-ink",
                            )}
                          >
                            <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.8} />
                            <span className="flex-1 truncate">{label}</span>
                            {badge ? (
                              <span className={cn("rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold leading-none num", on ? "bg-white text-ink" : "bg-red text-white")}>{badge > 99 ? "99+" : badge}</span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="border-t border-line p-3">
              <button type="button" onClick={signOut} className="flex h-9 w-full items-center gap-3 rounded-[3px] px-3 text-left text-[13.5px] text-muted hover:bg-mist hover:text-red">
                <LogOut aria-hidden className="size-4" /> Sign out
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          {/* Phones and tablets: who's signed in + a scrolling section bar. */}
          <div className="mb-5 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={user.name} className="size-10 rounded-[4px] text-[14px]" />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold">{user.name}</p>
                  <p className="truncate text-[12px] text-muted">{user.email}</p>
                </div>
              </div>
              <button type="button" onClick={signOut} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[3px] border border-line bg-white px-3 text-[13px] text-muted hover:text-red">
                <LogOut aria-hidden className="size-4" /> Sign out
              </button>
            </div>
            <div ref={bar} className="-mx-5 mt-4 overflow-x-auto px-5 [scrollbar-width:none] md:-mx-0 md:px-0">
              <nav aria-label="My account" className="flex w-max gap-1.5">
                {ALL.map(({ key, href, label, icon: Icon }) => {
                  const on = key === active;
                  const badge = badges[key];
                  return (
                    <Link
                      key={key}
                      href={href}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-[3px] border px-3 text-[13px]",
                        on ? "border-ink bg-ink font-medium text-white" : "border-line bg-white text-ink/75",
                      )}
                    >
                      <Icon aria-hidden className="size-3.5" strokeWidth={1.8} />
                      {label}
                      {badge ? <span className={cn("rounded-full px-1.5 text-[10px] font-semibold leading-[16px] num", on ? "bg-white text-ink" : "bg-red text-white")}>{badge > 99 ? "99+" : badge}</span> : null}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
