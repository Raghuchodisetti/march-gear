"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BadgeCheck,
  Bell,
  ClipboardCheck,
  FileSignature,
  PackagePlus,
  Presentation,
  RefreshCw,
  Shield,
  ShieldCheck,
  Wallet,
  Building2,
  CalendarClock,
  CarFront,
  ChartColumn,
  ClipboardList,
  CreditCard,
  FileText,
  Images,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  Sparkles,
  Star,
  Store,
  Tags,
  UserCircle2,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dealerSignOutAction } from "@/server/actions/partner-auth";
import { insurerSignOutAction } from "@/server/actions/insurer-auth";

export interface PortalNavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  /** Shown but locked until the dealership is approved. */
  locked?: boolean;
  badge?: number;
}

const ICONS = {
  dashboard: LayoutDashboard,
  status: ClipboardList,
  enquiries: Inbox,
  testDrives: CalendarClock,
  customers: UsersRound,
  inventory: CarFront,
  brands: BadgeCheck,
  models: Tags,
  offers: Sparkles,
  campaigns: Megaphone,
  reviews: Star,
  media: Images,
  profile: Building2,
  showrooms: Store,
  staff: Users,
  analytics: ChartColumn,
  subscriptions: CreditCard,
  invoices: FileText,
  notifications: Bell,
  support: LifeBuoy,
  settings: Settings,
  // Insurance vendor portal
  products: Shield,
  coverage: ShieldCheck,
  addOns: PackagePlus,
  approvals: ClipboardCheck,
  quotes: FileSignature,
  renewals: RefreshCw,
  advertising: Presentation,
  billing: Wallet,
  transactions: ArrowLeftRight,
} satisfies Record<string, LucideIcon>;

/** The dealer partner portal and the insurance vendor portal share this shell. */
const VARIANTS = {
  dealer: { home: "/dealer", login: "/dealer/login", notifications: "/dealer/notifications", badge: "Partner", label: "Dealer partner portal", signOut: dealerSignOutAction },
  insurer: {
    home: "/insurance-vendor",
    login: "/insurance-vendor/login",
    notifications: "/insurance-vendor/notifications",
    badge: "Insurance",
    label: "Insurance vendor portal",
    signOut: insurerSignOutAction,
  },
} as const;

export interface PortalShellProps {
  dealership: { name: string; reference: string; status: string; statusLabel: string; statusTone: "neutral" | "red" | "green" | "amber" | "blue" | "dark"; logo: string };
  user: { name: string; email: string; roleLabel: string };
  groups: { title?: string; items: PortalNavItem[] }[];
  unread: number;
  /** Which portal this is (defaults to the dealer portal). */
  variant?: keyof typeof VARIANTS;
  children: ReactNode;
}

const TONE: Record<PortalShellProps["dealership"]["statusTone"], string> = {
  neutral: "bg-mist text-ink",
  red: "bg-red-50 text-red",
  green: "bg-[#e8f5ec] text-[#1e7a3c]",
  amber: "bg-[#fdf3e1] text-[#9a5b00]",
  blue: "bg-[#e9f0fb] text-[#2456a6]",
  dark: "bg-ink text-white",
};

export function PortalShell({ dealership, user, groups, unread, variant = "dealer", children }: PortalShellProps) {
  const v = VARIANTS[variant];
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const signOut = async () => {
    await v.signOut();
    router.replace(v.login);
    router.refresh();
  };

  const nav = (
    <nav aria-label={v.label} className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-5">
        <Link href={v.home} className="font-display text-[19px] tracking-[-0.02em] text-ink">
          <span className="font-semibold">March</span>Gear{" "}
          <span className="ml-1 rounded-[3px] bg-ink px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.08em] text-white">{v.badge}</span>
        </Link>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-mist lg:hidden" aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>

      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-line bg-white text-[13px] font-semibold">
            {dealership.logo ? (
              // Dealer-uploaded logo from /media — plain <img> keeps the sidebar light.
              // eslint-disable-next-line @next/next/no-img-element
              <img decoding="async" src={dealership.logo} alt="" className="size-full object-contain" />
            ) : (
              dealership.name.slice(0, 2).toUpperCase()
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold">{dealership.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
              <span className={cn("inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-[10.5px] font-semibold", TONE[dealership.statusTone])}>{dealership.statusLabel}</span>
              <span className="truncate num">{dealership.reference}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.title && <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">{g.title}</p>}
            <ul className="space-y-0.5">
              {g.items.map(({ href, label, icon, locked, badge }) => {
                const Icon = ICONS[icon];
                const isActive = active(href);
                if (locked)
                  return (
                    <li key={href}>
                      <span
                        title="Available once your dealership is approved"
                        className="flex h-9 cursor-not-allowed items-center gap-3 rounded-[3px] px-3 text-[13.5px] text-muted/60"
                      >
                        <Icon aria-hidden className="size-4 shrink-0" />
                        <span className="flex-1 truncate">{label}</span>
                        <Lock aria-label="Locked until approval" className="size-3.5" />
                      </span>
                    </li>
                  );
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex h-9 items-center gap-3 rounded-[3px] px-3 text-[13.5px] font-medium transition-colors",
                        isActive ? "bg-mist text-ink" : "text-ink/70 hover:bg-mist/70 hover:text-ink",
                      )}
                    >
                      {isActive && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-red" />}
                      <Icon aria-hidden className={cn("size-4 shrink-0", isActive && "text-red")} />
                      <span className="flex-1 truncate">{label}</span>
                      {badge ? <span className="rounded-full bg-red px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-white num">{badge > 99 ? "99+" : badge}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <UserCircle2 aria-hidden className="size-8 shrink-0 text-muted" strokeWidth={1.5} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{user.name}</p>
            <p className="truncate text-[11.5px] text-muted">{user.roleLabel}</p>
          </div>
        </div>
        <button type="button" onClick={signOut} className="mt-1 flex h-9 w-full items-center gap-3 rounded-[3px] px-3 text-left text-[13.5px] text-ink/70 hover:bg-mist hover:text-ink">
          <LogOut aria-hidden className="size-4" /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-[#F6F6F6]">
      <aside aria-label="Portal menu" className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-line bg-white lg:block">{nav}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside aria-label="Portal menu" className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white shadow-lift">{nav}</aside>
        </div>
      )}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-line bg-white/95 px-4 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setOpen(true)} className="inline-flex size-10 items-center justify-center rounded-full hover:bg-mist lg:hidden" aria-label="Open menu" aria-expanded={open}>
              <Menu className="size-5" />
            </button>
            <p className="truncate text-[13.5px] text-muted">
              <span className="hidden sm:inline">{v.label} · </span>
              <span className="font-medium text-ink">{dealership.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/" target="_blank" className="hidden h-9 items-center rounded-[3px] px-3 text-[13px] text-muted hover:bg-mist hover:text-ink sm:inline-flex">
              View website
            </Link>
            <Link href={v.notifications} className="relative inline-flex size-10 items-center justify-center rounded-full hover:bg-mist" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
              <Bell className="size-[18px]" />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red px-1 text-[10px] font-semibold leading-[18px] text-white num">{unread > 9 ? "9+" : unread}</span>}
            </Link>
          </div>
        </header>
        <main id="main" className="px-4 py-8 md:px-8 md:py-10">
          <div className="mx-auto max-w-[1320px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
