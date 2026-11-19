import { Minus, Plus } from "lucide-react";
import type { Author, CarModel, ExpertReview as ExpertReviewType } from "@/types";
import { formatDate } from "@/lib/format";
import { initials } from "@/lib/utils";
import { ScoreBar } from "@/components/ui/rating";
import { TextLink } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";

/** Expert verdict: dark score panel + breakdown, pros and cons. */
export function ExpertReview({ car, review, author }: { car: CarModel; review: ExpertReviewType; author: Author }) {
  return (
    <Reveal>
      <article aria-labelledby="expert-review-title" className="grid grid-cols-1 border border-line lg:grid-cols-12">
        <div className="flex flex-col bg-ink p-6 text-white md:p-10 lg:col-span-4">
          <p className="type-eyebrow text-white/55">March Gear expert verdict</p>
          <p className="mt-8 flex items-baseline gap-2">
            <span className="type-display num">{review.score.toFixed(1)}</span>
            <span className="type-h4 text-white/45">/ 10</span>
          </p>
          <div className="mt-auto flex items-center gap-4 border-t border-white/10 pt-6 max-lg:mt-10">
            <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] font-semibold">
              {initials(author.name)}
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-medium">{author.name}</p>
              <p className="text-[12.5px] text-white/55">
                {author.role} · {formatDate(review.publishedOn)}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-10 lg:col-span-8">
          <h3 id="expert-review-title" className="type-h3 text-balance">
            {review.title}
          </h3>
          <blockquote className="mt-5 border-l-2 border-red pl-5 text-[17px] leading-relaxed text-ink/85">{review.verdict}</blockquote>

          <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">
            {review.scores.map((s) => (
              <ScoreBar key={s.label} label={s.label} value={s.value} />
            ))}
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 border-t border-line pt-8 sm:grid-cols-2">
            <div>
              <h4 className="type-eyebrow text-ink">The good</h4>
              <ul className="mt-4 space-y-3 text-[14px] leading-relaxed">
                {car.pros.map((p) => (
                  <li key={p} className="flex gap-3">
                    <Plus aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="type-eyebrow text-ink">The not so good</h4>
              <ul className="mt-4 space-y-3 text-[14px] leading-relaxed text-muted">
                {car.cons.map((c) => (
                  <li key={c} className="flex gap-3">
                    <Minus aria-hidden className="mt-0.5 size-4 shrink-0 text-ink/50" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-10">
            <TextLink href="/reviews">More expert reviews</TextLink>
          </div>
        </div>
      </article>
    </Reveal>
  );
}
