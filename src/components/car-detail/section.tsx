import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "light" | "mist" | "dark";

/**
 * Numbered editorial section used by the model and variant pages. Each section
 * is an anchor target for the in-page navigation (scroll-margin matches the
 * sticky header + section nav when arriving via a hash link).
 */
export function DetailSection({
  id,
  index,
  eyebrow,
  title,
  description,
  tone = "light",
  divider = true,
  size = "compact",
  className,
  children,
}: {
  id: string;
  index?: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  tone?: Tone;
  divider?: boolean;
  size?: "compact" | "large";
  className?: string;
  children: ReactNode;
}) {
  const dark = tone === "dark";
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        "scroll-mt-8",
        tone === "light" && "bg-white",
        tone === "mist" && "bg-mist",
        dark && "bg-ink text-white",
        className,
      )}
    >
      <div className="container-x">
        <div
          className={cn(
            size === "large" ? "py-20 md:py-28" : "py-14 md:py-20",
            divider && tone === "light" && "border-t border-line",
            divider && dark && "border-t border-white/10",
          )}
        >
          <SectionTitle id={id} index={index} eyebrow={eyebrow} title={title} description={description} dark={dark} />
          <div className="mt-10 md:mt-14">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function SectionTitle({
  id,
  index,
  eyebrow,
  title,
  description,
  dark,
}: {
  id: string;
  index?: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  dark?: boolean;
}) {
  return (
    <header className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-end lg:gap-10">
      <div className="lg:col-span-7">
        <p className={cn("type-eyebrow flex items-center gap-3", dark ? "text-white" : "text-ink")}>
          {index && <span className="num text-red">{index}</span>}
          <span aria-hidden className={cn("h-px w-6", dark ? "bg-white/30" : "bg-ink/25")} />
          {eyebrow}
        </p>
        <h2 id={`${id}-title`} className="type-h2 mt-5 text-balance">
          {title}
        </h2>
      </div>
      {description && (
        <div className="lg:col-span-5">
          <p className={cn("max-w-md text-[15px] leading-relaxed text-pretty lg:ml-auto", dark ? "text-white/60" : "text-muted")}>
            {description}
          </p>
        </div>
      )}
    </header>
  );
}

/** Hairline definition row used by spec tables. */
export function SpecRow({ label, value, dark }: { label: string; value: ReactNode; dark?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-6 border-b py-3.5 text-[14px]", dark ? "border-white/10" : "border-line")}>
      <dt className={dark ? "text-white/55" : "text-muted"}>{label}</dt>
      <dd className="text-right font-medium num">{value}</dd>
    </div>
  );
}
