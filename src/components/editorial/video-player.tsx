"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Maximize2, Minimize2, Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { Modal } from "@/components/ui/overlay";
import { cn, clamp } from "@/lib/utils";
import { EASE } from "@/lib/motion";

/* ──────────────────────────────────────────────────────────────
   A mock video player. There is no media file: playback is a
   timer that advances a progress bar against the stated running
   time, so the interaction can be demonstrated end to end.
   ────────────────────────────────────────────────────────────── */

/** "14:32" or "1:02:10" → seconds */
export function parseDuration(value: string) {
  return value
    .split(":")
    .map((n) => Number(n))
    .reduce((acc, n) => acc * 60 + (Number.isFinite(n) ? n : 0), 0);
}

/** seconds → "4:05" or "1:02:10" */
export function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

type Status = "idle" | "playing" | "paused" | "ended";

interface Playback {
  status: Status;
  elapsed: number;
  muted: boolean;
  total: number;
}

type Action =
  | { type: "toggle" }
  | { type: "pause" }
  | { type: "tick"; dt: number }
  | { type: "seek"; to: number }
  | { type: "mute" };

function reducer(state: Playback, action: Action): Playback {
  switch (action.type) {
    case "toggle":
      if (state.status === "playing") return { ...state, status: "paused" };
      if (state.status === "ended") return { ...state, status: "playing", elapsed: 0 };
      return { ...state, status: "playing" };
    case "pause":
      return state.status === "playing" ? { ...state, status: "paused" } : state;
    case "tick": {
      if (state.status !== "playing") return state;
      const next = state.elapsed + action.dt;
      return next >= state.total ? { ...state, elapsed: state.total, status: "ended" } : { ...state, elapsed: next };
    }
    case "seek": {
      const to = clamp(action.to, 0, state.total);
      const status: Status =
        to >= state.total ? "ended" : state.status === "idle" || state.status === "ended" ? "paused" : state.status;
      return { ...state, elapsed: to, status };
    }
    case "mute":
      return { ...state, muted: !state.muted };
  }
}

const TICK = 0.25;

export interface VideoPlayerProps {
  poster: string;
  title: string;
  /** Running time as "mm:ss" */
  duration: string;
  /** Optional link shown in the expanded view */
  href?: string;
  sizes?: string;
  preload?: boolean;
  autoPlay?: boolean;
  /** Allow the theatre (expanded) view. Off when the player already lives in a modal. */
  expandable?: boolean;
  focus?: string;
  className?: string;
}

export function VideoPlayer({
  poster,
  title,
  duration,
  href,
  sizes = "(min-width: 1024px) 66vw, 100vw",
  preload = false,
  autoPlay = false,
  expandable = true,
  focus,
  className,
}: VideoPlayerProps) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    status: autoPlay ? ("playing" as const) : ("idle" as const),
    elapsed: 0,
    muted: false,
    total: Math.max(1, parseDuration(duration)),
  }));
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (state.status !== "playing") return;
    const id = window.setInterval(() => dispatch({ type: "tick", dt: TICK }), TICK * 1000);
    return () => window.clearInterval(id);
  }, [state.status]);

  const surface = (variant: "inline" | "theatre") => (
    <PlayerSurface
      state={state}
      dispatch={dispatch}
      poster={poster}
      title={title}
      sizes={variant === "theatre" ? "100vw" : sizes}
      preload={variant === "inline" && preload}
      focus={focus}
      variant={variant}
      expanded={expanded}
      onExpand={expandable ? () => setExpanded((v) => !v) : undefined}
    />
  );

  return (
    <div className={className}>
      {expanded ? (
        <div className="relative aspect-video w-full overflow-hidden bg-ink text-white">
          <Image src={poster} alt="" fill sizes={sizes} className="object-cover opacity-25" style={{ objectPosition: focus ?? "50% 50%" }} />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="type-eyebrow text-white/60">Playing in theatre view</p>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex h-10 items-center gap-2 rounded-[3px] border border-white/30 px-4 text-[13px] font-medium transition-colors duration-[250ms] hover:border-white hover:bg-white hover:text-ink"
            >
              <Minimize2 className="size-4" aria-hidden /> Return to page
            </button>
          </div>
        </div>
      ) : (
        surface("inline")
      )}

      {expandable && (
        <Modal open={expanded} onClose={() => setExpanded(false)} title={title} bare size="xl" className="max-w-6xl bg-ink text-white">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
            <p className="min-w-0 truncate text-[13px] text-white/70">{title}</p>
            <div className="flex shrink-0 items-center gap-1">
              {href && (
                <Link
                  href={href}
                  onClick={() => setExpanded(false)}
                  className="hidden h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex"
                >
                  Read the story <ArrowUpRight className="size-3.5 text-red" aria-hidden />
                </Link>
              )}
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Close theatre view"
                className="inline-flex size-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
          </div>
          {surface("theatre")}
        </Modal>
      )}
    </div>
  );
}

