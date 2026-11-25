"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { useCatalog } from "@/components/providers/catalog-provider";

const SLIDE_MS = 7000;

/** Slides and headline come from the "homeHero" content block (admin → Site content). */
export function Hero() {
  const { eyebrow, titleFirst, titleSecond, accent, lead, slides } = useCatalog().content.homeHero;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const router = useRouter();

  useEffect(() => {
    if (paused || reduced) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [index, paused, reduced, slides.length]);

  const slide = slides[index] ?? slides[0];
  const position = slide.position || "50% 50%";
  const mobile = slide.mobilePosition || position;

  return (
    <section
      aria-label="Featured"
      className="relative isolate -mt-[72px] flex h-[100svh] max-h-[1000px] min-h-[660px] flex-col overflow-hidden bg-ink text-white"
    >
      {/* Photography — crossfade with a slow cinematic settle */}
      <AnimatePresence initial={false}>
        <motion.div
          key={index}
          className="absolute inset-0 -z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: EASE }}
        >
          <motion.div className="absolute inset-0" initial={{ scale: 1.1 }} animate={{ scale: 1 }} transition={{ duration: 10, ease: EASE }}>
            {/* Colour field: a blurred copy keeps the whole canvas vivid behind the type */}
            <Image
              src={slide.image}
              alt=""
              fill
              sizes="50vw"
              quality={60}
              className="hidden scale-110 object-cover blur-2xl saturate-[1.2] md:block"
              style={{ objectPosition: position }}
            />
            {/* The car itself, sharp, set right of the headline on desktop */}
            <div className="absolute inset-0 md:left-[26%] md:[mask-image:linear-gradient(to_right,transparent,black_24%)]">
              <Image
                src={slide.image}
                alt=""
                fill
                preload={index === 0}
                quality={85}
                sizes="(min-width: 768px) 74vw, 100vw"
                className="object-cover [object-position:var(--pos-m)] md:[object-position:var(--pos-d)]"
                style={{ ["--pos-m" as string]: mobile, ["--pos-d" as string]: position }}
              />
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Light-touch shading: enough for legibility, not enough to dull the colour */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/55 via-ink/15 to-transparent md:from-ink/45" />
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-ink/50 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-64 bg-gradient-to-t from-ink/55 to-transparent" />

      <div className="container-x flex flex-1 flex-col pb-28 pt-[128px] md:pt-[150px] lg:pt-[168px]">
        <div className="max-w-2xl [text-shadow:0_2px_30px_rgb(0_0_0/0.25)]">
          <p className="type-eyebrow flex animate-rise items-center gap-3 text-white/90 [animation-delay:150ms]">
            <span aria-hidden className="h-px w-8 bg-red" />
            {eyebrow}
          </p>
          <h1 className="mt-6 font-display text-[clamp(2.9rem,1.5rem+4.6vw,6rem)] font-semibold leading-[0.95] tracking-[-0.035em] [font-stretch:112%]">
            <Line delay={0.25}>{titleFirst}</Line>
            <Line delay={0.4}>
              <Accented text={titleSecond} accent={accent} />
            </Line>
          </h1>
          <p className="type-lead mt-6 max-w-md animate-rise text-white/90 [animation-delay:650ms] [animation-duration:1.2s]">{lead}</p>
        </div>

        {/* Chapter cards — jump between campaigns; the active one shows its timer */}
        <div className="mt-auto flex items-end justify-between gap-6" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div
            role="tablist"
            aria-label="Featured campaigns"
            className="hidden w-full max-w-2xl gap-3 md:grid"
            style={{ gridTemplateColumns: `repeat(${slides.length}, minmax(0, 1fr))` }}
          >
            {slides.map((s, i) => {
              const on = i === index;
              return (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => (on ? router.push(s.href) : setIndex(i))}
                  className={cn(
                    "relative overflow-hidden border px-4 pb-4 pt-3.5 text-left backdrop-blur-md transition-[background-color,border-color] duration-[400ms]",
                    on ? "border-white/40 bg-white/20" : "border-white/15 bg-white/[0.07] hover:bg-white/15",
                  )}
                >
                  {/* The accessible name keeps the visible text (label in name) behind a short verb. */}
                  <span className="sr-only">{on ? "Explore: " : "Show: "}</span>
                  <span className="flex items-center justify-between text-[11px] font-medium text-white/70 num">
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {on && <ArrowUpRight className="size-3.5 text-white" aria-hidden />}
                  </span>
                  <span className="mt-2 block text-[12px] text-white/75">{s.chapter}</span>
                  <span className="mt-0.5 block font-display text-[16px] font-semibold tracking-[-0.01em]">{s.title}</span>
                  <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white/15">
                    {on && (
                      <motion.span
                        key={`${index}-${paused}`}
                        className="absolute inset-y-0 left-0 bg-red"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: paused || reduced ? 0 : SLIDE_MS / 1000, ease: "linear" }}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mobile: compact caption + dots */}
          <div className="flex w-full items-center justify-between md:hidden">
            <Link href={slide.href} className="text-[13px] font-medium text-white/90">
              {slide.chapter} · <span className="underline underline-offset-4">{slide.title}</span>
            </Link>
            <div className="flex gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Show ${s.title}`}
                  className={cn("h-1.5 rounded-full transition-all duration-[400ms]", i === index ? "w-6 bg-white" : "w-1.5 bg-white/50")}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The second headline line, with the accent word set in the italic serif. */
function Accented({ text, accent }: { text: string; accent: string }) {
  const at = accent ? text.indexOf(accent) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="type-editorial pr-[0.04em] text-[1.08em] font-normal">{accent}</span>
      {text.slice(at + accent.length)}
    </>
  );
}

/** Masked line reveal — pure CSS so the headline paints before hydration. */
function Line({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <span className="block overflow-hidden pb-[0.06em]">
      <span className="block animate-line" style={{ animationDelay: `${delay}s` }}>
        {children}
      </span>
    </span>
  );
}
