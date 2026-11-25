import { ArrowRight, CalendarDays, Lightbulb, RefreshCcw, Rocket, ShieldPlus, Sparkles, Zap, type LucideIcon } from "lucide-react";
import type { InsCampaignType } from "@/db/enums";
import { cn } from "@/lib/utils";
import { INS_CAMPAIGN_TYPE_LABEL } from "@/insurance/labels";
import { CTA_DEFAULT } from "./shared";

/* How a promotional campaign looks on MarchGear's insurance pages. Pure — used by the editor (live) and the detail page. */

export const CAMPAIGN_TYPE_ICON: Record<InsCampaignType, LucideIcon> = {
  product_launch: Rocket,
  renewal_drive: RefreshCcw,
  ev_promotion: Zap,
  seasonal: CalendarDays,
  awareness: Lightbulb,
  add_on_highlight: ShieldPlus,
  other: Sparkles,
};

const IST = { timeZone: "Asia/Kolkata" } as const;

/** The banner, or a quiet branded panel when there isn't one. */
export function CampaignArt({ banner, type, className }: { banner: string | null | undefined; type: InsCampaignType | ""; className?: string }) {
  const Icon = CAMPAIGN_TYPE_ICON[type || "other"];
  return (
    <div className={cn("relative overflow-hidden bg-ink", className)}>
      {banner ? (
        // Vendor-uploaded banner from /media.
        // eslint-disable-next-line @next/next/no-img-element
        <img loading="lazy" decoding="async" src={banner} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,#2a2a2a_0%,#111111_60%)]" />
          <div aria-hidden className="absolute -right-[7%] top-1/2 h-[160%] w-[17%] -translate-y-1/2 rotate-[18deg] bg-red/90" />
          <div aria-hidden className="absolute right-[13%] top-1/2 h-[160%] w-[1.2%] -translate-y-1/2 rotate-[18deg] bg-white/10" />
          <Icon aria-hidden className="absolute bottom-[11%] left-[5%] h-[24%] max-h-9 w-auto text-white/25" strokeWidth={1.5} />
        </>
      )}
    </div>
  );
}

export function CampaignPreview({
  title,
  summary,
  type,
  banner,
  ctaLabel,
  vendorName,
  endsAt,
  products,
  className,
}: {
  title: string;
  summary: string;
  type: InsCampaignType | "";
  banner: string | null;
  ctaLabel: string | null;
  vendorName: string;
  endsAt: Date | string | null;
  products: string[];
  className?: string;
}) {
  const end = endsAt && !Number.isNaN(new Date(endsAt).getTime()) ? new Date(endsAt) : null;
  return (
    <article className={cn("overflow-hidden border border-line bg-white", className)} aria-label="Campaign preview">
      <div className="relative">
        <CampaignArt banner={banner} type={type} className="aspect-[16/7]" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="inline-flex h-6 items-center rounded-[2px] bg-white/95 px-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink">Campaign</span>
          {type && <span className="inline-flex h-6 max-w-[60%] items-center truncate rounded-[2px] bg-ink/65 px-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white backdrop-blur-sm">{INS_CAMPAIGN_TYPE_LABEL[type]}</span>}
        </div>
      </div>
      <div className="p-5">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{vendorName}</p>
        <h3 className={cn("mt-1.5 line-clamp-2 break-words text-[18px] font-semibold leading-snug tracking-[-0.01em]", !title && "text-muted/70")}>{title || "Your campaign title"}</h3>
        <p className={cn("mt-1.5 line-clamp-3 break-words text-[13.5px] leading-relaxed", summary ? "text-muted" : "text-muted/60")}>
          {summary || "A one- or two-line summary of what the campaign offers customers."}
        </p>
        {products.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {products.slice(0, 3).map((p) => (
              <li key={p} className="max-w-full truncate rounded-[2px] bg-mist px-2 py-1 text-[11.5px] font-medium">
                {p}
              </li>
            ))}
            {products.length > 3 && <li className="rounded-[2px] bg-mist px-2 py-1 text-[11.5px] text-muted">+{products.length - 3} more</li>}
          </ul>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span role="presentation" className="inline-flex h-10 max-w-full items-center gap-2 truncate rounded-[3px] bg-red px-4 text-[13px] font-medium text-white">
            {ctaLabel || CTA_DEFAULT} <ArrowRight className="size-4 shrink-0" aria-hidden />
          </span>
          {end && <span className="text-[12px] text-muted">Ends {end.toLocaleDateString("en-IN", { ...IST, day: "numeric", month: "short", year: "numeric" })}</span>}
        </div>
      </div>
    </article>
  );
}
