"use client";

import Image from "next/image";
import Link from "next/link";
import { carPhotoAlt } from "@/lib/image-alt";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { useDialogBehaviour, useIsClient } from "@/components/ui/overlay";
import { PhotoCreditLine } from "@/components/vehicle/photo-credit";
import { PHOTO_CREDITS_PATH, isStockPhoto, type CreditMap } from "@/lib/photo-credits";
import { useCarDetail } from "./context";
import { pad2 } from "./utils";

/** Column/row spans for an editorial mosaic, by number of supporting images. */
function spanFor(i: number, count: number) {
  if (i === 0) return count === 1 ? "col-span-2 md:col-span-4 row-span-2" : "col-span-2 row-span-2";
  const rest = count - 1;
  if (rest === 1) return "col-span-2 row-span-2";
  if (rest === 2) return "col-span-2 md:col-span-2";
  if (rest === 3) return i === 3 ? "col-span-2 md:col-span-2" : "col-span-1";
  return "col-span-1";
}

/** Editorial mosaic of every model image; any tile opens a full-screen viewer. */
export function GalleryGrid() {
  const { car, title, credits } = useCarDetail();
  const images = car.images;
  const [open, setOpen] = useState<number | null>(null);
  const credited = images.filter((src) => credits[src]).length;

  return (
    <>
      <div className="grid auto-rows-[38vw] grid-cols-2 gap-2 md:auto-rows-[200px] md:grid-cols-4 md:gap-3 lg:auto-rows-[240px] xl:auto-rows-[280px]">
        {images.map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={() => setOpen(i)}
            className={cn("group/tile relative overflow-hidden bg-mist", spanFor(i, images.length))}
          >
            <span className="sr-only">
              Open {title} image {i + 1} of {images.length}
            </span>
            <Image
              src={src}
              alt=""
              fill
              sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"}
              className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/tile:scale-[1.04]"
              style={{ objectPosition: i === 0 ? (car.focus ?? "50% 55%") : "50% 50%" }}
            />
            <span aria-hidden className="absolute inset-0 bg-ink/0 transition-colors duration-[400ms] group-hover/tile:bg-ink/15" />
            <span aria-hidden className="absolute bottom-3 left-3 bg-white/90 px-2 py-1 text-[11px] font-medium text-ink backdrop-blur-sm num">{pad2(i + 1)}</span>
            {i === 0 && (
              <span aria-hidden className="absolute bottom-3 right-3 inline-flex items-center gap-2 bg-ink/75 px-3 py-2 text-[12px] font-medium text-white backdrop-blur-sm">
                <Expand aria-hidden className="size-3.5" /> {images.length} photos
              </span>
            )}
          </button>
        ))}
      </div>
      {images.some(isStockPhoto) ? (
        <p className="mt-4 text-[12px] text-muted">Photography is representative and may not depict the exact model or specification.</p>
      ) : (
        credited > 0 && (
          <p className="mt-4 text-[12px] text-muted">
            {credited === 1 ? "Photo" : "Photos"} from Wikimedia Commons under free licences. Each photo&apos;s credit is shown when you open it — or see{" "}
            <Link href={PHOTO_CREDITS_PATH} className="underline decoration-ink/20 underline-offset-[3px] hover:text-ink hover:decoration-ink">
              all photo credits
            </Link>
            .
          </p>
        )
      )}
      <Lightbox images={images} title={title} index={open} onIndex={setOpen} credits={credits} />
    </>
  );
}

function Lightbox({
  images,
  title,
  index,
  onIndex,
  credits,
}: {
  images: string[];
  title: string;
  index: number | null;
  onIndex: (i: number | null) => void;
  credits: CreditMap;
}) {
  const isClient = useIsClient();
  const credit = index === null ? undefined : credits[images[index]];
  const ref = useRef<HTMLDivElement>(null);
  const open = index !== null;
  const close = useCallback(() => onIndex(null), [onIndex]);
  useDialogBehaviour(open, close, ref);

  const go = useCallback(
    (delta: number) => {
      if (index === null) return;
      onIndex((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndex],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  if (!isClient) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={`${title} photo gallery`}
          tabIndex={-1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="fixed inset-0 z-[90] flex flex-col bg-ink text-white outline-none"
        >
          <div className="flex items-center justify-between gap-4 px-5 py-4 md:px-8">
            <p className="min-w-0 truncate text-sm text-white/65">
              <span className="font-medium text-white">{title}</span> · <span className="num">{pad2(index + 1)} / {pad2(images.length)}</span>
            </p>
            <button type="button" onClick={close} aria-label="Close gallery" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
              <X className="size-5" />
            </button>
          </div>
          <div className="relative flex-1">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="absolute inset-0 mx-4 md:mx-24"
              >
                <Image src={images[index]} alt={credit?.alt ?? carPhotoAlt(images[index], title, `photo ${index + 1}`)} fill sizes="100vw" className="object-contain" />
              </motion.div>
            </AnimatePresence>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous photo"
                  className="absolute left-3 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 md:left-6"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next photo"
                  className="absolute right-3 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 md:right-6"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}
          </div>
          {credit && <PhotoCreditLine credit={credit} tone="dark" className="px-5 pt-4 text-center" />}
          <div className="no-scrollbar flex justify-center gap-2 overflow-x-auto px-5 py-5">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => onIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                className={cn("relative aspect-[4/3] w-20 shrink-0 overflow-hidden transition-opacity", i === index ? "opacity-100 ring-1 ring-white" : "opacity-40 hover:opacity-80")}
              >
                <Image src={src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
