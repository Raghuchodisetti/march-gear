"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarRange,
  ChevronDown,
  CircleDollarSign,
  FileSignature,
  Landmark,
  LayoutTemplate,
  LifeBuoy,
  PackagePlus,
  Presentation,
  ReceiptText,
  RefreshCw,
  Settings2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Undo2,
  Wallet,
  CarFront,
  CalendarClock,
  BadgePercent,
  ClipboardCheck,
  ExternalLink,
  Handshake,
  Megaphone,
  ScrollText,
  Store,
  FileText,
  History,
  Images,
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
import { adminSignOutAction } from "@/server/actions/auth";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  adminOnly?: boolean;
}

/** Items waiting in the insurance and advertising approval workflows. */
export interface InsuranceQueue {
  vendors: number;
  products: number;
  coverage: number;
  addOns: number;
  campaigns: number;
  payments: number;
  tickets: number;
  ads: number;
}

export function AdminShell({
  user,
  newLeads,
  pendingReviews,
  partnerQueue,
  insuranceQueue,
  children,
}: {
  user: { name: string; email: string; role: UserRole };
  newLeads: number;
  pendingReviews: number;
  /** Items waiting in the three dealer approval workflows. */
  partnerQueue: { dealers: number; vehicles: number; offers: number };
  insuranceQueue: InsuranceQueue;
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

  // On shorter screens the nav list scrolls; keep the current page's link in view (desktop sidebar and the opened drawer).
  useEffect(() => {
    document.querySelectorAll('nav[aria-label="Admin"] [aria-current="page"]').forEach((el) => el.scrollIntoView({ block: "nearest" }));
  }, [pathname, open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    if (open) window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = insuranceQueue;
  const groups: { title?: string; collapsible?: boolean; items: NavItem[] }[] = [
    {
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { href: "/admin/leads", label: "Leads", icon: Inbox, badge: newLeads },
      ],
    },
    {
      title: "Dealer partners",
      items: [
        { href: "/admin/dashboard", label: "Partner dashboard", icon: Handshake },
        { href: "/admin/dealers", label: "Dealers", icon: Store, badge: partnerQueue.dealers },
        { href: "/admin/vehicle-approvals", label: "Vehicle approvals", icon: ClipboardCheck, badge: partnerQueue.vehicles },
        { href: "/admin/offer-approvals", label: "Offer approvals", icon: BadgePercent, badge: partnerQueue.offers },
        { href: "/admin/campaign-management", label: "Campaigns", icon: Megaphone },
        { href: "/admin/approval-history", label: "Approval history", icon: ScrollText },
        { href: "/admin/partner-support", label: "Dealer support", icon: Inbox },
        { href: "/admin/partner-billing", label: "Dealer billing", icon: FileText },
      ],
    },
    {
      title: "Insurance",
      collapsible: true,
      items: [
        { href: "/admin/insurance/dashboard", label: "Insurance dashboard", icon: Shield },
        { href: "/admin/insurance/vendors", label: "Vendors", icon: Landmark },
        { href: "/admin/insurance/vendor-approvals", label: "Vendor verification", icon: ClipboardCheck, badge: q.vendors },
        { href: "/admin/insurance/companies", label: "Insurance companies", icon: Building2 },
        { href: "/admin/insurance/products", label: "Products", icon: ShieldCheck },
        { href: "/admin/insurance/product-approvals", label: "Product approvals", icon: ClipboardCheck, badge: q.products },
        { href: "/admin/insurance/coverage", label: "Coverage", icon: Shield, badge: q.coverage },
        { href: "/admin/insurance/add-ons", label: "Add-ons", icon: PackagePlus, badge: q.addOns },
        { href: "/admin/insurance/pricing", label: "Pricing configuration", icon: SlidersHorizontal },
        { href: "/admin/insurance/enquiries", label: "Enquiries", icon: Inbox },
        { href: "/admin/insurance/quotes", label: "Quote monitoring", icon: FileSignature },
        { href: "/admin/insurance/renewals", label: "Renewals", icon: RefreshCw },
        { href: "/admin/insurance/campaigns", label: "Campaigns", icon: Megaphone, badge: q.campaigns },
        { href: "/admin/insurance/revenue", label: "Revenue & billing", icon: CircleDollarSign },
        { href: "/admin/insurance/payments", label: "Payments", icon: Wallet, badge: q.payments },
        { href: "/admin/insurance/invoices", label: "Invoices", icon: ReceiptText },
        { href: "/admin/insurance/refunds", label: "Refunds", icon: Undo2 },
        { href: "/admin/insurance/reports", label: "Analytics & reports", icon: BarChart3 },
        { href: "/admin/insurance/audit", label: "Audit log", icon: ScrollText },
        { href: "/admin/insurance/support", label: "Vendor support", icon: LifeBuoy, badge: q.tickets },
        { href: "/admin/insurance/settings", label: "Settings", icon: Settings2 },
      ],
    },
    {
      title: "Advertising",
      collapsible: true,
      items: [
        { href: "/admin/advertising", label: "Ad campaigns", icon: Presentation, badge: q.ads },
        { href: "/admin/advertising/schedule", label: "Schedule", icon: CalendarRange },
        { href: "/admin/advertising/placements", label: "Placements & pricing", icon: LayoutTemplate },
      ],
    },
    {
      title: "Catalogue",
      items: [
        { href: "/admin/brands", label: "Brands", icon: Tags },
        { href: "/admin/cars", label: "New cars", icon: CarFront },
        { href: "/admin/upcoming", label: "Upcoming", icon: CalendarClock },
        { href: "/admin/used-cars", label: "Used cars", icon: Gauge },
        { href: "/admin/showrooms", label: "Showroom listings", icon: Building2 },
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
    {
      title: "Site",
      items: [
        { href: "/admin/content", label: "Site content", icon: FileText },
        { href: "/admin/media", label: "Media library", icon: Images },
        { href: "/admin/activity", label: "Activity log", icon: History },
      ],
    },
  ];

  // Longest matching link wins, so /admin/advertising/placements doesn't also highlight /admin/advertising.
  const hrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  const best = hrefs.filter((h) => (h === "/admin" ? pathname === "/admin" : pathname === h || pathname.startsWith(`${h}/`))).sort((a, b) => b.length - a.length)[0];
  const active = (href: string) => href === best;

  // Long groups fold away; the one holding the current page is always open.
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const isOpen = (g: { title?: string; collapsible?: boolean; items: NavItem[] }) =>
    !g.collapsible || g.items.some((i) => active(i.href)) || folded[g.title ?? ""] === false;

  const signOut = async () => {
    await adminSignOutAction();
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
            {g.title &&
              (g.collapsible ? (
                <button
                  type="button"
                  onClick={() => setFolded((f) => ({ ...f, [g.title!]: isOpen(g) }))}
                  aria-expanded={isOpen(g)}
                  className="mb-2 flex w-full items-center justify-between px-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/35 hover:text-white/60"
                >
                  <span className="flex items-center gap-2">
                    {g.title}
                    {!isOpen(g) && g.items.some((i) => i.badge) ? <span aria-hidden className="size-1.5 rounded-full bg-red" /> : null}
                  </span>
                  <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", isOpen(g) ? "rotate-180" : "")} />
                </button>
              ) : (
                <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/35">{g.title}</p>
              ))}
            <ul className={cn("space-y-0.5", !isOpen(g) && "hidden")}>
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
