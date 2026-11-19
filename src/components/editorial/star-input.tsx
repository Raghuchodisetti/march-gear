"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const LABELS = ["Poor", "Fair", "Good", "Very good", "Excellent"];

/**
 * Accessible 1–5 star input: a radio group with roving focus.
 * Arrow keys change the value, Home/End jump to the ends.
 */
export function StarInput({
  value,
  onChange,
  label = "Overall rating",
  error,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  error?: string;
  className?: string;
}) {
  const id = useId();
  const [hover, setHover] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = hover || value;

  const select = (n: number) => {
    onChange(n);
    buttons.current[n - 1]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = value || 0;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") select(Math.min(5, current + 1));
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") select(Math.max(1, current - 1));
    else if (e.key === "Home") select(1);
    else if (e.key === "End") select(5);
    else return;
    e.preventDefault();
  };

  return (
    <div className={className}>
      <p id={`${id}-label`} className="mb-2 block text-[12.5px] font-medium text-ink">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div
          role="radiogroup"
          aria-labelledby={`${id}-label`}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={error ? true : undefined}
          onKeyDown={onKeyDown}
          onMouseLeave={() => setHover(0)}
          className="-ml-1 flex items-center"
        >
          {LABELS.map((text, i) => {
            const n = i + 1;
            const checked = value === n;
            const focusable = value ? checked : n === 1;
            return (
              <button
                key={n}
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={`${n} star${n > 1 ? "s" : ""} — ${text}`}
                tabIndex={focusable ? 0 : -1}
                onClick={() => onChange(n)}
                onMouseEnter={() => setHover(n)}
                className="group/star rounded-full p-1 transition-transform duration-[250ms] ease-[var(--ease-premium)] hover:scale-110"
              >
                <Star
                  aria-hidden
                  strokeWidth={0}
                  className={cn(
                    "size-8 transition-colors duration-200",
                    n <= shown ? (hover ? "fill-red text-red" : "fill-ink text-ink") : "fill-line text-line",
                  )}
                />
              </button>
            );
          })}
        </div>
        <span className={cn("text-[13px] font-medium", shown ? "text-ink" : "text-muted")} aria-hidden>
          {shown ? LABELS[shown - 1] : "Tap to rate"}
        </span>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-red">
          {error}
        </p>
      )}
    </div>
  );
}
