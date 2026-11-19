"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="container-x flex min-h-[60vh] flex-col items-start justify-center py-24">
      <p className="type-eyebrow flex items-center gap-3 text-muted">
        <span aria-hidden className="h-px w-6 bg-red" />
        Something stalled
      </p>
      <h1 className="type-h1 mt-5 max-w-2xl text-balance">We hit a bump in the road.</h1>
      <p className="type-lead mt-5 max-w-lg text-muted">This page didn&apos;t load as expected. Try again, or head back to the start.</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button onClick={reset} icon={<RotateCcw className="size-4" aria-hidden />}>
          Try again
        </Button>
        <Button href="/" variant="outline">
          Go to homepage
        </Button>
      </div>
    </section>
  );
}
