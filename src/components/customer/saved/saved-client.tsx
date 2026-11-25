"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { wishlistStore } from "@/lib/store";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { clearWishlistAction, setWishlistItemAction } from "@/server/actions/wishlist";
import { useCity, useUI, useUser, useWishlist } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { CarCard } from "@/components/vehicle/car-card";
import { UsedCarCard } from "@/components/vehicle/used-car-card";
import { CompareToggle } from "@/components/vehicle/toggles";
import { ConfirmDialog } from "@/components/portal/profile/kit";

/* Small client islands for the server-rendered saved-cars page (/account/saved). */

/** Indicative on-road price in the visitor's chosen city (the same city the rest of the site prices in). */
export function OnRoadHint({ exShowroom, ev }: { exShowroom: number; ev: boolean }) {
  const { city } = useCity();
  const { onRoadPrice } = useCatalog();
  const { setLocationOpen } = useUI();
  return (
    <p className="mt-0.5 text-[12px] text-muted">
      On-road in{" "}
      <button type="button" onClick={() => setLocationOpen(true)} className="font-medium text-ink underline decoration-ink/20 underline-offset-[3px] transition-colors hover:decoration-red">
        {city.name}
      </button>{" "}
      from <span className="font-medium text-ink num">{formatPrice(onRoadPrice(exShowroom, city.slug, ev))}</span>
      <span className="text-muted"> · indicative</span>
    </p>
  );
}

/** Compare (new cars that are listed) and remove, kept in step with the heart buttons across the site. */
export function SavedCardActions({ kind, itemId, title, comparable }: { kind: "cars" | "used"; itemId: string; title: string; comparable: boolean }) {
  const router = useRouter();
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      const res = await setWishlistItemAction(kind, itemId, false);
      if (!res.ok) throw new Error(res.error);
      // The account copy is gone — drop it from this device's list too, so every heart button agrees.
      wishlistStore.set((prev) => ({ ...prev, [kind]: prev[kind].filter((x) => x !== itemId) }));
      toast(`Removed ${title} from saved`);
      router.refresh();
    } catch {
      toast("Couldn't remove that car. Please try again.", { tone: "error" });
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {comparable && <CompareToggle slug={itemId} label={title} />}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        aria-label={`Remove ${title} from saved cars`}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-red disabled:opacity-50"
      >
        {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Trash2 aria-hidden className="size-3.5" />}
        Remove
      </button>
    </div>
  );
}

/** "Clear all" for one shelf, with a confirmation. */
export function ClearShelf({ kind, count }: { kind: "cars" | "used"; count: number }) {
  const router = useRouter();
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const noun = `${kind === "cars" ? "new" : "used"} ${count === 1 ? "car" : "cars"}`;

  const clear = async () => {
    setBusy(true);
    try {
      const res = await clearWishlistAction(kind);
      if (!res.ok) throw new Error(res.error);
      wishlistStore.set((prev) => ({ ...prev, [kind]: [] }));
      toast(`Cleared ${count} saved ${noun}`);
      setOpen(false);
      router.refresh();
    } catch {
      toast("Couldn't clear your saved cars. Please try again.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-[3px] px-3 text-[13px] font-medium text-muted transition-colors hover:bg-mist hover:text-red">
        <Trash2 aria-hidden className="size-3.5" /> Clear all
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Clear ${count} saved ${noun}?`}
        body="They'll be removed from your account on every device. This can't be undone."
        confirm="Clear all"
        busy={busy}
        onConfirm={clear}
      />
    </>
  );
}

/**
 * Re-renders the page when the saved list changes somewhere else (a heart tapped in another tab,
 * or a suggestion saved from this page), so the server-rendered list never drifts from the hearts.
 */
export function SavedSync({ keys }: { keys: string[] }) {
  const router = useRouter();
  const { ready, user } = useUser();
  const { wishlist } = useWishlist();
  const local = [...wishlist.cars.map((id) => `cars:${id}`), ...wishlist.used.map((id) => `used:${id}`)].sort().join("|");
  const server = [...keys].sort().join("|");
  const last = useRef(local);

  useEffect(() => {
    if (!ready || !user) return;
    const changed = last.current !== local;
    last.current = local;
    if (!changed || local === server) return;
    // Give the account a moment to save the change before reading it back.
    const t = window.setTimeout(() => router.refresh(), 700);
    return () => window.clearTimeout(t);
  }, [ready, user, local, server, router]);

  return null;
}

/** Catalogue cards for an empty shelf — saving one here refreshes the list above. */
export function SavedSuggestions({ kind, ids, className }: { kind: "cars" | "used"; ids: string[]; className?: string }) {
  const { getCar, getUsedCar } = useCatalog();
  const sizes = "(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 100vw";
  const cards =
    kind === "cars"
      ? ids.map(getCar).flatMap((car, i) => (car ? [{ key: car.slug, node: <CarCard car={car} sizes={sizes} priority={i < 3} /> }] : []))
      : ids.map(getUsedCar).flatMap((car, i) => (car ? [{ key: car.id, node: <UsedCarCard car={car} sizes={sizes} priority={i < 3} /> }] : []));
  if (!cards.length) return null;
  return (
    <ul className={cn("grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {cards.map((c) => (
        <li key={c.key} className="min-w-0">
          {c.node}
        </li>
      ))}
    </ul>
  );
}
