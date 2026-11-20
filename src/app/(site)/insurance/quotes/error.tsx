"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The quotes page failed to load (e.g. the database is unreachable). */
export default function QuotesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="container-x flex min-h-[55vh] flex-col items-start justify-center py-24">
      <p className="type-eyebrow flex items-center gap-3 text-muted">
        <span aria-hidden className="h-px w-6 bg-red" />
        Quotes unavailable
      </p>
      <h1 className="type-h1 mt-5 max-w-2xl text-balance">We couldn&apos;t load the plans just now.</h1>
      <p className="type-lead mt-5 max-w-lg text-muted">Nothing you entered has been sent to any insurer. Try again in a moment.</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button onClick={reset} icon={<RotateCcw className="size-4" aria-hidden />}>
          Try again
        </Button>
        <Button href="/insurance" variant="outline">
          Insurance home
        </Button>
      </div>
    </section>
  );
}
