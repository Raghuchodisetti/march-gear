"use client";

import { useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PenLine, Star, ThumbsUp } from "lucide-react";
import type { OwnerReview } from "@/types";
import { formatDate, formatKm } from "@/lib/format";
import { cn, initials } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { Segmented, SelectField, TextArea, TextField } from "@/components/ui/field";
import { ScoreBar, Stars } from "@/components/ui/rating";
import { TextLink } from "@/components/ui/section-heading";
import { useUI } from "@/components/providers/app-provider";
import { useCarDetail } from "./context";
import { ratingDistribution } from "./utils";

type Sort = "helpful" | "recent";

/** Owner rating summary, review list and a local-only "write a review" flow. */
export function OwnerReviews({ initial }: { initial: OwnerReview[] }) {
  const { car, title } = useCarDetail();
  const { toast } = useUI();
  const [reviews, setReviews] = useState<OwnerReview[]>(initial);
  const [sort, setSort] = useState<Sort>("helpful");
  const [voted, setVoted] = useState<string[]>([]);
  const [writing, setWriting] = useState(false);

  const distribution = ratingDistribution(car.rating, car.reviewCount);
  const sorted = [...reviews].sort((a, b) => (sort === "helpful" ? b.helpful - a.helpful : b.date.localeCompare(a.date)));
  const sub = (["exterior", "comfort", "performance", "value"] as const).map((k) => ({
    label: k[0].toUpperCase() + k.slice(1),
    value: reviews.length ? reviews.reduce((sum, r) => sum + r.ratings[k], 0) / reviews.length : car.rating,
  }));

  const vote = (id: string) => {
    const has = voted.includes(id);
    setVoted((v) => (has ? v.filter((x) => x !== id) : [...v, id]));
    setReviews((list) => list.map((r) => (r.id === id ? { ...r, helpful: r.helpful + (has ? -1 : 1) } : r)));
    if (!has) toast("Thanks — your vote helps other buyers", { tone: "success" });
  };

  return (
    <div className="mt-16 grid grid-cols-1 gap-12 md:mt-20 lg:grid-cols-12 lg:gap-10">
      <aside className="lg:col-span-4" aria-labelledby="owner-summary-title">
        <div className="lg:sticky lg:top-[152px]">
          <h3 id="owner-summary-title" className="type-eyebrow text-muted">
            Owner reviews
          </h3>
          <p className="mt-5 flex items-baseline gap-2">
            <span className="font-display text-[clamp(3rem,2.4rem+2vw,4.25rem)] font-semibold leading-none tracking-[-0.035em] num">
              {car.rating.toFixed(1)}
            </span>
            <span className="text-[15px] text-muted">/ 5</span>
          </p>
          <Stars value={car.rating} size={16} className="mt-3" />
          <p className="mt-2 text-[13px] text-muted">
            Based on <span className="num text-ink">{car.reviewCount.toLocaleString("en-IN")}</span> owner ratings
          </p>

          <ul className="mt-8 space-y-2.5" aria-label="Rating distribution">
            {distribution.map((d) => (
              <li key={d.stars} className="grid grid-cols-[28px_1fr_52px] items-center gap-3 text-[12.5px]">
                <span className="flex items-center gap-0.5 num">
                  {d.stars}
                  <Star aria-hidden className="size-3 fill-ink text-ink" strokeWidth={0} />
                </span>
                <span className="relative h-[5px] bg-line" aria-hidden>
                  <span className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${d.share * 100}%` }} />
                </span>
                <span className="text-right text-muted num">
                  <span className="sr-only">{d.stars} stars: </span>
                  {Math.round(d.share * 100)}%
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 space-y-4 border-t border-line pt-6">
            {sub.map((s) => (
              <ScoreBar key={s.label} label={s.label} value={s.value} max={5} />
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-4">
            <Button variant="dark" icon={<PenLine aria-hidden className="size-4" />} onClick={() => setWriting(true)} className="w-full sm:w-auto lg:w-full">
              Write a review
            </Button>
            <TextLink href={`/reviews/owners?car=${car.slug}`}>All {car.name} owner reviews</TextLink>
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:col-span-8">
        <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-muted">
            <span className="font-medium text-ink num">{reviews.length}</span> written {reviews.length === 1 ? "review" : "reviews"} from verified owners
          </p>
          {reviews.length > 1 && (
            <Segmented<Sort>
              ariaLabel="Sort reviews"
              value={sort}
              onChange={setSort}
              options={[
                { value: "helpful", label: "Most helpful" },
                { value: "recent", label: "Most recent" },
              ]}
            />
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-start gap-5 border-b border-line py-12">
            <p className="type-h3">No written reviews yet.</p>
            <p className="max-w-md text-[15px] text-muted">Own a {title}? Share what it&rsquo;s really like to live with — your experience helps thousands of buyers.</p>
            <Button variant="outline" onClick={() => setWriting(true)}>
              Be the first to review
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {sorted.map((r) => (
                <motion.li
                  key={r.id}
                  layout="position"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <ReviewCard review={r} voted={voted.includes(r.id)} onVote={() => vote(r.id)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <WriteReviewModal
        open={writing}
        onClose={() => setWriting(false)}
        onSubmit={(review) => {
          setReviews((list) => [review, ...list]);
          setSort("recent");
          setWriting(false);
          toast("Review added — thanks for sharing (demo, saved on this page only)", { tone: "success" });
        }}
      />
    </div>
  );
}

function ReviewCard({ review, voted, onVote }: { review: OwnerReview; voted: boolean; onVote: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const long = review.body.length > 220;

  return (
    <article className="grid grid-cols-1 gap-5 py-8 sm:grid-cols-[180px_1fr] sm:gap-8">
      <div className="flex items-center gap-3 sm:flex-col sm:items-start">
        <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-mist text-[12px] font-semibold">
          {initials(review.name)}
        </span>
        <div className="min-w-0 text-[12.5px]">
          <p className="text-[14px] font-medium text-ink">{review.name}</p>
          <p className="text-muted">{review.city}</p>
          <p className="mt-2 hidden text-muted sm:block">
            Owned {review.ownedFor}
            <br />
            <span className="num">{formatKm(review.kmDriven)}</span> driven
          </p>
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Stars value={review.rating} size={13} />
          <span className="text-[12px] text-muted">{formatDate(review.date)}</span>
        </div>
        <h4 className="type-h4 mt-3">{review.title}</h4>
        <p className={cn("mt-2 text-[15px] leading-relaxed text-ink/80", !expanded && long && "line-clamp-3")}>{review.body}</p>
        {long && (
          <button type="button" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} className="mt-2 text-[13px] font-medium underline underline-offset-4">
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-muted">
          <span>
            {review.variant}
            <span className="sm:hidden">
              {" "}
              · {review.ownedFor} · <span className="num">{formatKm(review.kmDriven)}</span>
            </span>
          </span>
          <button
            type="button"
            onClick={onVote}
            aria-pressed={voted}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 font-medium transition-colors duration-[250ms]",
              voted ? "border-ink bg-ink text-white" : "border-line text-ink hover:border-ink/40",
            )}
          >
            <ThumbsUp aria-hidden className="size-3.5" />
            Helpful <span className="num">{review.helpful}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

interface FormState {
  name: string;
  city: string;
  variant: string;
  rating: number;
  title: string;
  body: string;
}

function WriteReviewModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (review: OwnerReview) => void }) {
  const { car, title: carTitle } = useCarDetail();
  const empty: FormState = { name: "", city: "", variant: car.variants[0].name, rating: 0, title: "", body: "" };
  const [form, setForm] = useState<FormState>(empty);
  const [submitted, setSubmitted] = useState(false);
  const counter = useRef(1);

  const errors: Partial<Record<keyof FormState, string>> = {};
  if (form.name.trim().length < 2) errors.name = "Please enter your name.";
  if (form.rating < 1) errors.rating = "Choose a star rating.";
  if (form.title.trim().length < 4) errors.title = "Add a short headline (at least 4 characters).";
  if (form.body.trim().length < 40) errors.body = `Tell us a little more — at least 40 characters (${form.body.trim().length}/40).`;
  const show = (k: keyof FormState) => (submitted ? errors[k] : undefined);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const today = new Date().toISOString().slice(0, 10);
    onSubmit({
      id: `local-${car.slug}-${counter.current++}`,
      carSlug: car.slug,
      name: form.name.trim(),
      city: form.city.trim() || "India",
      variant: form.variant,
      ownedFor: "Recently",
      kmDriven: 0,
      rating: form.rating,
      title: form.title.trim(),
      body: form.body.trim(),
      date: today,
      helpful: 0,
      ratings: { exterior: form.rating, comfort: form.rating, performance: form.rating, value: form.rating },
    });
    setForm(empty);
    setSubmitted(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={`Review the ${carTitle}`} description="Share your ownership experience. Demo only — reviews stay on this page." size="lg">
      <form onSubmit={submit} noValidate className="space-y-6 p-6 sm:p-8">
        <div>
          <p className="mb-2 text-[12.5px] font-medium" id="rating-label">
            Your rating
          </p>
          <StarInput value={form.rating} onChange={(v) => set("rating", v)} labelledBy="rating-label" invalid={Boolean(show("rating"))} />
          {show("rating") && <p className="mt-1.5 text-xs text-red">{show("rating")}</p>}
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField label="Your name" value={form.name} onChange={(e) => set("name", e.target.value)} error={show("name")} autoComplete="name" data-autofocus />
          <TextField label="City (optional)" value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" />
        </div>
        <SelectField
          label="Variant you own"
          value={form.variant}
          onChange={(e) => set("variant", e.target.value)}
          options={car.variants.map((v) => ({ value: v.name, label: v.name }))}
        />
        <TextField label="Headline" value={form.title} onChange={(e) => set("title", e.target.value)} error={show("title")} maxLength={90} />
        <div>
          <TextArea
            label="Your review"
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            rows={5}
            aria-invalid={show("body") ? true : undefined}
            placeholder="Comfort, efficiency, service experience, what you'd change…"
          />
          {show("body") && <p className="mt-1.5 text-xs text-red">{show("body")}</p>}
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" arrow>
            Publish review
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function StarInput({ value, onChange, labelledBy, invalid }: { value: number; onChange: (v: number) => void; labelledBy: string; invalid?: boolean }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const words = ["", "Poor", "Below average", "Good", "Very good", "Excellent"];
  return (
    <div className="flex items-center gap-4">
      <div role="radiogroup" aria-labelledby={labelledBy} aria-invalid={invalid || undefined} className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""} — ${words[n]}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => onChange(n)}
            className="inline-flex size-10 items-center justify-center rounded-full transition-colors hover:bg-mist"
          >
            <Star aria-hidden className={cn("size-6 transition-colors duration-[200ms]", n <= shown ? "fill-red text-red" : "fill-line text-line")} strokeWidth={0} />
          </button>
        ))}
      </div>
      <span className="text-[13px] text-muted" aria-live="polite">
        {words[shown]}
      </span>
    </div>
  );
}
