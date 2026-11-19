import "server-only";
import { z } from "zod";
import type { ActionFailure } from "@/lib/action-result";

/* Shared field rules for Server Actions. */

// Plain-English fallbacks for rules without their own message (field-level messages still win).
z.config({
  customError: (iss) => {
    if (iss.code === "too_big" && iss.origin === "string") return `Keep this under ${iss.maximum} characters`;
    if (iss.code === "too_big" && iss.origin === "number") return `This can't be more than ${iss.maximum}`;
    if (iss.code === "too_small" && iss.origin === "number") return `This can't be less than ${iss.minimum}`;
    if (iss.code === "too_small" && iss.origin === "string") return "Please fill this in";
    if (iss.code === "invalid_type" && iss.input === undefined) return "Please fill this in";
    return undefined;
  },
});

export const name = z.string().trim().min(2, "Enter your full name").max(120, "That name is too long");
export const email = z.string().trim().toLowerCase().max(190).email("Enter a valid email address");
export const mobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""))
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit mobile number");
// bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated.
export const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .refine((v) => new TextEncoder().encode(v).length <= 72, "Use 72 characters or fewer");
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

/** Turns a Zod error into `{ field: "first message" }` for the form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}

export function invalid(error: z.ZodError): ActionFailure {
  return { ok: false, error: "Please check the highlighted fields.", fieldErrors: fieldErrors(error) };
}

export const todayISO = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10); // IST
