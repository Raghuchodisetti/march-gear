import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Star, ThumbsUp } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/format";
import { REVIEW_STATUS_VIEW, type MyReview } from "@/server/customer/account";
import { Badge } from "@/components/portal/ui";
import { Stars } from "@/components/ui/rating";

/* The customer's owner reviews (server-rendered) for /account/reviews. */

export function ReviewList({ reviews, empty }: { reviews: MyReview[]; empty: string }) {
  if (!reviews.length)
    return (
      <div className="flex flex-col items-center border border-line bg-white px-6 py-12 text-center">
        <span className="mb-3 inline-flex size-10 items-center justify-center rounded-full bg-mist text-ink/60">
          <Star aria-hidden className="size-4" />
        </span>
        <p className="text-[13.5px] font-medium">{empty}</p>
      </div>
    );
  return (
    <ul className="space-y-3">
      {reviews.map((r, i) => (
        <li key={r.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
          <ReviewRow review={r} eager={i < 2} />
        </li>
      ))}
    </ul>
  );
}

function ReviewRow({ review: r, eager }: { review: MyReview; eager?: boolean }) {
  const view = REVIEW_STATUS_VIEW[r.status];
  return (
    <article className="grid grid-cols-1 gap-5 border border-line bg-white p-5 md:grid-cols-[180px_minmax(0,1fr)] md:p-6">
      <div className="flex items-center gap-4 md:block">
        <div className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden bg-mist md:w-full">
          {r.image ? (
            <Image src={r.image} alt="" fill loading={eager ? "eager" : undefined} sizes="(min-width: 768px) 180px, 112px" className="object-cover" style={{ objectPosition: r.focus ?? "50% 55%" }} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Star aria-hidden className="size-6 text-ink/15" />
            </div>
          )}
        </div>
        <div className="min-w-0 md:mt-3">
          <p className="truncate text-[14px] font-semibold">{r.car}</p>
          <p className="truncate text-[12px] text-muted">{r.variant}</p>
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge tone={view.tone}>{view.label}</Badge>
          <Stars value={r.rating} size={14} />
          <span className="text-[12.5px] font-medium num">{r.rating.toFixed(1)}</span>
          <span className="text-[12px] text-muted">· Submitted {formatDate(r.date)}</span>
        </div>
        <h3 className="mt-3 text-[16px] font-semibold leading-snug tracking-[-0.01em]">&ldquo;{r.title}&rdquo;</h3>
        <p className="mt-1.5 line-clamp-3 text-[13.5px] leading-relaxed text-ink/80">{r.body}</p>
        <p className="mt-3 text-[12px] text-muted">
          Owned {r.ownedFor.toLowerCase()} · <span className="num">{formatNumber(r.kmDriven)}</span> km driven
        </p>
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-muted">{view.note}</p>
          <div className="flex shrink-0 items-center gap-4">
            {r.status === "approved" && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
                <ThumbsUp aria-hidden className="size-3.5" /> <span className="num">{r.helpful}</span> found it helpful
              </span>
            )}
            {r.status === "approved" && r.href && (
              <Link href={`${r.href}#reviews`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink transition-colors hover:text-red">
                View on car page <ArrowUpRight aria-hidden className="size-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
