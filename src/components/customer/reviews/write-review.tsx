"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WriteReviewModal, type CarOption } from "@/components/editorial/write-review-modal";

/**
 * Opens the site's own "Write an owner review" dialog (same form, same moderation) and refreshes the list
 * when it closes, so a review just sent shows up as "Awaiting moderation".
 */
export function WriteReviewButton({
  cars,
  defaultCar,
  label = "Write a review",
  variant = "dark",
}: {
  cars: CarOption[];
  defaultCar?: string;
  label?: string;
  variant?: "dark" | "outline" | "primary";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size="sm" icon={<PenLine aria-hidden className="size-4" />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <WriteReviewModal
        open={open}
        onClose={() => {
          setOpen(false);
          router.refresh();
        }}
        cars={cars}
        defaultCar={defaultCar}
      />
    </>
  );
}
