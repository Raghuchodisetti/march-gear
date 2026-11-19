"use client";

import { Link2 } from "lucide-react";
import { LinkedinIcon, XIcon } from "@/components/ui/social-icons";
import { useUI } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";
import { WhatsappIcon } from "./primitives";

/** Copy link plus X, WhatsApp and LinkedIn share intents (opened in a new tab). */
export function ShareButtons({
  title,
  className,
  label = "Share this story",
  tone = "dark",
}: {
  title: string;
  className?: string;
  label?: string | null;
  tone?: "dark" | "light";
}) {
  const { toast } = useUI();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Link copied to clipboard", { tone: "success" });
    } catch {
      toast("Couldn’t copy the link — use your browser’s address bar instead", { tone: "error" });
    }
  };

  const open = (network: "x" | "whatsapp" | "linkedin") => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(title);
    const target = {
      x: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    }[network];
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const btn = cn(
    "inline-flex size-10 items-center justify-center rounded-full border transition-[background-color,border-color,color] duration-[250ms] ease-[var(--ease-premium)]",
    tone === "dark" ? "border-line text-ink hover:border-ink hover:bg-ink hover:text-white" : "border-white/20 text-white hover:border-white hover:bg-white hover:text-ink",
  );

  return (
    <div className={className}>
      {label && <p className={cn("type-eyebrow", tone === "dark" ? "text-muted" : "text-white/55")}>{label}</p>}
      <div className={cn("flex items-center gap-2", label && "mt-4")}>
        <button type="button" onClick={copy} aria-label="Copy link" className={btn}>
          <Link2 className="size-4" aria-hidden />
        </button>
        <button type="button" onClick={() => open("x")} aria-label="Share on X (opens in a new tab)" className={btn}>
          <XIcon className="size-[15px]" />
        </button>
        <button type="button" onClick={() => open("whatsapp")} aria-label="Share on WhatsApp (opens in a new tab)" className={btn}>
          <WhatsappIcon className="size-[17px]" />
        </button>
        <button type="button" onClick={() => open("linkedin")} aria-label="Share on LinkedIn (opens in a new tab)" className={btn}>
          <LinkedinIcon className="size-[15px]" />
        </button>
      </div>
    </div>
  );
}
