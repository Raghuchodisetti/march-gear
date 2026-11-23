"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/* Loading and error states for My garage and Insurance (they render inside the account shell). */

export function AccountSectionSkeleton({ cards = 2, label }: { cards?: number; label: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <div className="mb-8">
        <div className="skeleton h-8 w-48 rounded-[3px]" />
        <div className="skeleton mt-3 h-4 w-full max-w-md rounded-[3px]" />
      </div>
      <div className="skeleton mb-6 h-20 w-full rounded-[3px]" />
      {cards === 0 && (
        <div className="border border-line bg-white">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-b-0">
              <div className="skeleton size-9 shrink-0 rounded-[3px]" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-1/3 rounded-[3px]" />
                <div className="skeleton h-3.5 w-1/2 rounded-[3px]" />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="border border-line bg-white">
            <div className="skeleton aspect-[16/9] w-full" />
            <div className="space-y-3 p-5">
              <div className="skeleton h-5 w-1/2 rounded-[3px]" />
              <div className="skeleton h-4 w-2/3 rounded-[3px]" />
              <div className="skeleton h-24 w-full rounded-[3px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AccountSectionError({ title, reset, back }: { title: string; reset: () => void; back: { href: string; label: string } }) {
  return (
    <section className="border border-line bg-white px-6 py-14 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[13.5px] text-muted">Something went wrong on our side. Nothing you saved has been lost — try again in a moment.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset} variant="dark" size="sm" icon={<RotateCcw className="size-4" aria-hidden />}>
          Try again
        </Button>
        <Button href={back.href} variant="outline" size="sm">
          {back.label}
        </Button>
      </div>
    </section>
  );
}