function PlayerSurface({
  state,
  dispatch,
  poster,
  title,
  sizes,
  preload,
  focus,
  variant,
  expanded,
  onExpand,
}: {
  state: Playback;
  dispatch: (a: Action) => void;
  poster: string;
  title: string;
  sizes: string;
  preload: boolean;
  focus?: string;
  variant: "inline" | "theatre";
  expanded: boolean;
  onExpand?: () => void;
}) {
  const { status, elapsed, total, muted } = state;
  const playing = status === "playing";
  const pct = (elapsed / total) * 100;
  const progress = elapsed / total;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).getAttribute("role") === "slider") return;
    const key = e.key.toLowerCase();
    if (key === "k") dispatch({ type: "toggle" });
    else if (key === "m") dispatch({ type: "mute" });
    else if (key === "f" && onExpand) onExpand();
    else if (key === "arrowright") dispatch({ type: "seek", to: elapsed + 10 });
    else if (key === "arrowleft") dispatch({ type: "seek", to: elapsed - 10 });
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="region"
      aria-label={`Video player: ${title}`}
      onKeyDown={onKeyDown}
      className={cn("group/player relative isolate aspect-video w-full overflow-hidden bg-ink text-white", variant === "theatre" && "max-h-[78dvh]")}
    >
      <Image
        src={poster}
        alt=""
        fill
        sizes={sizes}
        preload={preload}
        className={cn(
          "-z-10 object-cover transition-[transform,opacity] duration-300 ease-linear",
          status === "idle" ? "opacity-90" : "opacity-75",
        )}
        style={{
          objectPosition: focus ?? "50% 50%",
          // Simulated camera move tied to playback, so it pauses and seeks with the timeline.
          transform: `scale(${1 + progress * 0.14}) translateX(${-progress * 2.5}%)`,
        }}
      />
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10 bg-gradient-to-t from-ink/90 via-ink/10 to-ink/40 transition-opacity duration-500",
          playing ? "opacity-70" : "opacity-100",
        )}
      />

      {/* Whole surface toggles playback */}
      <button
        type="button"
        onClick={() => dispatch({ type: "toggle" })}
        aria-label={playing ? `Pause ${title}` : status === "ended" ? `Replay ${title}` : `Play ${title}`}
        className="absolute inset-0 z-10 flex items-center justify-center focus-visible:outline-offset-[-4px]"
      >
        <AnimatePresence>
          {!playing && (
            <motion.span
              key={status === "ended" ? "replay" : "play"}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.08 }}
              transition={{ duration: 0.35, ease: EASE }}
              className={cn(
                "flex items-center justify-center rounded-full bg-white text-ink transition-colors duration-[250ms] group-hover/player:bg-red group-hover/player:text-white",
                variant === "theatre" ? "size-24" : "size-16 md:size-24",
              )}
            >
              {status === "ended" ? (
                <RotateCcw className="size-6 md:size-7" aria-hidden />
              ) : (
                <Play className="ml-1 size-6 fill-current md:size-8" aria-hidden />
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Top row */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-3 md:p-5">
        <span className="inline-flex h-7 items-center gap-2 rounded-[2px] bg-ink/60 px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
          <span aria-hidden className={cn("size-1.5 rounded-full", playing ? "bg-red" : "bg-white/50")} />
          Demo playback
        </span>
        {status === "idle" && (
          <span className="inline-flex h-7 items-center rounded-[2px] bg-ink/60 px-2.5 text-[12px] font-medium backdrop-blur-sm num">{formatClock(total)}</span>
        )}
      </div>

      {/* Controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 px-3 pb-2 pt-8 transition-opacity duration-300 md:px-5 md:pb-3",
          status === "idle" ? "pointer-events-none opacity-0" : "opacity-100",
          playing && "md:opacity-0 md:group-hover/player:opacity-100 md:group-focus-within/player:opacity-100",
        )}
      >
        <SeekBar elapsed={elapsed} total={total} pct={pct} onSeek={(to) => dispatch({ type: "seek", to })} disabled={status === "idle"} />
        <div className="mt-1 flex items-center gap-1">
          <ControlButton label={playing ? "Pause" : status === "ended" ? "Replay" : "Play"} onClick={() => dispatch({ type: "toggle" })} disabled={status === "idle"}>
            {playing ? <Pause className="size-[18px] fill-current" /> : status === "ended" ? <RotateCcw className="size-[18px]" /> : <Play className="size-[18px] fill-current" />}
          </ControlButton>
          <ControlButton label={muted ? "Unmute" : "Mute"} onClick={() => dispatch({ type: "mute" })} pressed={muted} disabled={status === "idle"}>
            {muted ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
          </ControlButton>
          <p className="ml-1.5 text-[12px] font-medium text-white/85 num">
            {formatClock(elapsed)} <span className="text-white/45">/ {formatClock(total)}</span>
          </p>
          <span className="flex-1" />
          {onExpand && (
            <ControlButton label={expanded ? "Exit theatre view" : "Theatre view"} onClick={onExpand} disabled={status === "idle"}>
              {expanded ? <Minimize2 className="size-[18px]" /> : <Maximize2 className="size-[18px]" />}
            </ControlButton>
          )}
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
  pressed,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      className="inline-flex size-9 items-center justify-center rounded-full text-white transition-colors duration-[250ms] hover:bg-white/15 [&>svg]:shrink-0"
    >
      {children}
    </button>
  );
}

function SeekBar({
  elapsed,
  total,
  pct,
  onSeek,
  disabled,
}: {
  elapsed: number;
  total: number;
  pct: number;
  onSeek: (to: number) => void;
  disabled?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const seekTo = (clientX: number) => {
    const el = track.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    onSeek(((clientX - rect.left) / rect.width) * total);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekTo(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) seekTo(e.clientX);
  };
  const stop = () => {
    dragging.current = false;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 30 : 5;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") onSeek(elapsed + step);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") onSeek(elapsed - step);
    else if (e.key === "Home") onSeek(0);
    else if (e.key === "End") onSeek(total);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={track}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      aria-valuenow={Math.round(elapsed)}
      aria-valuetext={`${formatClock(elapsed)} of ${formatClock(total)}`}
      aria-disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={onKeyDown}
      className="group/seek relative flex h-5 cursor-pointer touch-none items-center"
    >
      <div className="relative h-[3px] w-full bg-white/20 transition-[height] duration-200 group-hover/seek:h-[5px]">
        <div className="absolute inset-y-0 left-0 bg-red" style={{ width: `${pct}%` }} />
      </div>
      <span
        aria-hidden
        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 transition-opacity duration-200 group-hover/seek:opacity-100 group-focus-visible/seek:opacity-100"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

/**
 * A modal "screening room": pass the active film (or null). The player
 * auto-starts and is re-mounted per film so each opens from 0:00.
 */
export function VideoLightbox({
  video,
  onClose,
}: {
  video: { slug: string; title: string; poster: string; duration: string; href: string; dek?: string } | null;
  onClose: () => void;
}) {
  return (
    <Modal open={video !== null} onClose={onClose} title={video?.title ?? "Video"} bare size="xl" className="max-w-6xl bg-ink text-white">
      {video && (
        <div>
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
            <p className="type-eyebrow text-white/55">March Gear Films</p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close video"
              data-autofocus
              className="inline-flex size-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <VideoPlayer key={video.slug} poster={video.poster} title={video.title} duration={video.duration} sizes="100vw" autoPlay expandable={false} />
          <div className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-5 sm:py-6">
            <div className="max-w-2xl">
              <h2 className="type-h3 text-balance">{video.title}</h2>
              {video.dek && <p className="mt-2 line-clamp-2 text-[14px] text-white/60">{video.dek}</p>}
            </div>
            <Link
              href={video.href}
              onClick={onClose}
              className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-[3px] border border-white/30 px-4 text-[13px] font-medium transition-colors duration-[250ms] hover:border-white hover:bg-white hover:text-ink sm:self-auto"
            >
              Read the story <ArrowUpRight className="size-4 text-red" aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}
