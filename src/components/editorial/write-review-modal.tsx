"use client";

import { useState, type FormEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import { submitOwnerReviewAction } from "@/server/actions/leads";
import { Modal } from "@/components/ui/overlay";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Honeypot } from "@/components/forms/honeypot";
import { ConsentCheckbox, PolicyLink, PrivacyLink } from "@/components/forms/consent";
import { LiveRegion } from "@/components/forms/form-a11y";
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
const MIN_TITLE = 4; // matches the server rule and the car-page review form

type Field = "car" | "variant" | "rating" | "title" | "body" | "name" | "city" | "km" | "consent";
const ORDER: Field[] = ["car", "variant", "rating", "title", "body", "km", "name", "city", "consent"];
/** Server field → form field (the detailed ratings follow the overall one). */
const FIELD_FOR: Record<string, Field> = {
  carSlug: "car",
  variant: "variant",
  rating: "rating",
  "ratings.exterior": "rating",
  "ratings.comfort": "rating",
  "ratings.performance": "rating",
  "ratings.value": "rating",
  title: "title",
  body: "body",
  kmDriven: "km",
  name: "name",
  city: "city",
  consent: "consent",
};

/**
 * "Write a review" dialog. The form mounts fresh each time it opens.
 * Reviews are sent for moderation and only appear once the MarchGear team approves them.
 */
export function WriteReviewModal({
  open,
  onClose,
  cars,
  defaultCar,
}: {
  open: boolean;
  onClose: () => void;
  cars: CarOption[];
  defaultCar?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Write an owner review" description="Share what it’s really like to live with your car." size="lg">
      <ReviewForm cars={cars} defaultCar={defaultCar} onClose={onClose} />
    </Modal>
  );
}

function ReviewForm({ cars, defaultCar, onClose }: { cars: CarOption[]; defaultCar?: string; onClose: () => void }) {
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
  const [website, setWebsite] = useState("");
  const [consent, setConsent] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string; carLabel: string } | null>(null);

  const carOption = cars.find((c) => c.value === car);
  // A car with a single variant doesn't need the extra step.
  const variantValue = variant || (carOption?.variants.length === 1 ? carOption.variants[0] : "");
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
    setFormError(null);
    setConsent(false);
  };

  const focusFirst = (errs: Partial<Record<Field, string>>) => {
    const first = ORDER.find((f) => errs[f]);
    const count = ORDER.filter((f) => errs[f]).length;
    // A trailing no-break space on repeats, so the same message is announced again.
    const text = `${count === 1 ? "One field needs" : `${count} fields need`} your attention.`;
    if (count) setAnnouncement((prev) => (prev === text ? `${text}\u00a0` : text));
    const target =
      first === "rating"
        ? document.querySelector<HTMLElement>('#wr-rating [role="radio"][tabindex="0"]')
        : first
          ? document.getElementById(`wr-${first}`)
          : null;
    target?.focus();
    return Boolean(first);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const next: Partial<Record<Field, string>> = {};
    const kmValue = km.trim() ? Number(km.replace(/[,\s]/g, "")) : 0;
    if (!carOption) next.car = "Choose the car you own";
    else if (!variantValue && carOption.variants.length > 0) next.variant = "Choose your variant";
    if (!rating) next.rating = "Select an overall rating";
    if (title.trim().length < MIN_TITLE) next.title = `Add a short headline (at least ${MIN_TITLE} characters)`;
    if (bodyLength < MIN_BODY) next.body = `Tell us a little more — at least ${MIN_BODY} characters`;
    if (!Number.isInteger(kmValue) || kmValue < 0 || kmValue > 999_999) next.km = "Enter kilometres as a whole number, e.g. 12500";
    if (name.trim().length < 2) next.name = "Add your name as you’d like it to appear";
    if (city.trim().length < 2) next.city = "Enter your city";
    if (!consent) next.consent = "Please confirm this is your own experience and that we may publish it";
    setErrors(next);
    setFormError(null);
    if (focusFirst(next) || !carOption) return;

    const reviewer = name.trim().replace(/\s+/g, " ");
    // Bots fill the hidden field: pretend it worked and send nothing.
    if (website) return setDone({ name: reviewer, carLabel: carOption.label });

    setBusy(true);
    try {
      const res = await submitOwnerReviewAction({
        carSlug: carOption.value,
        variant: variantValue || "Not specified",
        rating,
        ownedFor,
        kmDriven: kmValue,
        title: title.trim(),
        body: body.trim(),
        name: reviewer,
        city: city.trim(),
        ratings: { exterior: rating, comfort: rating, performance: rating, value: rating },
        consent: true,
      });
      if (!res.ok) {
        const mapped: Partial<Record<Field, string>> = {};
        let unplaced: string | undefined;
        for (const [key, msg] of Object.entries(res.fieldErrors ?? {})) {
          if (FIELD_FOR[key]) mapped[FIELD_FOR[key]] ??= msg;
          else unplaced ??= msg;
        }
        setErrors(mapped);
        if (!focusFirst(mapped) || unplaced) setFormError(unplaced ?? res.error ?? "We couldn't send your review. Please try again.");
        return;
      }
      setDone({ name: reviewer, carLabel: carOption.label });
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="px-6 py-12 text-center sm:px-10" role="status">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-ink text-white">
          <Check className="size-6" aria-hidden />
        </span>
        <h3 className="type-h3 mt-6 text-balance">Thank you, {done.name.split(" ")[0]}.</h3>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
          Your review of the {done.carLabel} has been sent. It&apos;ll appear here once the MarchGear team has checked it.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button variant="dark" onClick={onClose} data-autofocus>
            Done
          </Button>
          <Button variant="outline" onClick={reset}>
            Review another car
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
      <LiveRegion message={announcement} />
      <Honeypot value={website} onChange={setWebsite} />
      {formError && (
        <p role="alert" className="border-l-2 border-red bg-red-50 px-3 py-2.5 text-[13.5px] text-red">
          {formError}
        </p>
      )}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
            clearError("variant");
          }}
          error={errors.car}
          data-autofocus={!defaultCar ? true : undefined}
        />
        <SelectField
          id="wr-variant"
          label="Variant"
          placeholder={carOption ? "Select variant" : "Choose a car first"}
          options={(carOption?.variants ?? []).map((v) => ({ value: v, label: v }))}
          value={variantValue}
          onChange={(e) => {
            setVariant(e.target.value);
            clearError("variant");
          }}
          error={errors.variant}
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
        <TextField
          id="wr-city"
          label="City"
          autoComplete="address-level2"
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            clearError("city");
          }}
          error={errors.city}
        />
      </div>

      <ConsentCheckbox
        id="wr-consent"
        checked={consent}
        onChange={(v) => {
          setConsent(v);
          clearError("consent");
        }}
        error={errors.consent}
      >
        I confirm this is my own, honest experience of owning this car, and I agree that MarchGear may publish it with my display name and city, as set out in the{" "}
          <PolicyLink href="/terms#user-content">Terms &amp; Conditions</PolicyLink> and the <PrivacyLink />.
      </ConsentCheckbox>

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] leading-relaxed text-muted">Every review is read by the MarchGear team before it&apos;s published.</p>
        <Button type="submit" variant="primary" className="shrink-0" disabled={busy}>
          {busy ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" /> Sending…
            </>
          ) : (
            "Send my review"
          )}
        </Button>
      </div>
    </form>
  );
}
