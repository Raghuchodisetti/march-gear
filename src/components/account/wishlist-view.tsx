"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, GitCompareArrows, Heart, Trash2 } from "lucide-react";
import { IMG } from "@/data/images";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Eyebrow } from "@/components/ui/section-heading";
import { Modal } from "@/components/ui/overlay";
import { CarCard } from "@/components/vehicle/car-card";
import { UsedCarCard } from "@/components/vehicle/used-car-card";
import { useCompare, useUI, useUser, useWishlist } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";

type Shelf = "cars" | "used";
const GRID = "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function WishlistView() {
  const router = useRouter();
  const { wishlist, clear } = useWishlist();
  const { user, ready } = useUser();
  const { set: setCompare, max } = useCompare();
  const { toast } = useUI();
  const { getCar, getUsedCar, brandName } = useCatalog();
  const [shelf, setShelf] = useState<Shelf>("cars");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  // Until the session is confirmed we can't tell a device list from an account list.
  if (!ready) return <WishlistSkeleton />;

  const hasItems = wishlist.cars.length > 0 || wishlist.used.length > 0;
  const newCars = wishlist.cars.map(getCar).filter((c) => c !== undefined);
  const used = wishlist.used.map(getUsedCar).filter((c) => c !== undefined);
  const picked = selected.filter((s) => wishlist.cars.includes(s));
  const count = shelf === "cars" ? newCars.length : used.length;

  const changeShelf = (next: string) => {
    setShelf(next === "used" ? "used" : "cars");
    setSelecting(false);
    setSelected([]);
  };

  const toggle = (slug: string, label: string) => {
    if (picked.includes(slug)) return setSelected(picked.filter((s) => s !== slug));
    if (picked.length >= max) return toast(`You can compare up to ${max} cars. Deselect one to add ${label}.`, { tone: "error" });
    setSelected([...picked, slug]);
  };

  const compareSelected = () => {
    setCompare(picked);
    router.push(`/compare?cars=${picked.join(",")}`);
  };

  const clearShelf = () => {
    clear(shelf);
    setConfirming(false);
    setSelecting(false);
    setSelected([]);
    toast(`Cleared ${count} saved ${shelf === "cars" ? "new" : "used"} ${count === 1 ? "car" : "cars"}`);
  };

  return (
    <section aria-label="Saved cars" className="pb-20 pt-10 md:pb-28 md:pt-14">
      <div className="container-x">
        {!user && hasItems && (
          <p className="mb-10 flex flex-col gap-2 border-l-2 border-red bg-mist px-4 py-3 text-[13.5px] text-muted sm:flex-row sm:items-center sm:justify-between">
            <span>Your shortlist is saved on this device only. Sign in and we&apos;ll add it to your account.</span>
            <Link href="/login?next=/wishlist" className="shrink-0 font-medium text-ink underline-offset-4 hover:underline">
              Sign in to sync it
            </Link>
          </p>
        )}
        {user && hasItems && (
          <p className="mb-8 flex items-center gap-2 text-[13px] text-muted">
            <Check aria-hidden className="size-3.5 shrink-0 text-red" strokeWidth={2.5} />
            Synced to your account — on every device you sign in to.
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 border-b border-line md:flex-row md:items-end md:justify-between md:gap-8">
          <Tabs
            className="min-w-0 border-b-0"
            ariaLabel="Saved car type"
            items={[
              { value: "cars", label: "New cars", count: newCars.length },
              { value: "used", label: "Used cars", count: used.length },
            ]}
            value={shelf}
            onChange={changeShelf}
          />
          {count > 0 && (
            <div className="flex flex-wrap items-center gap-2 md:pb-2.5">
              {shelf === "cars" && newCars.length >= 2 && !selecting && (
                <Button variant="outline" size="sm" icon={<GitCompareArrows className="size-3.5" aria-hidden />} onClick={() => setSelecting(true)}>
                  Select to compare
                </Button>
              )}
              <Button variant="ghost" size="sm" icon={<Trash2 className="size-3.5" aria-hidden />} onClick={() => setConfirming(true)}>
                Clear all
              </Button>
            </div>
          )}
        </div>

        <div role="tabpanel" aria-labelledby="shelf-heading">
          <h2 id="shelf-heading" className="sr-only">
            {shelf === "cars" ? "Saved new cars" : "Saved used cars"}
          </h2>
          {shelf === "cars" &&
            (newCars.length === 0 ? (
              <EmptyShelf kind="cars" />
            ) : (
              <>
                {selecting && (
                  <div className="sticky top-[72px] z-30 -mx-5 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white/95 px-5 py-3 backdrop-blur-md md:mx-0 md:px-0">
                    <p className="text-[13.5px]" aria-live="polite">
                      <span className="font-semibold num">{picked.length}</span>
                      <span className="text-muted"> of {max} selected · pick 2–4 to compare</span>
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelecting(false);
                          setSelected([]);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button variant="primary" size="sm" disabled={picked.length < 2} onClick={compareSelected} arrow>
                        Compare selected
                      </Button>
                    </div>
                  </div>
                )}
                <ul className={cn(GRID, "mt-10")}>
                  {newCars.map((car) => {
                    const title = `${brandName(car.brand)} ${car.name}`;
                    const isOn = picked.includes(car.slug);
                    return (
                      <li key={car.slug} className="relative">
                        <CarCard car={car} className={cn(selecting && isOn && "border-ink")} />
                        {selecting && (
                          <button
                            type="button"
                            aria-pressed={isOn}
                            aria-label={`${isOn ? "Deselect" : "Select"} ${title} for comparison`}
                            onClick={() => toggle(car.slug, title)}
                            className={cn(
                              "absolute inset-0 z-20 flex items-start p-3 transition-[background-color,box-shadow] duration-[250ms]",
                              isOn ? "bg-ink/[0.04] shadow-[inset_0_0_0_2px_var(--color-ink)]" : "hover:bg-white/20",
                            )}
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "inline-flex size-7 items-center justify-center rounded-[3px] border-2 transition-colors duration-[250ms]",
                                isOn ? "border-red bg-red text-white" : "border-white bg-ink/35 backdrop-blur-sm",
                              )}
                            >
                              {isOn && <Check className="size-4" strokeWidth={3} />}
                            </span>
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            ))}

          {shelf === "used" &&
            (used.length === 0 ? (
              <EmptyShelf kind="used" />
            ) : (
              <ul className={cn(GRID, "mt-10")}>
                {used.map((car) => (
                  <li key={car.id}>
                    <UsedCarCard car={car} />
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        size="sm"
        title={shelf === "cars" ? "Clear saved new cars?" : "Clear saved used cars?"}
        description={`This removes ${count} ${count === 1 ? "car" : "cars"} from your shortlist. It can't be undone.`}
      >
        <div className="flex flex-col-reverse gap-3 p-6 sm:flex-row sm:justify-end sm:px-8">
          <Button variant="outline" onClick={() => setConfirming(false)} data-autofocus>
            Keep them
          </Button>
          <Button variant="dark" onClick={clearShelf}>
            Clear all
          </Button>
        </div>
      </Modal>
    </section>
  );
}

function EmptyShelf({ kind }: { kind: Shelf }) {
  const { trendingCars, usedCars } = useCatalog();
  const isNew = kind === "cars";
  const suggestions = isNew ? trendingCars().slice(0, 3) : [];
  const usedSuggestions = isNew ? [] : usedCars.filter((c) => c.verified).slice(0, 3);
  return (
    <div className="pt-10">
      <div className="grid grid-cols-1 border border-line md:grid-cols-[1.1fr_1fr]">
        <div className="relative aspect-[16/10] overflow-hidden bg-mist md:aspect-auto md:min-h-[380px]">
          <Image
            src={isNew ? IMG.showroomSpot : IMG.lotRow}
            alt=""
            fill
            sizes="(min-width: 768px) 55vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col justify-center p-6 md:p-12">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
            <Heart aria-hidden className="size-5 text-red" />
          </span>
          <h2 className="type-h2 mt-8 text-balance">
            {isNew ? (
              <>
                No new cars <span className="type-editorial">saved yet</span>
              </>
            ) : (
              <>
                No used cars <span className="type-editorial">saved yet</span>
              </>
            )}
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
            {isNew
              ? "Tap the heart on any model to build a shortlist. When you have two or more, compare them side by side from here."
              : "Heart verified pre-owned cars as you browse — we'll keep them here with their price, kilometres and location."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {isNew ? (
              <>
                <Button href="/new-cars" variant="dark" arrow>
                  Explore new cars
                </Button>
                <Button href="/electric-cars" variant="outline">
                  Electric cars
                </Button>
              </>
            ) : (
              <>
                <Button href="/used-cars" variant="dark" arrow>
                  Browse used cars
                </Button>
                <Button href="/sell-car" variant="outline">
                  Sell your car
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-16 md:mt-20">
        <Eyebrow>{isNew ? "Popular right now" : "Verified this week"}</Eyebrow>
        <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((car) => (
            <li key={car.slug}>
              <CarCard car={car} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" />
            </li>
          ))}
          {usedSuggestions.map((car) => (
            <li key={car.id}>
              <UsedCarCard car={car} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function WishlistSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading saved cars" className="container-x pb-20 pt-10 md:pb-28 md:pt-14">
      <div className="flex gap-7 border-b border-line pb-3.5">
        <div className="skeleton h-5 w-24" />
        <div className="skeleton h-5 w-24" />
      </div>
      <div className={cn(GRID, "mt-10")}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="border border-line">
            <div className="skeleton aspect-[4/3]" />
            <div className="space-y-3 p-5">
              <div className="skeleton h-3 w-16" />
              <div className="skeleton h-6 w-2/3" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
