"use client";

/**
 * Hidden spam trap. People never see or fill it; bots usually do.
 * Pass its value to Server Actions as `website` — the server quietly drops filled-in submissions.
 */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden opacity-0">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}
