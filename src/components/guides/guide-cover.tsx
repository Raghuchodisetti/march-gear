import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/* A guide's cover: no photo, just type on a dark panel with a pattern picked by its subject, so each subject has a
   recognisable look and every guide still feels part of one set. */

const PATTERNS: CSSProperties[] = [
  { backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.055) 0 1px, transparent 1px 15px)" },
  { backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1.6px)", backgroundSize: "15px 15px" },
  {
    backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
    backgroundSize: "26px 26px",
  },
  { backgroundImage: "repeating-radial-gradient(circle at 100% 0%, rgba(255,255,255,0.065) 0 1px, transparent 1px 17px)" },
  { backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 11px)" },
];

const BASES = ["#111111", "#16171a", "#1a1716", "#13171b", "#171717"];

/** A stable small number from a string (same subject → same look). */
export function hashOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function GuideCover({ subject, title, className, size = "md" }: { subject: string; title: string; className?: string; size?: "md" | "lg" }) {
  const h = hashOf(subject.toLowerCase());
  return (
    <div className={cn("relative isolate flex flex-col justify-between overflow-hidden text-white", className)} style={{ backgroundColor: BASES[h % BASES.length] }}>
      <div aria-hidden className="absolute inset-0 -z-10" style={PATTERNS[h % PATTERNS.length]} />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_88%_12%,rgba(227,30,36,0.42),transparent_46%)]" />
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="h-[2px] w-6 bg-red" />
        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">{subject}</span>
      </div>
      <p
        className={cn(
          "font-display font-semibold leading-[1.05] tracking-[-0.02em] text-balance",
          size === "lg" ? "line-clamp-4 text-[clamp(1.75rem,3.2vw,2.75rem)]" : "line-clamp-3 text-[clamp(1.35rem,2.1vw,1.7rem)]",
        )}
      >
        {title}
      </p>
    </div>
  );
}
