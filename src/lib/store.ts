"use client";

import { useSyncExternalStore } from "react";

type Listener = () => void;
type Updater<T> = T | ((prev: T) => T);

export interface PersistentStore<T> {
  get: () => T;
  getServer: () => T;
  set: (next: Updater<T>) => void;
  subscribe: (listener: Listener) => () => void;
}

/**
 * A tiny localStorage-backed store for useSyncExternalStore.
 * The server snapshot is always the initial value, so hydration is stable;
 * the persisted value takes over immediately after.
 */
export function createPersistentStore<T>(key: string, initial: T): PersistentStore<T> {
  let state = initial;
  let loaded = false;
  const listeners = new Set<Listener>();

  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) state = JSON.parse(raw) as T;
    } catch {
      // Storage can be unavailable (private mode, blocked site data).
    }
  };

  const emit = () => listeners.forEach((l) => l());

  return {
    get: () => {
      load();
      return state;
    },
    getServer: () => initial,
    set: (next) => {
      load();
      state = typeof next === "function" ? (next as (prev: T) => T)(state) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch {
        // Ignore persistence failures; in-memory state still updates.
      }
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      const onStorage = (e: StorageEvent) => {
        if (e.key !== key) return;
        loaded = false;
        load();
        emit();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}

/** Same shape as a persistent store, but kept in memory only. */
export function createMemoryStore<T>(initial: T): PersistentStore<T> {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    getServer: () => initial,
    set: (next) => {
      state = typeof next === "function" ? (next as (prev: T) => T)(state) : next;
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T>(store: PersistentStore<T>) {
  return useSyncExternalStore(store.subscribe, store.get, store.getServer);
}

/* ── App stores ─────────────────────────────────────────────── */

export interface Wishlist {
  cars: string[];
  used: string[];
}

/** The signed-in customer, cached on the device for a fast first paint. The server session is the source of truth. */
export interface AccountUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  state: string;
  city: string;
  memberSince: string;
  role: "customer" | "editor" | "admin" | "dealer" | "insurer";
}
/** @deprecated Use AccountUser. */
export type MockUser = AccountUser;

export const wishlistStore = createPersistentStore<Wishlist>("mg.wishlist", { cars: [], used: [] });
export const compareStore = createPersistentStore<string[]>("mg.compare", []);
/** City slug the visitor picked; "" until they pick one, so useCity() shows the default city from site content. */
export const cityStore = createPersistentStore<string>("mg.city", "");
export const userStore = createPersistentStore<AccountUser | null>("mg.account", null);
/** True once the server has confirmed who (if anyone) is signed in. */
export const sessionReadyStore = createMemoryStore(false);
export const announcementStore = createPersistentStore<boolean>("mg.announcement.dismissed", false);
