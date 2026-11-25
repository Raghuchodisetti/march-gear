"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Bell, CarFront, ChevronDown, ChevronRight, GitCompareArrows, Heart, Inbox, LayoutDashboard, MapPin, Search, X, type LucideIcon } from "lucide-react";
import { mainNav } from "@/data/navigation";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Logo } from "@/components/ui/logo";
import { useDialogBehaviour, useIsClient } from "@/components/ui/overlay";
import { useCity, useCompare, useUI, useUser, useWishlist } from "@/components/providers/app-provider";

/**
 * Full-screen mobile navigation: large display type, accordion sub-menus and
 * quick actions up top so the most common tasks are one tap away.
 */
const ACCOUNT_LINKS: { href: string; label: string; icon: LucideIcon; badge?: "unread" }[] = [
  { href: "/account", label: "My account", icon: LayoutDashboard },
  { href: "/account/garage", label: "My garage", icon: CarFront },
  { href: "/account/enquiries", label: "Enquiries", icon: Inbox },
  { href: "/account/notifications", label: "Notifications", icon: Bell, badge: "unread" },
];

export function MobileNav({ open, onClose, unread = 0 }: { open: boolean; onClose: () => void; /** Unread account notifications (signed-in customers). */ unread?: number }) {
  const isClient = useIsClient();
  const panel = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { city } = useCity();
  const { setSearchOpen, setLocationOpen } = useUI();
  const { count } = useWishlist();
  const { slugs } = useCompare();
  const { user, ready } = useUser();
  useDialogBehaviour(open, onClose, panel);

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          tabIndex={-1}
          initial={{ opacity: 0, x: "6%" }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: "6%" }}
          transition={{ duration: 0.45, ease: EASE }}
          className="fixed inset-0 z-[75] flex flex-col bg-white outline-none lg:hidden"
        >
          <div className="container-x flex h-[72px] shrink-0 items-center justify-between border-b border-line">
            <Logo />
            <button type="button" onClick={onClose} aria-label="Close menu" className="-mr-2 inline-flex size-10 items-center justify-center rounded-full hover:bg-mist">
              <X className="size-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="container-x pb-10 pt-5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setSearchOpen(true);
                }}
                className="flex h-12 w-full items-center gap-3 rounded-[3px] bg-mist px-4 text-left text-[15px] text-muted"
              >
                <Search className="size-4 text-ink" aria-hidden /> Search cars, brands, news
              </button>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <QuickAction
                  onClick={() => {
                    onClose();
                    setLocationOpen(true);
                  }}
                  icon={<MapPin className="size-4 text-red" />}
                  label={city.name}
                  ariaLabel={`${city.name}: change city`}
                />
                <QuickAction href={user ? "/account/saved" : "/wishlist"} onClick={onClose} icon={<Heart className="size-4" />} label={`Saved${count ? ` · ${count}` : ""}`} />
                <QuickAction href="/compare" onClick={onClose} icon={<GitCompareArrows className="size-4" />} label={`Compare${slugs.length ? ` · ${slugs.length}` : ""}`} />
              </div>

              {user && (
                <nav aria-label="Your account" className="mt-6">
                  <p className="type-eyebrow text-muted">Your account</p>
                  <ul className="mt-3 grid grid-cols-2 gap-2">
                    {ACCOUNT_LINKS.map(({ href, label, icon: Icon, badge }) => (
                      <li key={href}>
                        <Link href={href} onClick={onClose} className="flex h-12 items-center gap-2.5 rounded-[3px] border border-line px-3 text-[13.5px] font-medium">
                          <Icon aria-hidden className="size-4 shrink-0 text-ink/60" strokeWidth={1.8} />
                          <span className="min-w-0 flex-1 truncate">{label}</span>
                          {badge === "unread" && unread > 0 ? (
                            <span className="rounded-full bg-red px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-white num">
                              {unread > 99 ? "99+" : unread}
                              <span className="sr-only"> unread</span>
                            </span>
                          ) : (
                            <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}

              <nav aria-label="Mobile" className="mt-8">
                <ul className="border-t border-line">
                  {mainNav.map((item, i) => {
                    const isOpen = expanded === item.key;
                    return (
                      <motion.li
                        key={item.key}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.05 + i * 0.04, ease: EASE }}
                        className="border-b border-line"
                      >
                        {item.mega ? (
                          <>
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              onClick={() => setExpanded(isOpen ? null : item.key)}
                              className="flex w-full items-center justify-between py-4 text-left"
                            >
                              <span className="type-h3">{item.label}</span>
                              <ChevronDown aria-hidden className={cn("size-5 transition-transform duration-[350ms]", isOpen && "rotate-180 text-red")} />
                            </button>
                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.4, ease: EASE }}
                                  className="overflow-hidden"
                                >
                                  <div className="grid grid-cols-2 gap-x-6 gap-y-6 pb-6">
                                    {item.mega.columns.map((col) => (
                                      <div key={col.title}>
                                        <p className="type-eyebrow text-muted">{col.title}</p>
                                        <ul className="mt-3 space-y-2.5">
                                          {col.links.map((l) => (
                                            <li key={l.href}>
                                              <Link href={l.href} onClick={onClose} className="text-[15px] text-ink">
                                                {l.label}
                                              </Link>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </>
                        ) : (
                          <Link href={item.href} onClick={onClose} className="flex items-center justify-between py-4">
                            <span className="type-h3">{item.label}</span>
                            <ArrowUpRight aria-hidden className="size-5 text-muted" />
                          </Link>
                        )}
                      </motion.li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          </div>

          <div className="shrink-0 border-t border-line bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-2 gap-2">
              {user ? (
                <Link href="/account" onClick={onClose} className="relative inline-flex h-12 items-center justify-center gap-2 rounded-[3px] border border-line text-sm font-medium">
                  My account
                  {unread > 0 && <span role="img" aria-label={`${unread} unread`} className="size-2 rounded-full bg-red" />}
                </Link>
              ) : (
                // Before the session is confirmed, link to the account — it sends signed-out visitors to sign in.
                <Link
                  href={ready ? "/login" : "/account"}
                  onClick={onClose}
                  className="inline-flex h-12 items-center justify-center rounded-[3px] border border-line text-sm font-medium"
                >
                  {ready ? "Sign in" : "My account"}
                </Link>
              )}
              <Link href="/sell-car" onClick={onClose} className="inline-flex h-12 items-center justify-center rounded-[3px] bg-red text-sm font-medium text-white">
                Sell your car
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function QuickAction({ icon, label, href, onClick, ariaLabel }: { icon: React.ReactNode; label: string; href?: string; onClick?: () => void; ariaLabel?: string }) {
  const cls = "flex h-[72px] flex-col items-start justify-between rounded-[3px] border border-line p-3 text-left text-[12.5px] font-medium";
  if (href)
    return (
      <Link href={href} onClick={onClick} className={cls}>
        {icon}
        <span className="truncate">{label}</span>
      </Link>
    );
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={cls}>
      {icon}
      <span className="w-full truncate">{label}</span>
    </button>
  );
}
