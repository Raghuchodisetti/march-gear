"use client";

import { motion } from "motion/react";
import { Check, Heart, Plus } from "lucide-react";
import { useCompare, useWishlist } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";

export function WishlistButton({
  kind = "cars",
  id,
  label,
  className,
  tone = "glass",
}: {
  kind?: "cars" | "used";
  id: string;
  label: string;
  className?: string;
  tone?: "glass" | "outline" | "dark";
}) {
  const { has, toggle } = useWishlist();
  const saved = has(kind, id);
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${label} from saved cars` : `Save ${label}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(kind, id, label);
      }}
      className={cn(
        "relative z-10 inline-flex size-10 items-center justify-center rounded-full transition-colors duration-[250ms]",
        tone === "glass" && "bg-white/90 text-ink backdrop-blur-sm hover:bg-white",
        tone === "outline" && "border border-line bg-white text-ink hover:border-ink",
        tone === "dark" && "bg-white/10 text-white hover:bg-white/20",
        className,
      )}
    >
      <Heart
        aria-hidden
        className={cn("size-[18px] transition-[fill,color,transform] duration-[250ms]", saved && "scale-110 fill-red text-red")}
      />
    </motion.button>
  );
}

export function CompareToggle({ slug, label, className, tone = "dark" }: { slug: string; label: string; className?: string; tone?: "dark" | "light" }) {
  const { has, toggle } = useCompare();
  const active = has(slug);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(slug, label);
      }}
      className={cn(
        "relative z-10 inline-flex items-center gap-2 text-[13px] font-medium transition-colors duration-[250ms]",
        tone === "dark" ? (active ? "text-ink" : "text-muted hover:text-ink") : active ? "text-white" : "text-white/60 hover:text-white",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex size-[18px] items-center justify-center rounded-[3px] border transition-[background-color,border-color] duration-[250ms]",
          active ? "border-red bg-red text-white" : tone === "dark" ? "border-ink/25" : "border-white/30",
        )}
      >
        {active ? <Check className="size-3" strokeWidth={3} /> : <Plus className="size-3" strokeWidth={2.5} />}
      </span>
      {active ? "Added to compare" : "Compare"}
    </button>
  );
}
