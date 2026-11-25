"use client";

import Image from "next/image";
import { carPhotoAlt } from "@/lib/image-alt";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { useIsClient, useDialogBehaviour } from "@/components/ui/overlay";

/**
 * Swipeable gallery with thumbnails and a full-screen lightbox.
 * Arrow keys navigate while the gallery or lightbox has focus.
 */
export function ImageGallery({
  images,
  alt,
  className,
  aspect = "aspect-[16/10]",
  focus,
  priority = false,
}: {
  images: string[];
  alt: string;
  className?: string;
  aspect?: string;
  focus?: string;
  priority?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [lightbox, setLightbox] = useState(false);
  const count = images.length;

  const go = useCallback(
    (next: number) => {
      setDir(next > index || (index === count - 1 && next === 0) ? 1 : -1);
      setIndex(((next % count) + count) % count);
    },
    [index, count],
  );

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -400) go(index + 1);
    else if (info.offset.x > 60 || info.velocity.x > 400) go(index - 1);
  };

  return (
    <div className={className}>
      <div
        className={cn("group/gal relative overflow-hidden bg-mist", aspect)}
        tabIndex={0}
        role="group"
        aria-roledescription="image gallery"
        aria-label={`${alt} — image ${index + 1} of ${count}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(index + 1);
          if (e.key === "ArrowLeft") go(index - 1);
        }}
      >
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={index}
            custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 40 }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: d * -40 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.6, ease: EASE }}
            drag={count > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={onDragEnd}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
          >
            <Image
              src={images[index]}
              alt={carPhotoAlt(images[index], alt, `view ${index + 1}`)}
              fill
              preload={priority && index === 0}
              sizes="(min-width: 1024px) 66vw, 100vw"
              className="pointer-events-none object-cover"
              style={{ objectPosition: index === 0 ? (focus ?? "50% 55%") : "50% 50%" }}
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>

        {count > 1 && (
          <>
            <GalleryArrow side="left" onClick={() => go(index - 1)} />
            <GalleryArrow side="right" onClick={() => go(index + 1)} />
          </>
        )}

        <div className="absolute bottom-4 left-4 bg-ink/70 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur-sm num">
          {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </div>
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="absolute bottom-4 right-4 inline-flex items-center gap-2 bg-white/90 px-3 py-2 text-[12px] font-medium text-ink backdrop-blur-sm transition-colors hover:bg-white"
        >
          <Expand className="size-3.5" aria-hidden /> View gallery
        </button>
      </div>

      {count > 1 && (
        <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show image ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "relative aspect-[4/3] w-24 shrink-0 overflow-hidden bg-mist transition-opacity duration-[250ms] md:w-28",
                i === index ? "opacity-100 ring-2 ring-red ring-offset-2" : "opacity-55 hover:opacity-100",
              )}
            >
              <Image src={src} alt="" fill sizes="112px" quality={60} className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <Lightbox open={lightbox} onClose={() => setLightbox(false)} images={images} index={index} onIndex={go} alt={alt} />
    </div>
  );
}

function GalleryArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous image" : "Next image"}
      className={cn(
        "absolute top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink opacity-100 backdrop-blur-sm transition-[opacity,background-color] duration-[250ms] hover:bg-white md:opacity-0 md:group-hover/gal:opacity-100 md:focus-visible:opacity-100",
        side === "left" ? "left-4" : "right-4",
      )}
    >
      {side === "left" ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
    </button>
  );
}

function Lightbox({
  open,
  onClose,
  images,
  index,
  onIndex,
  alt,
}: {
  open: boolean;
  onClose: () => void;
  images: string[];
  index: number;
  onIndex: (i: number) => void;
  alt: string;
}) {
  const isClient = useIsClient();
  const ref = useRef<HTMLDivElement>(null);
  useDialogBehaviour(open, onClose, ref);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onIndex(index + 1);
      if (e.key === "ArrowLeft") onIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, onIndex]);

  if (!isClient) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} gallery`}
          tabIndex={-1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="fixed inset-0 z-[90] flex flex-col bg-ink text-white outline-none"
        >
          <div className="flex items-center justify-between px-5 py-4 md:px-8">
            <p className="text-sm text-white/70">
              <span className="font-medium text-white">{alt}</span> · <span className="num">{index + 1} / {images.length}</span>
            </p>
            <button type="button" onClick={onClose} aria-label="Close gallery" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-white/10">
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
                className="absolute inset-0 mx-4 md:mx-20"
              >
                <Image src={images[index]} alt={carPhotoAlt(images[index], alt, `view ${index + 1}`)} fill sizes="100vw" className="object-contain" />
              </motion.div>
            </AnimatePresence>
            <button type="button" onClick={() => onIndex(index - 1)} aria-label="Previous image" className="absolute left-3 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 md:left-6">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => onIndex(index + 1)} aria-label="Next image" className="absolute right-3 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 md:right-6">
              <ChevronRight className="size-5" />
            </button>
          </div>
          <div className="no-scrollbar flex justify-center gap-2 overflow-x-auto px-5 py-5">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => onIndex(i)}
                aria-label={`Show image ${i + 1}`}
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
