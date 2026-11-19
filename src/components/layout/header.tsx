"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, ChevronDown, Heart, LogOut, MapPin, Menu, Search, User } from "lucide-react";
import { mainNav, type NavItem } from "@/data/navigation";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Logo } from "@/components/ui/logo";
import { useCity, useUI, useUser, useWishlist } from "@/components/providers/app-provider";
import { MobileNav } from "./mobile-nav";

function isActive(pathname: string, item: NavItem) {
  if (item.href === "/") return pathname === "/";
  const roots: Record<string, string[]> = {
    new: ["/new-cars", "/cars", "/brands", "/upcoming-cars"],
    used: ["/used-cars", "/sell-car", "/dealers"],
    compare: ["/compare"],
    reviews: ["/reviews"],
    news: ["/news"],
    ev: ["/electric-cars"],
    pdi: ["/pdi-check"],
    tools: ["/tools"],
  };
  return (roots[item.key] ?? [item.href]).some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

export function Header() {
  const pathname = usePathname();
  const { city, } = useCity();
  const { setSearchOpen, setLocationOpen } = useUI();
  const { count } = useWishlist();
  const [active, setActive] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // top: transparent over the hero · hero: dark glass while the hero is in view · page: white
  const [phase, setPhase] = useState<"top" | "hero" | "page">("page");
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);

  const overHero = pathname === "/";

  useEffect(() => {
    const onScroll = () => {
      if (!overHero) return setPhase("page");
      const y = window.scrollY;
      const hero = document.querySelector<HTMLElement>('section[aria-label="Featured"]');
      const heroEnd = hero ? hero.offsetTop + hero.offsetHeight - 72 : window.innerHeight;
      setPhase(y < 16 ? "top" : y < heroEnd ? "hero" : "page");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overHero]);

  // Global search shortcut: ⌘K / Ctrl+K or "/"
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.closest("input, textarea, select, [contenteditable=true]");
      if ((e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSearchOpen]);

  const open = (key: string | null, delay = 90) => {
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => setActive(key), delay);
  };
  const scheduleClose = () => {
    window.clearTimeout(openTimer.current);
    closeTimer.current = window.setTimeout(() => setActive(null), 160);
  };
  const closeNow = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    setActive(null);
  };

  // Light (white-on-dark) treatment whenever the header sits over the dark hero.
  const transparent = overHero && phase !== "page" && !active;
  const glass = transparent && phase === "hero";
  const activeItem = mainNav.find((n) => n.key === active);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 transition-[background-color,border-color,color] duration-[350ms] ease-[var(--ease-premium)]",
          !transparent
            ? "border-b border-line bg-white/95 text-ink backdrop-blur-md"
            : glass
              ? "border-b border-white/10 bg-ink/85 text-white backdrop-blur-md"
              : "border-b border-transparent bg-transparent text-white",
        )}
        onMouseLeave={scheduleClose}
        onKeyDown={(e) => e.key === "Escape" && closeNow()}
      >
        {transparent && !glass && <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 h-32 bg-gradient-to-b from-ink/50 to-transparent" />}
        <div className="container-x flex h-[72px] items-center gap-4 xl:gap-8 3xl:gap-12">
          <Logo tone={transparent ? "light" : "dark"} className="shrink-0" />

          <nav aria-label="Primary" className="hidden h-full flex-1 items-stretch lg:flex">
            <ul className="flex shrink-0 items-stretch">
              {mainNav.map((item) => {
                const current = isActive(pathname, item);
                const expanded = active === item.key;
                return (
                  <li key={item.key} className="relative flex items-stretch" onMouseEnter={() => (item.mega ? open(item.key) : open(null, 60))}>
                    {item.mega ? (
                      <>
                        {/* The label navigates; hover (or the chevron) opens the mega menu */}
                        <Link
                          href={item.href}
                          onClick={closeNow}
                          aria-current={current ? "page" : undefined}
                          className={cn(navItemClass(transparent, current || expanded), "pr-1 xl:pr-1")}
                        >
                          <NavLabel item={item} />
                          <Underline on={current || expanded} className="right-1 xl:right-1" />
                        </Link>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-haspopup="true"
                          aria-label={`${expanded ? "Close" : "Open"} ${item.label} menu`}
                          onClick={() => (expanded ? closeNow() : open(item.key, 0))}
                          className={cn(
                            "flex items-center pr-[7px] transition-colors duration-[250ms] xl:pr-3.5",
                            transparent ? "text-white/80 hover:text-white" : "text-ink/70 hover:text-ink",
                          )}
                        >
                          <ChevronDown aria-hidden className={cn("size-3.5 shrink-0 opacity-60 transition-transform duration-[350ms]", expanded && "rotate-180 opacity-100")} />
                        </button>
                      </>
                    ) : (
                      <Link href={item.href} onClick={closeNow} aria-current={current ? "page" : undefined} className={navItemClass(transparent, current)}>
                        <NavLabel item={item} />
                        <Underline on={current} />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <HeaderIcon label="Search (Ctrl K)" onClick={() => setSearchOpen(true)}>
              <Search className="size-[19px]" />
            </HeaderIcon>
            <button
              type="button"
              onClick={() => setLocationOpen(true)}
              className="hidden h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors duration-[250ms] hover:bg-current/5 md:flex"
              aria-label={`Location: ${city.name}. Change city`}
            >
              <MapPin className="size-4 text-red" aria-hidden />
              <span className="hidden whitespace-nowrap 3xl:inline">{city.name}</span>
            </button>
            <Link
              href="/wishlist"
              aria-label={`Saved cars${count ? ` (${count})` : ""}`}
              className="relative inline-flex size-10 items-center justify-center rounded-full transition-colors duration-[250ms] hover:bg-current/5"
            >
              <Heart className="size-[19px]" aria-hidden />
              {count > 0 && (
                <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-red px-1 text-[10px] font-semibold leading-4 text-white num">
                  {count}
                </span>
              )}
            </Link>
            <ProfileMenu transparent={transparent} />
            <HeaderIcon label="Open menu" onClick={() => setMobileOpen(true)} className="lg:hidden">
              <Menu className="size-5" />
            </HeaderIcon>
          </div>
        </div>

        <AnimatePresence>
          {activeItem?.mega && (
            <motion.div
              key="mega"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }}
              transition={{ duration: 0.35, ease: EASE }}
              className="absolute inset-x-0 top-full hidden border-b border-line bg-white text-ink shadow-[0_24px_48px_-24px_rgb(17_17_17/0.18)] lg:block"
              onMouseEnter={() => open(activeItem.key, 0)}
            >
              <MegaPanel item={activeItem} onNavigate={closeNow} />
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <AnimatePresence>
        {active && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-40 hidden bg-ink/25 lg:block"
            onMouseEnter={scheduleClose}
            onClick={closeNow}
          />
        )}
      </AnimatePresence>

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}

function navItemClass(transparent: boolean, on: boolean) {
  return cn(
    "group/nav relative flex items-center gap-1 whitespace-nowrap px-[7px] text-[14px] font-medium transition-colors duration-[250ms] xl:px-3.5",
    transparent ? (on ? "text-white" : "text-white/80 hover:text-white") : on ? "text-ink" : "text-ink/70 hover:text-ink",
  );
}

function NavLabel({ item }: { item: NavItem }) {
  if (!item.shortLabel) return <span>{item.label}</span>;
  return (
    <>
      <span className="3xl:hidden">{item.shortLabel}</span>
      <span className="hidden 3xl:inline">{item.label}</span>
    </>
  );
}

function Underline({ on, className }: { on: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-x-[7px] bottom-[18px] h-[2px] origin-left bg-red transition-transform duration-[350ms] ease-[var(--ease-premium)] xl:inset-x-3.5",
        on ? "scale-x-100" : "scale-x-0",
        className,
      )}
    />
  );
}

function HeaderIcon({ children, label, onClick, className }: { children: React.ReactNode; label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn("inline-flex size-10 items-center justify-center rounded-full transition-colors duration-[250ms] hover:bg-current/5", className)}
    >
      {children}
    </button>
  );
}

function MegaPanel({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const mega = item.mega!;
  return (
    <div className="container-x grid grid-cols-12 gap-10 py-10">
      <div className="col-span-8 flex flex-col">
        <div className="grid flex-1 grid-cols-3 gap-10">
          {mega.columns.map((col, ci) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.04 * ci, ease: EASE }}
            >
              <p className="type-eyebrow text-muted">{col.title}</p>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} onClick={onNavigate} className="group/ml flex items-center gap-2 text-[15px] text-ink transition-colors duration-[250ms] hover:text-red">
                      <span>{link.label}</span>
                      {link.note && <span className="rounded-full bg-mist px-2 py-0.5 text-[10.5px] text-muted">{link.note}</span>}
                      <ArrowUpRight aria-hidden className="size-3.5 -translate-x-1 opacity-0 transition-all duration-[250ms] group-hover/ml:translate-x-0 group-hover/ml:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
        {mega.chips && (
          <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-line pt-6">
            <span className="mr-3 type-eyebrow text-muted">Popular brands</span>
            {mega.chips.map((chip) => (
              <Link
                key={chip.href}
                href={chip.href}
                onClick={onNavigate}
                className="rounded-full border border-line px-3.5 py-1.5 text-[13px] transition-colors duration-[250ms] hover:border-ink hover:bg-ink hover:text-white"
              >
                {chip.label}
              </Link>
            ))}
          </div>
        )}
      </div>
      <motion.div
        className="col-span-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
      >
        <Link href={mega.feature.href} onClick={onNavigate} className="group/feat relative block aspect-[16/11] overflow-hidden bg-ink">
          <Image
            src={mega.feature.image}
            alt=""
            fill
            sizes="400px"
            className="object-cover opacity-80 transition-transform duration-[900ms] ease-[var(--ease-premium)] group-hover/feat:scale-[1.05]"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white">
            <p className="type-eyebrow text-white/70">{mega.feature.eyebrow}</p>
            <p className="type-h3 mt-2 text-balance">{mega.feature.title}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium">
              {mega.feature.cta}
              <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover/feat:-translate-y-0.5 group-hover/feat:translate-x-0.5" />
            </span>
          </div>
        </Link>
      </motion.div>
    </div>
  );
}

function ProfileMenu({ transparent }: { transparent: boolean }) {
  const { user, logout } = useUser();
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = user?.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={user ? `Account: ${user.name}` : "Account"}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-10 items-center justify-center rounded-full transition-colors duration-[250ms] hover:bg-current/5"
      >
        {user ? (
          <span className={cn("inline-flex size-8 items-center justify-center rounded-full text-[11px] font-semibold", transparent ? "bg-white text-ink" : "bg-ink text-white")}>
            {initials}
          </span>
        ) : (
          <User className="size-[19px]" aria-hidden />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="absolute right-0 top-[calc(100%+12px)] w-72 border border-line bg-white p-2 text-ink shadow-lift"
          >
            {user ? (
              <>
                <div className="border-b border-line px-3 pb-3 pt-2">
                  <p className="font-medium">{user.name}</p>
                  <p className="truncate text-[13px] text-muted">{user.email}</p>
                </div>
                <MenuLink href="/profile" onClick={() => setOpen(false)}>My profile</MenuLink>
                <MenuLink href="/wishlist" onClick={() => setOpen(false)}>Saved cars</MenuLink>
                <MenuLink href="/compare" onClick={() => setOpen(false)}>My comparisons</MenuLink>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    logout();
                    setOpen(false);
                    toast("You've been signed out");
                  }}
                  className="mt-1 flex w-full items-center gap-2 border-t border-line px-3 pb-2 pt-3 text-left text-[14px] text-muted transition-colors hover:text-red"
                >
                  <LogOut className="size-4" aria-hidden /> Sign out
                </button>
              </>
            ) : (
              <div className="p-3">
                <p className="type-h4">Welcome to March Gear</p>
                <p className="mt-1 text-[13px] text-muted">Sign in to sync saved cars, comparisons and test-drive bookings.</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link href="/login" onClick={() => setOpen(false)} className="inline-flex h-10 items-center justify-center rounded-[3px] bg-ink text-[13px] font-medium text-white hover:bg-ink-3">
                    Sign in
                  </Link>
                  <Link href="/login?mode=register" onClick={() => setOpen(false)} className="inline-flex h-10 items-center justify-center rounded-[3px] border border-line text-[13px] font-medium hover:border-ink">
                    Register
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link role="menuitem" href={href} onClick={onClick} className="block px-3 py-2.5 text-[14px] transition-colors hover:bg-mist">
      {children}
    </Link>
  );
}
