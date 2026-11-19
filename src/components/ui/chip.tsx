import type { ComponentProps } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Toggleable filter pill. */
export function Chip({
  selected,
  className,
  children,
  showCheck = false,
  tone = "light",
  ...props
}: ComponentProps<"button"> & { selected?: boolean; showCheck?: boolean; tone?: "light" | "dark" }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...props}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] font-medium transition-[background-color,border-color,color] duration-[250ms] ease-[var(--ease-premium)]",
        tone === "light" &&
          (selected ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/40"),
        tone === "dark" &&
          (selected ? "border-white bg-white text-ink" : "border-white/20 bg-transparent text-white hover:border-white/60"),
        className,
      )}
    >
      {showCheck && selected && <Check className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}
