"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { CarVideo } from "@/data/car-videos";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/overlay";
import { TextLink } from "@/components/ui/section-heading";

const toSeconds = (duration: string) => {
  const [m, s] = duration.split(":").map(Number);
  return (m || 0) * 60 + (s || 0);
};
const clock = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** Featured + supporting video cards. Each opens a clearly labelled demo player. */
export function CarVideos({ videos }: { videos: CarVideo[] }) {
  const [active, setActive] = useState<CarVideo | null>(null);
  const [open, setOpen] = useState(false);
  const [lead, ...rest] = videos;
  if (!lead) return null;
  const play = (v: CarVideo) => {
    setActive(v);
    setOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <VideoCard video={lead} large onPlay={() => play(lead)} className="lg:col-span-8" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1 lg:gap-6">
          {rest.map((v) => (
            <VideoCard key={v.id} video={v} onPlay={() => play(v)} />
          ))}
        </div>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={active?.title}
        description="Demo player — no video is streamed on this preview site."
        size="xl"
      >
        {active && <MockPlayer key={active.id} video={active} />}
      </Modal>
    </>
  );
}

function VideoCard({ video, large, onPlay, className }: { video: CarVideo; large?: boolean; onPlay: () => void; className?: string }) {
  return (
    <article className={cn("group/video relative flex flex-col", className)}>
      <button
        type="button"
        onClick={onPlay}
        aria-label={`Play video: ${video.title} (${video.duration})`}
        className={cn("relative block w-full overflow-hidden bg-ink-2", large ? "aspect-[16/9]" : "aspect-[16/9] lg:aspect-[16/8]")}
      >
        <Image
          src={video.poster}
          alt=""
          fill
          sizes={large ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"}
          className="object-cover opacity-75 transition-[transform,opacity] duration-[700ms] ease-[var(--ease-premium)] group-hover/video:scale-[1.04] group-hover/video:opacity-90"
        />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
        <span
          aria-hidden
          className={cn(
            "absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink transition-transform duration-[400ms] ease-[var(--ease-premium)] group-hover/video:scale-110",
            large ? "size-20" : "size-14",
          )}
        >
          <Play className={cn("translate-x-0.5 fill-ink", large ? "size-6" : "size-5")} />
        </span>
        <span className="absolute bottom-4 left-4 flex items-center gap-2">
          <Badge tone="glass-dark">{video.kind}</Badge>
          <span className="bg-ink/70 px-2 py-1 text-[11px] font-medium text-white num">{video.duration}</span>
        </span>
      </button>
      <h3 className={cn("mt-4 text-balance", large ? "type-h3" : "type-h4")}>{video.title}</h3>
      {large && <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-white/60">{video.dek}</p>}
    </article>
  );
}

/** Poster + play/pause with an accelerated progress bar. 1 real second ≈ 1/30 of the runtime. */
function MockPlayer({ video }: { video: CarVideo }) {
  const total = toSeconds(video.duration);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let prev: number | null = null;
    const tick = (t: number) => {
      const dt = prev === null ? 0 : t - prev;
      prev = t;
      const next = Math.min(1, progressRef.current + dt / 30_000);
      progressRef.current = next;
      setProgress(next);
      if (next >= 1) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const ended = progress >= 1;
  const toggle = () => {
    if (progressRef.current >= 1) {
      progressRef.current = 0;
      setProgress(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };

  return (
    <div className="bg-ink text-white">
      <div className="relative aspect-video overflow-hidden">
        <Image src={video.poster} alt="" fill sizes="(min-width: 896px) 896px, 100vw" className={cn("object-cover transition-opacity duration-500", playing ? "opacity-90" : "opacity-55")} />
        <span className="absolute left-4 top-4">
          <Badge tone="red">Demo player</Badge>
        </span>
        <button
          type="button"
          onClick={toggle}
          data-autofocus
          aria-label={ended ? "Replay demo" : playing ? "Pause demo" : "Play demo"}
          className={cn(
            "absolute left-1/2 top-1/2 inline-flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink transition-[opacity,transform] duration-[400ms] hover:scale-105",
            playing && "opacity-0 hover:opacity-100 focus-visible:opacity-100",
          )}
        >
          {ended ? <RotateCcw className="size-6" /> : playing ? <Pause className="size-6 fill-ink" /> : <Play className="size-6 translate-x-0.5 fill-ink" />}
        </button>
      </div>
      <div className="flex items-center gap-4 px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={toggle}
          aria-label={ended ? "Replay" : playing ? "Pause" : "Play"}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
        >
          {ended ? <RotateCcw className="size-4" /> : playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
        </button>
        <div
          role="progressbar"
          aria-label="Demo playback progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="relative h-[3px] flex-1 bg-white/15"
        >
          <div className="absolute inset-y-0 left-0 bg-red" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="shrink-0 text-[12px] text-white/60 num">
          {clock(progress * total)} / {video.duration}
        </span>
      </div>
      <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="max-w-xl text-[13px] text-white/55">{video.dek}</p>
        {video.articleSlug && (
          <TextLink href={`/news/${video.articleSlug}`} tone="light" className="shrink-0">
            Read the story
          </TextLink>
        )}
      </div>
    </div>
  );
}
