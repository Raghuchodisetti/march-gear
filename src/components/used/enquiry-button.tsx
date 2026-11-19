"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useUI, type EnquiryKind } from "@/components/providers/app-provider";

type ButtonVariant = NonNullable<ComponentProps<typeof Button>["variant"]>;
type ButtonSize = NonNullable<ComponentProps<typeof Button>["size"]>;

/** A Button that opens the shared enquiry modal — lets server pages stay server-rendered. */
export function EnquiryButton({
  kind,
  subject,
  detail,
  carSlug,
  usedCarId,
  dealerId,
  variant,
  size,
  arrow,
  icon,
  className,
  children,
}: {
  kind: EnquiryKind;
  subject?: string;
  detail?: string;
  carSlug?: string;
  usedCarId?: string;
  dealerId?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  arrow?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const { openEnquiry } = useUI();
  return (
    <Button
      variant={variant}
      size={size}
      arrow={arrow}
      icon={icon}
      className={className}
      onClick={() => openEnquiry({ kind, subject, detail, carSlug, usedCarId, dealerId })}
    >
      {children}
    </Button>
  );
}
