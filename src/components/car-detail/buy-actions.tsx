"use client";

import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/button";
import { useUI } from "@/components/providers/app-provider";

/** Copies the current page URL and confirms with a toast. */
export function ShareButton({ label, tone = "light", className }: { label: string; tone?: "light" | "dark"; className?: string }) {
  const { toast } = useUI();

  const share = async () => {
    const url = window.location.href.split("#")[0];
    try {
      await navigator.clipboard.writeText(url);
      toast(`Link to ${label} copied`, { tone: "success" });
    } catch {
      toast("Couldn't copy the link — copy it from the address bar instead.", { tone: "error" });
    }
  };

  return (
    <IconButton
      aria-label={`Share ${label} — copy link`}
      onClick={share}
      tone={tone === "light" ? "light" : "plain"}
      className={cn(tone === "dark" && "bg-white/10 text-white hover:bg-white/20", className)}
    >
      <Share2 className="size-[17px]" aria-hidden />
    </IconButton>
  );
}

/** Scrolls to a section, offsetting the sticky header and section nav. */
export function scrollToSection(id: string, offset = 128) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - offset + 1;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  history.replaceState(null, "", `#${id}`);
}
