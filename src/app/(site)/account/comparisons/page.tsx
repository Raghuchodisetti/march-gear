import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { requireUser } from "@/server/auth";
import { compareSetsFromSaved, getSavedCars } from "@/server/customer/saved";
import { PortalHeader } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { CurrentCompare, QuickSets, StarterComparisons } from "@/components/customer/comparisons/compare-list";

export const metadata: Metadata = { title: "Comparisons" };

export default async function ComparisonsPage() {
  const user = await requireUser("/account/comparisons");
  const saved = await getSavedCars(user.id);
  const sets = compareSetsFromSaved(saved);
  const listedNew = saved.filter((s) => s.kind === "cars" && s.state === "live").length;

  return (
    <>
      <PortalHeader
        title="Comparisons"
        description="Line cars up spec for spec. Pick up your current comparison, or start one from the cars you've saved."
        actions={
          <Button href="/compare" variant="outline" size="sm" arrow>
            Compare any cars
          </Button>
        }
      />

      <div className="space-y-10">
        <CurrentCompare />

        <section aria-labelledby="from-saved">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="from-saved" className="text-[15px] font-semibold tracking-[-0.01em]">
                Compare your saved cars
              </h2>
              <p className="mt-0.5 text-[12.5px] text-muted">Quick sets from your shortlist — by body type, budget and fuel.</p>
            </div>
            {listedNew > 0 && (
              <Button href="/account/saved" variant="ghost" size="sm">
                Saved cars ({listedNew})
              </Button>
            )}
          </div>
          {sets.length ? (
            <QuickSets sets={sets} />
          ) : (
            <div className="flex flex-col items-start gap-5 border border-line bg-white p-6 sm:flex-row sm:items-center md:p-7">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-mist">
                <Heart aria-hidden className="size-5 text-red" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold">{listedNew === 1 ? "Save one more new car to compare" : "Save two or more new cars"}</p>
                <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-muted">
                  Quick comparisons appear here once your shortlist has at least two new cars that are on sale — grouped by body type, budget and fuel.
                </p>
              </div>
              <Button href="/new-cars" variant="dark" size="sm" arrow>
                Explore new cars
              </Button>
            </div>
          )}
        </section>

        {sets.length === 0 && (
          <section aria-labelledby="starters">
            <h2 id="starters" className="mb-4 text-[15px] font-semibold tracking-[-0.01em]">
              Popular comparisons
            </h2>
            <StarterComparisons />
          </section>
        )}
      </div>
    </>
  );
}
