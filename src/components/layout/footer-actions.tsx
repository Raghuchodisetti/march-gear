"use client";

import { ArrowUp, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUI } from "@/components/providers/app-provider";

export function CallbackButton() {
  const { openEnquiry } = useUI();
  return (
    <Button size="lg" icon={<PhoneCall className="size-4" aria-hidden />} onClick={() => openEnquiry({ kind: "callback", subject: "Talk to a car expert" })}>
      Request a callback
    </Button>
  );
}

export function BackToTop() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="group inline-flex items-center gap-2 text-[12.5px] font-medium text-white/70 transition-colors duration-[250ms] hover:text-white"
    >
      Back to top
      <span className="inline-flex size-8 items-center justify-center rounded-full border border-white/20 transition-[background-color,border-color,color] duration-[250ms] group-hover:border-white group-hover:bg-white group-hover:text-ink">
        <ArrowUp className="size-3.5" aria-hidden />
      </span>
    </button>
  );
}
