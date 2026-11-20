"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import {
  cityStore,
  compareStore,
  sessionReadyStore,
  useStore,
  userStore,
  wishlistStore,
  type AccountUser,
  type Wishlist,
} from "@/lib/store";
import type { SessionUser } from "@/lib/action-result";
import { signOutAction } from "@/server/actions/auth";
import { clearWishlistAction, setWishlistItemAction } from "@/server/actions/wishlist";
import { useCatalog } from "@/components/providers/catalog-provider";

export const MAX_COMPARE = 4;

export type EnquiryKind = "test-drive" | "best-price" | "contact-dealer" | "callback" | "inspection";

export interface EnquiryRequest {
  kind: EnquiryKind;
  /** Car or dealer name shown in the modal header */
  subject?: string;
  /** Optional secondary line (variant, location, etc.) */
  detail?: string;
  /** City name to preselect instead of the visitor's city (e.g. where the car being sold is) */
  city?: string;
  /** Linked records, stored on the lead for the admin panel */
  carSlug?: string;
  usedCarId?: string;
  dealerId?: string;
}

export interface Toast {
  id: number;
  message: string;
  tone?: "default" | "success" | "error";
  action?: { label: string; href: string };
}

interface UIContextValue {
  enquiry: EnquiryRequest | null;
  openEnquiry: (req: EnquiryRequest) => void;
  closeEnquiry: () => void;
  locationOpen: boolean;
  setLocationOpen: (open: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  toasts: Toast[];
  toast: (message: string, opts?: Omit<Toast, "id" | "message">) => void;
  dismissToast: (id: number) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [enquiry, setEnquiry] = useState<EnquiryRequest | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismissToast = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<UIContextValue["toast"]>(
    (message, opts) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, message, ...opts }]);
      window.setTimeout(() => dismissToast(id), 3600);
    },
    [dismissToast],
  );

  // Confirm the session with the server once per page load.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { user: SessionUser | null; wishlist: Wishlist | null }) => {
        if (cancelled) return;
        if (data.user) {
          userStore.set(toAccount(data.user));
          if (data.wishlist) wishlistStore.set(data.wishlist);
        } else if (userStore.get()) {
          // Signed out elsewhere or the session expired: drop the account's saved list from this device.
          userStore.set(null);
          wishlistStore.set({ cars: [], used: [] });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) sessionReadyStore.set(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<UIContextValue>(
    () => ({
      enquiry,
      openEnquiry: setEnquiry,
      closeEnquiry: () => setEnquiry(null),
      locationOpen,
      setLocationOpen,
      searchOpen,
      setSearchOpen,
      toasts,
      toast,
      dismissToast,
    }),
    [enquiry, locationOpen, searchOpen, toasts, toast, dismissToast],
  );

  return (
    <MotionConfig reducedMotion="user">
      <UIContext.Provider value={value}>{children}</UIContext.Provider>
    </MotionConfig>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside <AppProvider>");
  return ctx;
}

/* ── Domain hooks ───────────────────────────────────────────── */

export function useWishlist() {
  const wishlist = useStore(wishlistStore);
  const { toast } = useUI();

  const has = useCallback(
    (kind: "cars" | "used", id: string) => wishlist[kind].includes(id),
    [wishlist],
  );

  const toggle = useCallback(
    (kind: "cars" | "used", id: string, label?: string) => {
      const exists = wishlistStore.get()[kind].includes(id);
      const before = wishlistStore.get();
      wishlistStore.set((prev) => ({
        ...prev,
        [kind]: exists ? prev[kind].filter((x) => x !== id) : [...prev[kind], id],
      }));
      // Signed in: keep the account in step; undo if the server refuses.
      if (userStore.get()) {
        setWishlistItemAction(kind, id, !exists)
          .then((res) => {
            if (!res.ok) throw new Error(res.error);
          })
          .catch(() => {
            wishlistStore.set(before);
            toast("Couldn't update your saved cars. Please try again.", { tone: "error" });
          });
      }
      toast(exists ? `Removed ${label ?? "car"} from saved` : `Saved ${label ?? "car"}`, {
        tone: exists ? "default" : "success",
        action: exists ? undefined : { label: "View saved", href: "/wishlist" },
      });
    },
    [toast],
  );

  const clear = useCallback((kind?: "cars" | "used") => {
    wishlistStore.set((prev) => (kind ? { ...prev, [kind]: [] } : { cars: [], used: [] }));
    if (userStore.get()) clearWishlistAction(kind).catch(() => undefined);
  }, []);

  return { wishlist, count: wishlist.cars.length + wishlist.used.length, has, toggle, clear };
}

export function useCompare() {
  const slugs = useStore(compareStore);
  const { toast } = useUI();

  const has = useCallback((slug: string) => slugs.includes(slug), [slugs]);

  const toggle = useCallback(
    (slug: string, label?: string) => {
      const current = compareStore.get();
      if (current.includes(slug)) {
        compareStore.set(current.filter((s) => s !== slug));
        return;
      }
      if (current.length >= MAX_COMPARE) {
        toast(`You can compare up to ${MAX_COMPARE} cars. Remove one to add ${label ?? "another"}.`, { tone: "error" });
        return;
      }
      compareStore.set([...current, slug]);
      toast(`${label ?? "Car"} added to compare`, {
        tone: "success",
        action: current.length >= 1 ? { label: "Compare now", href: `/compare?cars=${[...current, slug].join(",")}` } : undefined,
      });
    },
    [toast],
  );

  const set = useCallback((next: string[]) => compareStore.set(next.slice(0, MAX_COMPARE)), []);
  const remove = useCallback((slug: string) => compareStore.set((prev) => prev.filter((s) => s !== slug)), []);
  const clear = useCallback(() => compareStore.set([]), []);

  return { slugs, has, toggle, set, remove, clear, max: MAX_COMPARE };
}

/** The visitor's city, resolved through the catalogue: unset, removed or unknown cities fall back to the default city. */
export function useCity() {
  const slug = useStore(cityStore);
  const { getCity } = useCatalog();
  const setCity = useCallback((next: string) => cityStore.set(next), []);
  return { city: getCity(slug), setCity };
}

const toAccount = (u: SessionUser): AccountUser => ({ ...u, phone: u.phone ?? "", state: u.state ?? "", city: u.city ?? "" });

/**
 * The signed-in customer. `ready` turns true once the server has confirmed the session.
 * `login` is called after a successful sign-in/sign-up Server Action with what it returned.
 */
export function useUser() {
  const user = useStore(userStore);
  const ready = useStore(sessionReadyStore);
  const login = useCallback((next: SessionUser, wishlist?: Wishlist) => {
    userStore.set(toAccount(next));
    if (wishlist) wishlistStore.set(wishlist);
  }, []);
  const logout = useCallback(async () => {
    userStore.set(null);
    wishlistStore.set({ cars: [], used: [] });
    await signOutAction().catch(() => undefined);
  }, []);
  const update = useCallback((patch: Partial<AccountUser>) => userStore.set((prev) => (prev ? { ...prev, ...patch } : prev)), []);
  return { user, ready, login, logout, update };
}
