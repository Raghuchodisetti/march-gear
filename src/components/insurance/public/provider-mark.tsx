import Image from "next/image";
import { cn } from "@/lib/utils";

/** A provider's logo on a white tile, or its initials when it hasn't uploaded one. */
export function ProviderMark({ name, logo, className }: { name: string; logo: string | null; className?: string }) {
  if (logo) {
    return (
      <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-inset ring-line", className)}>
        <Image src={logo} alt="" fill sizes="64px" className="object-contain p-2" />
      </span>
    );
  }
  const letters = name
    .replace(/\(demo\)/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center bg-mist font-display text-[15px] font-semibold tracking-[-0.03em] text-ink [font-stretch:110%]", className)}>
      {letters || "—"}
    </span>
  );
}
