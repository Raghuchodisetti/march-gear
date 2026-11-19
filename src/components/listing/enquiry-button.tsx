"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useUI, type EnquiryKind } from "@/components/providers/app-provider";

/** A Button that opens the shared enquiry modal — usable from server pages. */
export function EnquiryButton({
  kind,
  subject,
  detail,
  children,
  variant = "primary",
  size = "md",
  icon,
  arrow,
  className,
}: {
  kind: EnquiryKind;
  subject?: string;
  detail?: string;
  children: ReactNode;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  icon?: ReactNode;
  arrow?: boolean;
  className?: string;
}) {
  const { openEnquiry } = useUI();
  return (
    <Button variant={variant} size={size} icon={icon} arrow={arrow} className={className} onClick={() => openEnquiry({ kind, subject, detail })}>
      {children}
    </Button>
  );
}
