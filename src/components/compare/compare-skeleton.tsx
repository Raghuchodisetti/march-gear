/** Suspense / pre-hydration placeholder for the comparison table. */
export function CompareSkeleton() {
  return (
    <div className="container-x pb-20 pt-8 md:pb-28 md:pt-12" aria-busy="true" aria-label="Loading comparison">
      <div className="flex items-center justify-between border-y border-line py-4">
        <div className="skeleton h-5 w-64 max-w-[60%]" />
        <div className="skeleton h-5 w-28" />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-[168px_repeat(4,minmax(0,1fr))] lg:grid-cols-[208px_repeat(4,minmax(0,1fr))]">
        <div className="hidden md:block" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={i > 1 ? "hidden md:block" : undefined}>
            <div className="skeleton aspect-[4/3]" />
            <div className="skeleton mt-4 h-3 w-16" />
            <div className="skeleton mt-3 h-5 w-3/4" />
            <div className="skeleton mt-3 h-4 w-1/2" />
          </div>
        ))}
      </div>
      <div className="mt-12 space-y-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
