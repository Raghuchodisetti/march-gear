import type { ReactNode } from "react";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "ink" | "red" | "outline" | "mist" | "glass" | "glass-dark";

const tones: Record<Tone, string> = {
  ink: "bg-ink text-white",
  red: "bg-red text-white",
  outline: "border border-line bg-white text-ink",
  mist: "bg-mist text-ink",
  glass: "bg-white/90 text-ink backdrop-blur-sm",
  "glass-dark": "bg-ink/60 text-white backdrop-blur-sm",
};

export function Badge({ children, tone = "ink", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-[2px] px-2 text-[10.5px] font-semibold uppercase tracking-[0.12em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function VerifiedBadge({ className, tone = "glass" }: { className?: string; tone?: Tone }) {
  return (
    <Badge tone={tone} className={className}>
      <BadgeCheck className="size-3.5 text-red" aria-hidden />
      Verified
    </Badge>
  );
}

/** A small "demo data" disclaimer used next to prices. */
export function DemoNote({ className, children = "Indicative demo pricing" }: { className?: string; children?: ReactNode }) {
  return <span className={cn("text-[11px] tracking-wide text-muted", className)}>{children}</span>;
}
