"use client";

import { useState } from "react";
import { useDeskRouter as useRouter } from "@/components/admin/desk";
import { Check, Loader2, Plus } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { createDealerReviewAction, updateReviewAction } from "@/server/actions/admin";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { DEALER_VISITS } from "./options";

export interface EditableReview {
  title: string;
  body: string;
  rating: number;
  /** Dealer reviews only. */
  visit?: string;
}

const RATINGS = [
  { value: "5", label: "★★★★★  5 — Excellent" },
  { value: "4", label: "★★★★  4 — Good" },
  { value: "3", label: "★★★  3 — Average" },
  { value: "2", label: "★★  2 — Poor" },
  { value: "1", label: "★  1 — Very poor" },
];
const visitOptions = DEALER_VISITS.map((v) => ({ value: v, label: v }));
const todayIST = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-xs text-red">{message}</p> : null;
}

/** Runs a save, keeping field errors and toasting the outcome. */
function useSave() {
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = async <T extends object>(fn: () => Promise<ActionResult<T>>, done: string) => {
    setBusy(true);
    const res = await fn().catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setErrors(res?.fieldErrors ?? {});
      toast(res?.error ?? "Couldn't reach the server. Please try again.", { tone: "error" });
      return false;
    }
    setErrors({});
    toast(done, { tone: "success" });
    return true;
  };
  return { busy, errors, setErrors, save };
}

function Footer({ busy, onCancel, label, icon }: { busy: boolean; onCancel: () => void; label: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
      <Button variant="ghost" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      <Button type="submit" disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}>
        {label}
      </Button>
    </div>
  );
}

/** Edit a review's headline, text and rating (and a dealer review's visit type). */
export function ReviewEditDialog({ kind, id, review, open, onClose }: { kind: "owner" | "dealer"; id: string; review: EditableReview; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { busy, errors, setErrors, save } = useSave();
  const initial = { title: review.title, body: review.body, rating: String(Math.round(review.rating)), visit: review.visit ?? "" };
  const [v, setV] = useState(initial);
  const [wasOpen, setWasOpen] = useState(open);
  // Start from the saved review each time the dialog opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setV(initial);
      setErrors({});
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { title: v.title, body: v.body, rating: Number(v.rating), ...(kind === "dealer" ? { visit: v.visit } : {}) };
    if (await save(() => updateReviewAction(kind, id, input), "Review updated")) {
      onClose();
      router.refresh();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={kind === "owner" ? "Edit owner review" : "Edit dealer review"} description="Fix typos, remove personal details or correct the rating. The public page updates straight away." size="lg">
      <form onSubmit={submit} noValidate>
        <div className="space-y-4 px-6 py-5 sm:px-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField label="Rating" value={v.rating} onChange={(e) => setV({ ...v, rating: e.target.value })} options={RATINGS} error={errors.rating} />
            {kind === "dealer" && <SelectField label="Visit" value={v.visit} onChange={(e) => setV({ ...v, visit: e.target.value })} options={visitOptions} error={errors.visit} />}
          </div>
          <TextField label="Headline" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} error={errors.title} data-autofocus />
          <div>
            <TextArea label="Review" rows={8} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} aria-invalid={errors.body ? true : undefined} />
            <FieldError message={errors.body} />
          </div>
        </div>
        <Footer busy={busy} onCancel={onClose} label="Save changes" icon={<Check className="size-4" aria-hidden />} />
      </form>
    </Modal>
  );
}

const blankDealerReview = () => ({ dealerId: "", name: "", visit: "Purchase", date: todayIST(), rating: "5", title: "", body: "" });

/** "Add dealer review" button + dialog, for feedback collected offline (cards, calls, surveys). */
export function AddDealerReviewButton({ dealers }: { dealers: { value: string; label: string }[] }) {
  const router = useRouter();
  const { busy, errors, setErrors, save } = useSave();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(blankDealerReview);
  const set = (k: keyof ReturnType<typeof blankDealerReview>, value: string) => setV((p) => ({ ...p, [k]: value }));

  const show = () => {
    setV(blankDealerReview());
    setErrors({});
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await save(() => createDealerReviewAction({ ...v, rating: Number(v.rating) }), "Dealer review published")) {
      setOpen(false);
      router.push("/admin/reviews?kind=dealer");
      router.refresh();
    }
  };

  return (
    <>
      <Button size="sm" onClick={show} icon={<Plus className="size-4" aria-hidden />}>
        Add dealer review
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add dealer review" description="For feedback collected at the showroom, by phone or on a feedback card. It's published straight away." size="lg">
        <form onSubmit={submit} noValidate>
          <div className="space-y-4 px-6 py-5 sm:px-8">
            <SelectField label="Showroom" value={v.dealerId} onChange={(e) => set("dealerId", e.target.value)} placeholder="Choose a showroom…" options={dealers} error={errors.dealerId} data-autofocus />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Customer name" value={v.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
              <SelectField label="Visit" value={v.visit} onChange={(e) => set("visit", e.target.value)} options={visitOptions} error={errors.visit} />
              <TextField label="Date of visit" type="date" max={todayIST()} value={v.date} onChange={(e) => set("date", e.target.value)} error={errors.date} />
              <SelectField label="Rating" value={v.rating} onChange={(e) => set("rating", e.target.value)} options={RATINGS} error={errors.rating} />
            </div>
            <TextField label="Headline" value={v.title} onChange={(e) => set("title", e.target.value)} error={errors.title} />
            <div>
              <TextArea label="Review" rows={6} value={v.body} onChange={(e) => set("body", e.target.value)} aria-invalid={errors.body ? true : undefined} />
              <FieldError message={errors.body} />
            </div>
          </div>
          <Footer busy={busy} onCancel={() => setOpen(false)} label="Publish review" icon={<Plus className="size-4" aria-hidden />} />
        </form>
      </Modal>
    </>
  );
}
