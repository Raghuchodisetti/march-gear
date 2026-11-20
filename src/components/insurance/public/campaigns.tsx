import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, Megaphone } from "lucide-react";
import { INS_CAMPAIGN_TYPE_LABEL } from "@/insurance/labels";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PublicCampaign } from "@/server/insurance/public";
import { CampaignArt } from "@/components/insurance/vendor/campaigns/campaign-preview";

const IST = 5.5 * 3_600_000;
const istDay = (iso: string) => new Date(new Date(iso).getTime() + IST).toISOString().slice(0, 10);

/** Live promotions from approved insurers and intermediaries. Renders nothing when none are running. */
export function CampaignStrip({ campaigns, title = "Current offers from listed providers" }: { campaigns: PublicCampaign[]; title?: string }) {
  if (!campaigns.length) return null;
  const single = campaigns.length === 1;
  return (
    <section aria-labelledby="ins-offers-title" className="border-b border-line py-12 md:py-14">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="type-eyebrow flex items-center gap-3 text-muted">
              <Megaphone aria-hidden className="size-4 text-red" />
              Promotions
            </p>
            <h2 id="ins-offers-title" className="type-h3 mt-4">
              {title}
            </h2>
          </div>
          <p className="max-w-md text-[13px] text-muted">Offers are run by the provider named on each card and approved by MarchGear. Terms are the provider&apos;s.</p>
        </div>
        <div
          className={cn(
            "no-scrollbar mt-8",
            single ? "" : "-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0",
            campaigns.length >= 3 && "lg:grid-cols-3",
          )}
        >
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/insurance/quotes?campaign=${c.id}`}
              className={cn(
                "group flex border border-line bg-white transition-colors duration-[250ms] hover:border-ink",
                single ? "flex-col md:flex-row" : "w-[82%] shrink-0 snap-start flex-col md:w-auto",
              )}
            >
              {c.banner ? (
                <div className={cn("relative aspect-[16/7] overflow-hidden bg-mist", single && "md:aspect-auto md:w-2/5 md:shrink-0")}>
                  <Image src={c.banner} alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 82vw" className="object-cover transition-transform duration-[700ms] group-hover:scale-[1.03]" />
                </div>
              ) : (
                // The branded panel the vendor saw in its campaign preview ("without a banner, the card uses a clean MarchGear panel").
                <CampaignArt banner={null} type={c.type} className={cn("aspect-[16/7] shrink-0", single && "md:aspect-auto md:w-2/5")} />
              )}
              <div className={cn("flex flex-1 flex-col p-5", single && "md:p-7")}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {INS_CAMPAIGN_TYPE_LABEL[c.type]} · {c.vendorName}
                </p>
                <h3 className="type-h4 mt-2 text-[17px]">{c.title}</h3>
                <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-muted">{c.summary}</p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-[13px]">
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <CalendarClock aria-hidden className="size-3.5" />
                    Ends {formatDate(istDay(c.endsAt))}
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-ink">
                    {c.ctaLabel || "Get quotes"}
                    <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
