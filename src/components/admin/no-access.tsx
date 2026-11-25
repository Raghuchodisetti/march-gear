import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown on the staff desk for a section the account hasn't been given. */
export function NoAccess() {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-line bg-white px-6 py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-mist">
        <Lock aria-hidden className="size-6" />
      </span>
      <h1 className="mt-5 font-display text-[24px] font-semibold tracking-[-0.02em]">You don&apos;t have access to this section</h1>
      <p className="mt-2 max-w-md text-[14px] text-muted">Your account can use the sections in the menu. If you need this one too, ask an administrator to add it to your account.</p>
      <Button href="/admin" variant="outline" size="sm" className="mt-7">
        Back to the dashboard
      </Button>
    </div>
  );
}
