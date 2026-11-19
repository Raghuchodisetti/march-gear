"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { useUI } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";

/** Copies a value (email, phone, address) and confirms with a toast. */
export function CopyButton({
  value,
  label,
  message,
  className,
  children,
}: {
  value: string;
  /** Accessible label, e.g. "Copy email address" */
  label: string;
  message?: string;
  className?: string;
  children?: ReactNode;
}) {
  const { toast } = useUI();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast(message ?? "Copied to clipboard", { tone: "success" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Couldn’t access the clipboard", { tone: "error" });
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={children ? undefined : label}
      title={label}
      className={cn(
        "inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition-colors duration-[250ms] hover:text-ink",
        className,
      )}
    >
      {copied ? <Check className="size-3.5 text-red" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}
