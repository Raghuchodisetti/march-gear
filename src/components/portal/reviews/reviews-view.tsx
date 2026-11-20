"use client";

import { useMemo, useState } from "react";
import { Loader2, MessageSquareReply, Pencil, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteReviewReplyAction, replyToReviewAction } from "@/server/actions/partner-reviews";
import { Stars } from "@/components/ui/rating";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { Textarea } from "@/components/portal/crm/controls";
import { useRun } from "@/components/portal/crm/use-run";
import { formatIstDateTime, formatIstDay } from "@/components/portal/crm/pipeline";
import { filterInput } from "@/components/portal/ui";

export interface ReviewItem {
  id: string;
  name: string;
  visit: string;
  date: string;
  rating: number;
  title: string;
  body: string;
  reply: string | null;
  repliedAt: string | null;
}

export function ReviewsView({ reviews, dealerName }: { reviews: ReviewItem[]; dealerName: string }) {
  const [q, setQ] = useState("");
  const [rating, setRating] = useState("");
  const [replied, setReplied] = useState<"" | "yes" | "no">("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return reviews.filter(
      (r) =>
        (!needle || `${r.name} ${r.title} ${r.body}`.toLowerCase().includes(needle)) &&
        (!rating || Math.round(r.rating) === Number(rating)) &&
        (!replied || (replied === "yes" ? Boolean(r.reply) : !r.reply)),
    );
  }, [reviews, q, rating, replied]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 border border-line bg-white p-3 md:flex-row md:items-center">
        <label className="relative block md:w-80">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reviews" aria-label="Search reviews" className={cn(filterInput, "w-full pl-9")} />
        </label>
        <select value={rating} onChange={(e) => setRating(e.target.value)} aria-label="Rating" className={cn(filterInput, "cursor-pointer")}>
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} star{n === 1 ? "" : "s"}
            </option>
          ))}
        </select>
        <select value={replied} onChange={(e) => setReplied(e.target.value as typeof replied)} aria-label="Reply status" className={cn(filterInput, "cursor-pointer")}>
          <option value="">Replied and not replied</option>
          <option value="no">Awaiting your reply</option>
          <option value="yes">Replied</option>
        </select>
        <p className="text-[12.5px] text-muted md:ml-auto num">
          {shown.length} of {reviews.length}
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="border border-line bg-white px-6 py-14 text-center text-[14px] text-muted">{reviews.length ? "No reviews match these filters." : "No published reviews yet. Approved customer reviews of your showroom appear here."}</div>
      ) : (
        <ul className="grid grid-cols-1 gap-px border border-line bg-line">
          {shown.map((r) => (
            <ReviewRow key={`${r.id}-${r.repliedAt ?? ""}`} review={r} dealerName={dealerName} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewRow({ review: r, dealerName }: { review: ReviewItem; dealerName: string }) {
  const { run, busy, errors } = useRun();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(r.reply ?? "");
  const [confirming, setConfirming] = useState(false);

  const save = async () => {
    if (await run("save", () => replyToReviewAction({ id: r.id, reply: text }), r.reply ? "Reply updated on your public page" : "Reply published on your public page")) setEditing(false);
  };
  const remove = async () => {
    setConfirming(false);
    await run("delete", () => deleteReviewReplyAction({ id: r.id }), "Reply removed");
  };

  return (
    <li className="bg-white p-5 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Stars value={r.rating} size={14} />
          <span className="text-[12.5px] font-medium num">{r.rating.toFixed(1)}</span>
        </div>
        <span className="text-[12px] text-muted num">{formatIstDay(`${r.date}T12:00:00+05:30`)}</span>
      </div>
      <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.01em]">{r.title}</h3>
      <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-ink/80">{r.body}</p>
      <p className="mt-3 text-[12.5px] text-muted">
        <span className="font-medium text-ink">{r.name}</span> · {r.visit}
      </p>

      {editing ? (
        <div className="mt-5 max-w-3xl">
          <Textarea
            label={`Public reply from ${dealerName}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1500}
            error={errors.reply}
            hint={`${text.trim().length}/1500 · Shown under the review on your MarchGear page.`}
            data-autofocus
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setText(r.reply ?? "");
              }}
            >
              Cancel
            </Button>
            <Button variant="dark" size="sm" onClick={save} disabled={busy !== null} icon={busy === "save" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
              {r.reply ? "Save reply" : "Publish reply"}
            </Button>
          </div>
        </div>
      ) : r.reply ? (
        <div className="mt-5 max-w-3xl border-l-2 border-red bg-mist/70 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Your reply</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink hover:text-red">
                <Pencil aria-hidden className="size-3.5" /> Edit
              </button>
              <button type="button" onClick={() => setConfirming(true)} disabled={busy !== null} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-red disabled:opacity-50">
                {busy === "delete" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Trash2 aria-hidden className="size-3.5" />} Delete
              </button>
            </div>
          </div>
          <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-ink/80">{r.reply}</p>
          {r.repliedAt && <p className="mt-2 text-[11.5px] text-muted num">Published {formatIstDateTime(r.repliedAt)}</p>}
        </div>
      ) : (
        <Button variant="outline" size="sm" className="mt-5" onClick={() => setEditing(true)} icon={<MessageSquareReply className="size-4" aria-hidden />}>
          Reply publicly
        </Button>
      )}

      <Modal open={confirming} onClose={() => setConfirming(false)} title="Delete your reply?" description="It will be removed from your public showroom page straight away." size="sm">
        <div className="flex justify-end gap-2 px-6 py-5 sm:px-8">
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Keep it
          </Button>
          <Button variant="primary" size="sm" onClick={remove} data-autofocus>
            Delete reply
          </Button>
        </div>
      </Modal>
    </li>
  );
}
