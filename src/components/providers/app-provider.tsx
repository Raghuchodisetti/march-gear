"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import {
  cityStore,
  compareStore,
  useStore,
  userStore,
  wishlistStore,
  type MockUser,
} from "@/lib/store";
import { getCity } from "@/data/cities";

export const MAX_COMPARE = 4;

export type EnquiryKind = "test-drive" | "best-price" | "contact-dealer" | "callback" | "inspection";

export interface EnquiryRequest {
  kind: EnquiryKind;
  /** Car or dealer name shown in the modal header */
  subject?: string;
  /** Optional secondary line (variant, location, etc.) */
  detail?: string;
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
      wishlistStore.set((prev) => ({
        ...prev,
        [kind]: exists ? prev[kind].filter((x) => x !== id) : [...prev[kind], id],
      }));
      toast(exists ? `Removed ${label ?? "car"} from saved` : `Saved ${label ?? "car"}`, {
        tone: exists ? "default" : "success",
        action: exists ? undefined : { label: "View saved", href: "/wishlist" },
      });
    },
    [toast],
  );

  const clear = useCallback((kind?: "cars" | "used") => {
    wishlistStore.set((prev) => (kind ? { ...prev, [kind]: [] } : { cars: [], used: [] }));
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

export function useCity() {
  const slug = useStore(cityStore);
  const setCity = useCallback((next: string) => cityStore.set(next), []);
  return { city: getCity(slug), setCity };
}

export function useUser() {
  const user = useStore(userStore);
  const login = useCallback((next: MockUser) => userStore.set(next), []);
  const logout = useCallback(() => userStore.set(null), []);
  const update = useCallback((patch: Partial<MockUser>) => userStore.set((prev) => (prev ? { ...prev, ...patch } : prev)), []);
  return { user, login, logout, update };
}
