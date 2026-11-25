import Link from "next/link";
import { cn } from "@/lib/utils";
import { PHOTO_CREDITS_PATH, changeLabel, sourceName, type PhotoCredit } from "@/lib/photo-credits";

/* The attribution the photos' licences require (CC BY / CC BY-SA): author, licence (linked), source (linked) and
   what we changed. Server- and client-safe (no hooks). */

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

/**
 * "Photo: Jane Doe · CC BY-SA 4.0 · via Wikimedia Commons · resized · All photo credits" — one small line for the
 * photo being shown. `tone="dark"` for dark backgrounds (the lightbox).
 */
export function PhotoCreditLine({
  credit,
  tone = "light",
  allCredits = true,
  className,
}: {
  credit: PhotoCredit;
  tone?: "light" | "dark";
  /** Append the link to /photo-credits (a string: that page with an anchor, e.g. "/photo-credits#hyundai-creta"). */
  allCredits?: boolean | string;
  className?: string;
}) {
  const dark = tone === "dark";
  const link = cn("underline underline-offset-[3px] transition-colors", dark ? "decoration-white/30 hover:text-white hover:decoration-white" : "decoration-ink/20 hover:text-ink hover:decoration-ink");
  const sep = <span aria-hidden className={dark ? "text-white/30" : "text-ink/25"}> · </span>;
  const change = changeLabel(credit.note);
  return (
    <p className={cn("text-[11.5px] leading-relaxed", dark ? "text-white/60" : "text-muted", className)}>
      Photo:{" "}
      {credit.authorUrl ? (
        <a href={credit.authorUrl} {...ext} className={link}>
          {credit.author}
        </a>
      ) : (
        <span className={dark ? "text-white/80" : "text-ink/75"}>{credit.author}</span>
      )}
      {sep}
      {credit.licenseUrl ? (
        <a href={credit.licenseUrl} {...ext} rel="license noopener noreferrer" className={link}>
          {credit.license}
        </a>
      ) : (
        credit.license
      )}
      {sep}
      via{" "}
      <a href={credit.sourceUrl} {...ext} className={link}>
        {sourceName(credit.sourceUrl)}
      </a>
      {change && (
        <>
          {sep}
          <span title={credit.note ?? undefined}>{change}</span>
        </>
      )}
      {allCredits && (
        <>
          {sep}
          <Link href={typeof allCredits === "string" ? allCredits : PHOTO_CREDITS_PATH} className={link}>
            All photo credits
          </Link>
        </>
      )}
    </p>
  );
}
