import type { Metadata } from "next";
import { CarFront, GitCompareArrows, Heart, Sparkles, TimerOff } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { getSavedCars } from "@/server/customer/saved";
import { PortalHeader } from "@/components/portal/ui";
import { PageTabs } from "@/components/portal/profile/kit";
import { MiniStat } from "@/components/portal/dashboard/sections";
import { Button } from "@/components/ui/button";
import { ClearShelf, SavedSync } from "@/components/customer/saved/saved-client";
import { EmptyShelf, SavedGrid } from "@/components/customer/saved/saved-list";

export const metadata: Metadata = { title: "Saved cars" };

export default async function SavedCarsPage(props: PageProps<"/account/saved">) {
  const user = await requireUser("/account/saved");
  const sp = await props.searchParams;
  const [saved, cat] = await Promise.all([getSavedCars(user.id), getCatalog()]);

  const newCars = saved.filter((s) => s.kind === "cars");
  const used = saved.filter((s) => s.kind === "used");
  const withOffers = saved.filter((s) => s.offers.length > 0).length;
  const unavailable = saved.filter((s) => s.state !== "live").length;
  const comparable = newCars.filter((s) => s.state === "live").length;
  const initial = typeof sp.tab === "string" ? sp.tab : newCars.length === 0 && used.length > 0 ? "used" : "new";

  const shelf = (kind: "cars" | "used") => {
    const items = kind === "cars" ? newCars : used;
    if (!items.length)
      return (
        <EmptyShelf
          kind={kind}
          suggestions={
            kind === "cars"
              ? cat
                  .trendingCars()
                  .filter((c) => !saved.some((s) => s.itemId === c.slug))
                  .slice(0, 3)
                  .map((c) => c.slug)
              : cat.usedCars
                  .filter((c) => c.verified)
                  .slice(0, 3)
                  .map((c) => c.id)
          }
        />
      );
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted">
            <span className="font-semibold text-ink num">{items.length}</span> saved · newest first
          </p>
          <ClearShelf kind={kind} count={items.length} />
        </div>
        <SavedGrid items={items} />
      </div>
    );
  };

  return (
    <>
      <SavedSync keys={saved.map((s) => s.key)} />
      <PortalHeader
        title="Saved cars"
        description="Your shortlist, synced to your account on every device you sign in to — with live availability, prices and dealer offers."
        actions={
          comparable >= 2 ? (
            <Button href="/account/comparisons" variant="dark" size="sm" icon={<GitCompareArrows aria-hidden className="size-4" />}>
              Compare saved cars
            </Button>
          ) : (
            <Button href="/new-cars" variant="outline" size="sm" arrow>
              Explore new cars
            </Button>
          )
        }
      />

      {saved.length > 0 && (
        <section aria-label="Summary" className="mb-6 flex flex-wrap gap-px overflow-hidden border border-line bg-line">
          <MiniStat icon={<Heart className="size-4" />} label="New cars" value={newCars.length} />
          <MiniStat icon={<CarFront className="size-4" />} label="Used cars" value={used.length} />
          <MiniStat icon={<Sparkles className="size-4" />} label="With live dealer offers" value={withOffers} href={withOffers ? "/offers" : undefined} />
          <MiniStat icon={<TimerOff className="size-4" />} label="No longer available" value={unavailable} />
        </section>
      )}

      <PageTabs
        initial={initial}
        items={[
          { value: "new", label: "New cars", count: newCars.length },
          { value: "used", label: "Used cars", count: used.length },
        ]}
        panels={{ new: shelf("cars"), used: shelf("used") }}
      />
    </>
  );
}
