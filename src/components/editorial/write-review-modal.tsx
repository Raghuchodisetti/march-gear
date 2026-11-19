"use client";

import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import type { OwnerReview } from "@/types";
import { Modal } from "@/components/ui/overlay";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useUser } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";
import { StarInput } from "./star-input";

export interface CarOption {
  value: string;
  label: string;
  variants: string[];
}

const OWNED_FOR = ["Less than 6 months", "6 – 12 months", "1 – 2 years", "2 – 3 years", "More than 3 years"];
const MIN_BODY = 40;
const MIN_TITLE = 6;

type Field = "car" | "rating" | "title" | "body" | "name" | "km";

/** Event-time only: a unique id for a locally published review. */
function localId() {
  return `local-${Date.now().toString(36)}`;
}

function todayIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "Write a review" dialog. The form mounts fresh each time it opens. */
export function WriteReviewModal({
  open,
  onClose,
  cars,
  defaultCar,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  cars: CarOption[];
  defaultCar?: string;
  onSubmit: (review: OwnerReview) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Write an owner review" description="Share what it’s really like to live with your car." size="lg">
      <ReviewForm cars={cars} defaultCar={defaultCar} onSubmit={onSubmit} onClose={onClose} />
    </Modal>
  );
}

function ReviewForm({
  cars,
  defaultCar,
  onSubmit,
  onClose,
}: {
  cars: CarOption[];
  defaultCar?: string;
  onSubmit: (review: OwnerReview) => void;
  onClose: () => void;
}) {
  const { user } = useUser();
  const [car, setCar] = useState(defaultCar ?? "");
  const [variant, setVariant] = useState("");
  const [rating, setRating] = useState(0);
  const [ownedFor, setOwnedFor] = useState(OWNED_FOR[1]);
  const [km, setKm] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [done, setDone] = useState<OwnerReview | null>(null);

  const carOption = cars.find((c) => c.value === car);
  const bodyLength = body.trim().length;

  const clearError = (field: Field) => setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));

  const reset = () => {
    setDone(null);
    setRating(0);
    setTitle("");
    setBody("");
    setKm("");
    setVariant("");
    setErrors({});
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<Field, string>> = {};
    const kmValue = km.trim() ? Number(km.replace(/[,\s]/g, "")) : 0;
    if (!carOption) next.car = "Choose the car you own";
    if (!rating) next.rating = "Select an overall rating";
    if (title.trim().length < MIN_TITLE) next.title = `Add a short headline (at least ${MIN_TITLE} characters)`;
    if (bodyLength < MIN_BODY) next.body = `Tell us a little more — at least ${MIN_BODY} characters`;
    if (!name.trim()) next.name = "Add your name as you’d like it to appear";
    if (!Number.isFinite(kmValue) || kmValue < 0 || kmValue > 999_999) next.km = "Enter kilometres as a number, e.g. 12500";
    setErrors(next);
    if (Object.keys(next).length > 0 || !carOption) {
      const first = (["car", "rating", "title", "body", "name", "km"] as Field[]).find((f) => next[f]);
      const target =
        first === "rating"
          ? document.querySelector<HTMLElement>('#wr-rating [role="radio"][tabindex="0"]')
          : first
            ? document.getElementById(`wr-${first}`)
            : null;
      target?.focus();
      return;
    }

    const review: OwnerReview = {
      id: localId(),
      carSlug: carOption.value,
      name: name.trim(),
      city: city.trim() || "India",
      variant: variant || carOption.variants[0] || "—",
      ownedFor,
      kmDriven: Math.round(kmValue),
      rating,
      title: title.trim(),
      body: body.trim(),
      date: todayIso(),
      helpful: 0,
      ratings: { exterior: rating, comfort: rating, performance: rating, value: rating },
    };
    onSubmit(review);
    setDone(review);
  };

  if (done) {
    const carLabel = cars.find((c) => c.value === done.carSlug)?.label ?? "your car";
    return (
      <div className="px-6 py-12 text-center sm:px-10" role="status">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-ink text-white">
          <Check className="size-6" aria-hidden />
        </span>
        <h3 className="type-h3 mt-6 text-balance">Thank you, {done.name.split(" ")[0]}.</h3>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
          Your review of the {carLabel} is now at the top of the list. In the live product a moderator reads every review before it is published.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button variant="dark" onClick={onClose} data-autofocus>
            View my review
          </Button>
          <Button variant="outline" onClick={reset}>
            Write another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <SelectField
            id="wr-car"
            label="Your car"
            placeholder="Select a car"
            options={cars.map(({ value, label }) => ({ value, label }))}
            value={car}
            onChange={(e) => {
              setCar(e.target.value);
              setVariant("");
              clearError("car");
            }}
            aria-invalid={errors.car ? true : undefined}
            aria-describedby={errors.car ? "wr-car-error" : undefined}
            data-autofocus={!defaultCar ? true : undefined}
          />
          {errors.car && (
            <p id="wr-car-error" className="mt-1.5 text-xs text-red">
              {errors.car}
            </p>
          )}
        </div>
        <SelectField
          label="Variant"
          placeholder={carOption ? "Select variant (optional)" : "Choose a car first"}
          options={(carOption?.variants ?? []).map((v) => ({ value: v, label: v }))}
          value={variant}
          onChange={(e) => setVariant(e.target.value)}
          disabled={!carOption}
        />
      </div>

      <div id="wr-rating" tabIndex={-1} className="outline-none">
        <StarInput
          value={rating}
          onChange={(n) => {
            setRating(n);
            clearError("rating");
          }}
          error={errors.rating}
        />
      </div>

      <TextField
        id="wr-title"
        label="Headline"
        placeholder="Sum it up in a line"
        maxLength={90}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          clearError("title");
        }}
        error={errors.title}
      />

      <div>
        <TextArea
          id="wr-body"
          label="Your review"
          placeholder="What do you love? What would you change? How is it on fuel, comfort and service?"
          rows={5}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            clearError("body");
          }}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby="wr-body-count"
        />
        <p id="wr-body-count" className={cn("mt-1.5 flex justify-between gap-4 text-xs", errors.body ? "text-red" : "text-muted")}>
          <span>{errors.body ?? "Minimum 40 characters. Be specific — it helps other buyers."}</span>
          <span className={cn("shrink-0 num", bodyLength >= MIN_BODY && "text-ink")}>
            {bodyLength}/{MIN_BODY}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <SelectField label="Owned for" options={OWNED_FOR.map((o) => ({ value: o, label: o }))} value={ownedFor} onChange={(e) => setOwnedFor(e.target.value)} />
        <TextField
          id="wr-km"
          label="Kilometres driven (optional)"
          inputMode="numeric"
          placeholder="e.g. 12500"
          value={km}
          onChange={(e) => {
            setKm(e.target.value);
            clearError("km");
          }}
          error={errors.km}
        />
        <TextField
          id="wr-name"
          label="Display name"
          autoComplete="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearError("name");
          }}
          error={errors.name}
        />
        <TextField label="City (optional)" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] leading-relaxed text-muted">Demo only — your review is kept on this page and not sent anywhere.</p>
        <Button type="submit" variant="primary" className="shrink-0">
          Publish review
        </Button>
      </div>
    </form>
  );
}
