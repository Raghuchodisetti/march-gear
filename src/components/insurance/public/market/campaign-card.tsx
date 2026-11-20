"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import { INS_CAMPAIGN_TYPE_LABEL } from "@/insurance/labels";
import { formatDate } from "@/lib/format";
import type { PublicCampaign } from "@/server/insurance/public";
import { TrackInsuranceView, trackInsurance } from "./track";

const istDay = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);

/** A running promotion on a product page. Counts a view, and a click when followed. */
export function CampaignCard({ campaign: c, href }: { campaign: PublicCampaign; href: string }) {
  return (
    <>
      <TrackInsuranceView kind="campaign_view" vendorId={c.vendorId} refId={c.id} />
      <Link
        href={href}
        onClick={() => trackInsurance("campaign_click", c.vendorId, c.id)}
        className="group flex h-full flex-col border border-line bg-white transition-colors duration-[250ms] hover:border-ink"
      >
        {c.banner ? (
          <div className="relative aspect-[16/7] overflow-hidden bg-mist">
            <Image src={c.banner} alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
          </div>
        ) : (
          <div aria-hidden className="h-1 bg-red" />
        )}
        <div className="flex flex-1 flex-col p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            {INS_CAMPAIGN_TYPE_LABEL[c.type]} · {c.vendorName}
          </p>
          <h3 className="type-h4 mt-2">{c.title}</h3>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{c.summary}</p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-[13px]">
            <span className="inline-flex items-center gap-1.5 text-muted">
              <CalendarClock className="size-3.5" aria-hidden />
              Ends {formatDate(istDay(c.endsAt))}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-ink">
              {c.ctaLabel || "See plans"}
              <ArrowUpRight className="size-4 text-red transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </span>
          </div>
        </div>
      </Link>
    </>
  );
}
