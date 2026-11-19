"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Clock, Eye, MapPin, UserRound } from "lucide-react";
import type { UsedCar } from "@/types";
import { getDealer } from "@/data/dealers";
import { cn, initials } from "@/lib/utils";
import { BrandMonogram } from "@/components/ui/page-header";
import { RatingInline } from "@/components/ui/rating";
import { useUI } from "@/components/providers/app-provider";
import { maskPhone, sellerPhone } from "./inspection";

export function SellerCard({ car, className }: { car: Pick<UsedCar, "id" | "city" | "seller">; className?: string }) {
  const dealer = car.seller.dealerId ? getDealer(car.seller.dealerId) : undefined;

  if (car.seller.type === "Dealer") {
    return (
      <div className={cn("border border-line p-6", className)}>
        <p className="type-eyebrow text-muted">Sold by</p>
        <div className="mt-4 flex items-start gap-4">
          <BrandMonogram name={dealer?.name ?? car.seller.name} className="size-12 shrink-0 text-[15px]" />
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-ink">{car.seller.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {dealer ? `${dealer.area}, ${dealer.city}` : car.city}
            </p>
            {dealer && <RatingInline value={dealer.rating} count={dealer.reviewCount} className="mt-2" />}
          </div>
        </div>
        {dealer && (
          <>
            <p className="mt-4 flex items-center gap-1.5 border-t border-line pt-4 text-[13px] text-muted">
              <Clock className="size-3.5 shrink-0" aria-hidden /> {dealer.hours}
            </p>
            <Link
              href={`/dealers/${dealer.id}`}
              className="group/sl mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink"
            >
              View showroom
              <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover/sl:-translate-y-0.5 group-hover/sl:translate-x-0.5" />
            </Link>
          </>
        )}
      </div>
    );
  }

  return <PrivateSeller car={car} className={className} />;
}

function PrivateSeller({ car, className }: { car: Pick<UsedCar, "id" | "city" | "seller">; className?: string }) {
  const { toast } = useUI();
  const [revealed, setRevealed] = useState(false);
  const phone = sellerPhone(car.id);

  return (
    <div className={cn("border border-line p-6", className)}>
      <p className="type-eyebrow text-muted">Private seller</p>
      <div className="mt-4 flex items-center gap-4">
        <span aria-hidden className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-mist text-[14px] font-semibold text-ink">
          {initials(car.seller.name) || <UserRound className="size-5" />}
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-ink">{car.seller.name}</p>
          <p className="mt-0.5 text-[13px] text-muted">Individual owner · {car.city}</p>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-line pt-4">
        <div>
          <p className="text-[12px] text-muted">Phone</p>
          {revealed ? (
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="mt-0.5 block text-[15px] font-medium text-ink underline-offset-4 hover:underline num">
              {phone}
            </a>
          ) : (
            <p className="mt-0.5 text-[15px] font-medium tracking-wide text-ink num" aria-label="Phone number hidden">
              {maskPhone(phone)}
            </p>
          )}
        </div>
        {!revealed && (
          <button
            type="button"
            onClick={() => {
              setRevealed(true);
              toast(`${car.seller.name.split(" ")[0]} has been told you viewed their number. Mention March Gear when you call.`, {
                tone: "success",
              });
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-[3px] border border-ink/15 px-3.5 text-[13px] font-medium text-ink transition-colors duration-[250ms] hover:border-ink"
          >
            <Eye className="size-3.5" aria-hidden /> Reveal
          </button>
        )}
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        Meet in a public place, check the original RC and never pay a token amount before an inspection.
      </p>
    </div>
  );
}
