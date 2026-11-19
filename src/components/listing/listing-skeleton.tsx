import { cn } from "@/lib/utils";

/** Suspense fallback that mirrors the filter bar and results grid. */
export function ListingSkeleton({ cards = 6, variant = "card", className }: { cards?: number; variant?: "card" | "row"; className?: string }) {
  return (
    <div className={className} aria-busy="true" aria-label="Loading results">
      <div className="border-y border-line">
        <div className="container-x flex gap-2 overflow-hidden py-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-10 w-28 shrink-0 rounded-full" />
          ))}
        </div>
      </div>
      <div className="container-x pb-20 pt-8 md:pb-28 md:pt-10">
        <div className="min-w-0">
          <div className="skeleton h-8 w-24" />
          <div className={cn("mt-8 grid grid-cols-1 gap-5", variant === "card" ? "sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4" : "grid-cols-1")}>
            {Array.from({ length: cards }, (_, i) =>
              variant === "card" ? (
                <div key={i} className="border border-line">
                  <div className="skeleton aspect-[4/3]" />
                  <div className="space-y-3 p-5">
                    <div className="skeleton h-3 w-16" />
                    <div className="skeleton h-6 w-2/3" />
                    <div className="skeleton h-4 w-1/2" />
                    <div className="skeleton mt-6 h-10 w-full" />
                  </div>
                </div>
              ) : (
                <div key={i} className="grid grid-cols-1 gap-6 border-t border-line pt-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                  <div className="skeleton aspect-[4/3]" />
                  <div className="space-y-3">
                    <div className="skeleton h-3 w-24" />
                    <div className="skeleton h-8 w-1/2" />
                    <div className="skeleton h-4 w-full" />
                    <div className="skeleton h-4 w-4/5" />
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
