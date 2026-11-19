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

export function useStore<T>(store: PersistentStore<T>) {
  return useSyncExternalStore(store.subscribe, store.get, store.getServer);
}

/* ── App stores ─────────────────────────────────────────────── */

export interface Wishlist {
  cars: string[];
  used: string[];
}

export interface MockUser {
  name: string;
  email: string;
  phone: string;
  city: string;
  memberSince: string;
}

export const wishlistStore = createPersistentStore<Wishlist>("mg.wishlist", { cars: [], used: [] });
export const compareStore = createPersistentStore<string[]>("mg.compare", []);
export const cityStore = createPersistentStore<string>("mg.city", "mumbai");
export const userStore = createPersistentStore<MockUser | null>("mg.user", null);
export const announcementStore = createPersistentStore<boolean>("mg.announcement.dismissed", false);
