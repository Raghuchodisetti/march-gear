"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * Six single-digit boxes with auto-advance, backspace-to-previous,
 * arrow-key navigation and paste / SMS autofill across all boxes.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  describedBy,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const length = value.length;

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const focusAt = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };

  const commit = (next: string[]) => {
    onChange(next);
    if (next.every((d) => d !== "")) onComplete?.(next.join(""));
  };

  /** Spread a run of digits across the boxes starting at `from`. */
  const fill = (from: number, digits: string) => {
    const next = [...value];
    let i = from;
    for (const d of digits) {
      if (i >= length) break;
      next[i++] = d;
    }
    commit(next);
    focusAt(Math.min(i, length - 1));
  };

  const onInput = (i: number, raw: string) => {
    let digits = raw.replace(/\D/g, "");
    // Typing over an existing digit without selecting it: keep only the new key.
    if (digits.length === 2 && value[i] && digits.includes(value[i])) digits = digits.replace(value[i], "");
    if (digits.length > 1) return fill(i, digits);
    const next = [...value];
    next[i] = digits;
    commit(next);
    if (digits) focusAt(i + 1);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...value];
      if (next[i]) {
        next[i] = "";
        onChange(next);
      } else if (i > 0) {
        next[i - 1] = "";
        onChange(next);
        focusAt(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(i + 1);
    }
  };

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!digits) return;
    e.preventDefault();
    // A full code pasted anywhere fills from the first box.
    fill(digits.length >= length ? 0 : i, digits);
  };

  return (
    <div role="group" aria-label="One-time code" aria-describedby={describedBy} className="grid grid-cols-6 gap-2 sm:gap-3">
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={digit}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(
            "aspect-square w-full min-w-0 rounded-[3px] border bg-white text-center font-display text-[22px] font-semibold text-ink outline-none transition-[border-color,background-color] duration-[250ms] num focus:border-ink disabled:opacity-50 sm:text-[26px]",
            invalid ? "border-red" : digit ? "border-ink/40" : "border-line hover:border-ink/30",
          )}
        />
      ))}
    </div>
  );
}
