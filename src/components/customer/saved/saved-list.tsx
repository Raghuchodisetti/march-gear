import Image from "next/image";
import { CarPlaceholder, asBodyType } from "@/components/vehicle/car-image";
import Link from "next/link";
import { ArrowUpRight, Heart, Sparkles } from "lucide-react";
import { formatPrice, formatPriceRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SAVED_STATE, type SavedCar } from "@/server/customer/saved";
import { Badge, formatDay } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { OnRoadHint, SavedCardActions, SavedSuggestions } from "./saved-client";

/* Server-rendered saved-car cards for /account/saved (and the overview). */

export function SavedGrid({ items }: { items: SavedCar[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((s, i) => (
        <li key={s.key} className="min-w-0 animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
          <SavedCard item={s} priority={i < 2} />
        </li>
      ))}
    </ul>
  );
}

function SavedCard({ item: s, priority }: { item: SavedCar; priority?: boolean }) {
  const live = s.state === "live";
  const view = SAVED_STATE[s.state];
  const offer = s.offers[0];
  return (
    <article className={cn("group/saved flex h-full flex-col border border-line bg-white transition-colors duration-500", live && "hover:border-ink/25")}>
      <div className="relative aspect-[16/10] overflow-hidden bg-mist">
        {s.image ? (
          <Image
            src={s.image}
            alt=""
            fill
            loading={priority ? "eager" : undefined}
            sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 100vw"
            className={cn("object-cover transition-transform duration-[900ms] ease-[var(--ease-premium)]", live ? "group-hover/saved:scale-[1.03]" : "opacity-60 grayscale")}
            style={{ objectPosition: s.focus ?? "50% 55%" }}
          />
        ) : s.kind === "cars" && live && s.bodyType ? (
          // A catalogue model whose photos aren't uploaded yet.
          <CarPlaceholder bodyType={asBodyType(s.bodyType)} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Heart aria-hidden className="size-7 text-ink/15" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge tone={view.tone}>{view.label}</Badge>
          {s.kind === "used" && live && <Badge>Used</Badge>}
        </div>
        {s.offers.length > 0 && (
          <span className="absolute bottom-3 left-3 inline-flex h-6 items-center gap-1.5 rounded-full bg-ink/85 px-2.5 text-[11.5px] font-semibold text-white backdrop-blur-sm">
            <Sparkles aria-hidden className="size-3 text-red" />
            {s.offers.length} live {s.offers.length === 1 ? "offer" : "offers"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4 md:p-5">
        <h3 className="text-[15.5px] font-semibold leading-snug tracking-[-0.01em]">
          {s.href ? (
            <Link href={s.href} className="transition-colors hover:text-red">
              {s.title}
            </Link>
          ) : (
            <span className={cn(!live && "text-ink/70")}>{s.title}</span>
          )}
        </h3>
        {s.meta && <p className="mt-1 truncate text-[12.5px] text-muted">{s.meta}</p>}

        {s.price && (
          <div className="mt-3">
            <p className={cn("text-[15px] font-semibold num", !live && "text-ink/60")}>
              {s.kind === "cars" ? formatPriceRange(s.price.min, s.price.max) : formatPrice(s.price.min)}
              <span className="ml-1.5 text-[12px] font-normal text-muted">{s.kind === "cars" ? "ex-showroom" : live ? "asking price" : "last asking price"}</span>
            </p>
            {s.kind === "cars" && live && <OnRoadHint exShowroom={s.price.min} ev={s.ev} />}
            {s.kind === "used" && live && s.newPrice && s.newPrice > s.price.min && (
              <p className="mt-0.5 text-[12px] text-muted">
                <span className="num">{formatPrice(s.newPrice)}</span> when new
              </p>
            )}
          </div>
        )}

        {!live && <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{view.note}</p>}

        {offer && (
          <Link href={offer.href} className="group/offer mt-3 flex items-start gap-2 border-l-2 border-red bg-red-50/60 px-3 py-2 text-[12.5px] transition-colors hover:bg-red-50">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-ink">{offer.headline || offer.title}</span>
              <span className="block truncate text-muted">
                {offer.dealer} · ends {formatDay(offer.endsAt)}
                {s.offers.length > 1 ? ` · +${s.offers.length - 1} more` : ""}
              </span>
            </span>
            <ArrowUpRight aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted transition-colors group-hover/offer:text-red" />
          </Link>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5 [&:not(:first-child)]:mt-4">
          <span className="text-[12px] text-muted">Saved {formatDay(s.savedAt)}</span>
          <SavedCardActions kind={s.kind} itemId={s.itemId} title={s.title} comparable={s.kind === "cars" && live} />
        </div>
      </div>
    </article>
  );
}

/** An intentional empty shelf: what saving does, where to start, and a few cars to begin with. */
export function EmptyShelf({ kind, suggestions }: { kind: "cars" | "used"; suggestions: string[] }) {
  const isNew = kind === "cars";
  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start gap-5 border border-line bg-white p-6 sm:flex-row sm:items-center md:p-8">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-mist">
          <Heart aria-hidden className="size-5 text-red" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-semibold tracking-[-0.01em]">{isNew ? "No new cars saved yet" : "No used cars saved yet"}</h3>
          <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-muted">
            {isNew
              ? "Tap the heart on any model to keep it here, with its price, an on-road estimate for your city and any dealer offers running on it."
              : "Heart pre-owned cars as you browse. We'll keep them here and tell you if one is reserved or sold."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button href={isNew ? "/new-cars" : "/used-cars"} variant="dark" size="sm" arrow>
            {isNew ? "Explore new cars" : "Browse used cars"}
          </Button>
        </div>
      </div>
      {suggestions.length > 0 && (
        <div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{isNew ? "Popular right now" : "Verified listings"}</p>
          <SavedSuggestions kind={kind} ids={suggestions} />
        </div>
      )}
    </div>
  );
}
