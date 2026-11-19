"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Production hides server error messages (only the digest survives), so the copy can't depend on them.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="border border-line bg-white p-8">
      <p className="type-eyebrow text-red">Something went wrong</p>
      <h1 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.02em]">This page didn&apos;t load</h1>
      <p className="mt-2 max-w-xl text-[14px] text-muted">
        Try again. If it keeps happening, check that the database is running, then share the reference below with your developer.
      </p>
      {error.digest && <p className="mt-3 font-mono text-[12px] text-muted">Ref: {error.digest}</p>}
      <Button className="mt-6" size="sm" variant="dark" icon={<RotateCcw className="size-4" aria-hidden />} onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
