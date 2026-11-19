import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Keeps admin 404s (a deleted record, a mistyped ID) inside the admin shell instead of the public site's page.
export default function AdminNotFound() {
  return (
    <div className="border border-line bg-white p-8">
      <p className="type-eyebrow text-red">Not found</p>
      <h1 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.02em]">This page doesn&apos;t exist</h1>
      <p className="mt-2 max-w-xl text-[14px] text-muted">The record may have been deleted, or the link is out of date.</p>
      <Button href="/admin" className="mt-6" size="sm" variant="dark" icon={<ArrowLeft className="size-4" aria-hidden />}>
        Back to dashboard
      </Button>
    </div>
  );
}
