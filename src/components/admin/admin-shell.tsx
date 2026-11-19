"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CarFront,
  CalendarClock,
  ExternalLink,
  Gauge,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Newspaper,
  PenLine,
  Star,
  Tags,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/db/enums";
import { signOutAction } from "@/server/actions/auth";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  adminOnly?: boolean;
}

export function AdminShell({
  user,
  newLeads,
  pendingReviews,
  children,
}: {
  user: { name: string; email: string; role: UserRole };
  newLeads: number;
  pendingReviews: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Close the mobile menu on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const groups: { title?: string; items: NavItem[] }[] = [
    {
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { href: "/admin/leads", label: "Leads", icon: Inbox, badge: newLeads },
      ],
    },
    {
      title: "Catalogue",
      items: [
        { href: "/admin/brands", label: "Brands", icon: Tags },
        { href: "/admin/cars", label: "New cars", icon: CarFront },
        { href: "/admin/upcoming", label: "Upcoming", icon: CalendarClock },
        { href: "/admin/used-cars", label: "Used cars", icon: Gauge },
        { href: "/admin/dealers", label: "Dealers", icon: Building2 },
      ],
    },
    {
      title: "Content",
      items: [
        { href: "/admin/news", label: "News & reviews", icon: Newspaper },
        { href: "/admin/authors", label: "Authors", icon: PenLine },
        { href: "/admin/reviews", label: "Owner & dealer reviews", icon: Star, badge: pendingReviews },
      ],
    },
    {
      title: "Audience",
      items: [
        { href: "/admin/users", label: "Customers & staff", icon: Users, adminOnly: true },
        { href: "/admin/subscribers", label: "Subscribers", icon: Mail },
      ],
    },
  ];

  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));

  const signOut = async () => {
    await signOutAction();
    router.replace("/admin/login");
    router.refresh();
  };

  const nav = (
    <nav aria-label="Admin" className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between gap-3 border-b border-white/10 px-5">
        <Link href="/admin" className="font-display text-[19px] tracking-[-0.02em] text-white">
          <span className="font-semibold">March</span>Gear <span className="ml-1 rounded-[3px] bg-red px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.08em]">Admin</span>
        </Link>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex size-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 lg:hidden" aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.title && <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/35">{g.title}</p>}
            <ul className="space-y-0.5">
              {g.items
                .filter((i) => !i.adminOnly || user.role === "admin")
                .map(({ href, label, icon: Icon, badge }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active(href) ? "page" : undefined}
                      className={cn(
                        "flex h-9 items-center gap-3 rounded-[3px] px-3 text-[13.5px] font-medium transition-colors",
                        active(href) ? "bg-white text-ink" : "text-white/70 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Icon aria-hidden className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{label}</span>
                      {badge ? <span className="rounded-full bg-red px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-white num">{badge > 99 ? "99+" : badge}</span> : null}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="space-y-0.5 border-t border-white/10 p-3">
        <Link href="/" target="_blank" className="flex h-9 items-center gap-3 rounded-[3px] px-3 text-[13.5px] text-white/70 hover:bg-white/10 hover:text-white">
          <ExternalLink aria-hidden className="size-4" /> View website
        </Link>
        <Link href="/admin/account" className="flex h-9 items-center gap-3 rounded-[3px] px-3 text-[13.5px] text-white/70 hover:bg-white/10 hover:text-white">
          <UserCog aria-hidden className="size-4" /> My account
        </Link>
        <button type="button" onClick={signOut} className="flex h-9 w-full items-center gap-3 rounded-[3px] px-3 text-left text-[13.5px] text-white/70 hover:bg-white/10 hover:text-white">
          <LogOut aria-hidden className="size-4" /> Sign out
        </button>
        <div className="px-3 pt-2">
          <p className="truncate text-[13px] font-medium text-white">{user.name}</p>
          <p className="truncate text-[12px] text-white/45">
            {user.email} · {user.role}
          </p>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-mist">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-ink lg:block">{nav}</aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="inline-flex size-10 items-center justify-center rounded-full hover:bg-mist" aria-label="Open menu" aria-expanded={open}>
          <Menu className="size-5" />
        </button>
        <Link href="/admin" className="font-display text-[17px] tracking-[-0.02em]">
          <span className="font-semibold">March</span>Gear Admin
        </Link>
        <span className="size-10" aria-hidden />
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-ink">{nav}</aside>
        </div>
      )}

      <main id="main" className="px-4 py-8 md:px-8 md:py-10 lg:ml-64">
        <div className="mx-auto max-w-[1280px]">{children}</div>
      </main>
    </div>
  );
}
