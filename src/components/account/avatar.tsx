import { cn, initials } from "@/lib/utils";

/** Typographic initials tile — square, like the rest of the system. */
export function Avatar({ name, className, tone = "dark" }: { name: string; className?: string; tone?: "dark" | "light" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-display font-semibold tracking-[-0.03em] [font-stretch:112%]",
        tone === "dark" ? "bg-ink text-white" : "bg-white text-ink",
        className,
      )}
    >
      {initials(name) || "MG"}
    </span>
  );
}
