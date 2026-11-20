import { Shimmer } from "./ui";

/* Loading skeletons for the marketplace routes (used by their loading.tsx). */

export function ResultsSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading plans…</span>
      <section className="border-b border-line">
        <div className="container-x pb-8 pt-8 md:pb-10 md:pt-10">
          <Shimmer className="h-3 w-40" />
          <Shimmer className="mt-10 h-3 w-32" />
          <Shimmer className="mt-4 h-10 w-full max-w-xl" />
          <Shimmer className="mt-8 h-[72px] w-full" />
        </div>
      </section>
      <section className="container-x py-8 md:py-12 lg:grid lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-12">
        <div className="hidden space-y-4 lg:block">
          {Array.from({ length: 8 }, (_, i) => (
            <Shimmer key={i} className="h-5 w-full" />
          ))}
        </div>
        <div className="space-y-5">
          <Shimmer className="h-9 w-full" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="border border-line p-6">
              <div className="flex gap-4">
                <Shimmer className="size-12 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Shimmer className="h-3 w-32" />
                  <Shimmer className="h-5 w-56" />
                </div>
                <Shimmer className="hidden h-10 w-32 sm:block" />
              </div>
              <Shimmer className="mt-6 h-14 w-full" />
              <Shimmer className="mt-4 h-8 w-2/3" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <section className="border-b border-line">
        <div className="container-x pb-12 pt-8 md:pb-16 md:pt-10">
          <Shimmer className="h-3 w-40" />
          <Shimmer className="mt-12 h-3 w-28" />
          <Shimmer className="mt-5 h-12 w-full max-w-2xl" />
          <Shimmer className="mt-5 h-5 w-full max-w-lg" />
        </div>
      </section>
      <section className="container-x grid grid-cols-1 gap-5 py-12 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows * 3 }, (_, i) => (
          <Shimmer key={i} className="h-44 w-full" />
        ))}
      </section>
    </div>
  );
}
