import { z } from "zod";
import type { Section } from "@/components/admin/fields";

/* ──────────────────────────────────────────────────────────────
   Editable site content. Each block is one JSON document in the
   `site_content` table, edited at /admin/content/<key>.

   - `schema`   validates what admins save (server-side only)
   - `defaults` the launch copy, used until someone saves the block
   - `sections` the admin form layout (see components/admin/fields.ts)

   Keep stored shapes form-friendly (plain objects, arrays of rows,
   string arrays for "one per line" lists) so the generic admin
   form can edit them without mapping.

   Public code reads blocks through the catalogue:
   `(await getCatalog()).content.<key>` on the server,
   `useCatalog().content.<key>` in client components.
   Import block files only as types from public code, so Zod and the
   defaults never ship to the browser.
   ────────────────────────────────────────────────────────────── */

export type BlockGroup = "Site" | "Home" | "Pages" | "PDI" | "Pricing & tools" | "Insurance" | "Editorial" | "Legal";

export interface ContentBlock<S extends z.ZodType = z.ZodType> {
  key: string;
  title: string;
  group: BlockGroup;
  description: string;
  /** Where it shows up, for the admin list (e.g. ["Footer", "/contact"]). */
  usedOn: string[];
  schema: S;
  defaults: z.output<S>;
  sections: Section[];
}

export const defineBlock = <S extends z.ZodType>(block: ContentBlock<S>) => block;

/* ── Field rules shared by block schemas ────────────────────── */

export const text = (label: string, max = 300) =>
  z.string({ error: `Enter the ${label}` }).trim().min(1, `Enter the ${label}`).max(max, `Keep the ${label} under ${max} characters`);

export const optionalText = (max = 300) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .nullish()
    .transform((v) => v ?? "");

/** A "one per line" list: blank lines are dropped. */
export const lines = (max = 500) =>
  z
    .array(z.string())
    .default([])
    .transform((a) => a.map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(max, `Keep each line under ${max} characters`)));

/** https:// URL or a /path on this site (no protocol-relative //host). */
export const link = (label = "link") =>
  z
    .string({ error: `Enter the ${label}` })
    .trim()
    .min(1, `Enter the ${label}`)
    .max(500)
    .refine((v) => /^(https:\/\/|\/(?![\/\\])|mailto:|tel:)/.test(v), "Use a full https:// link or a /path on this site");

export const optionalLink = () =>
  z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => v ?? "")
    .refine((v) => v === "" || /^(https:\/\/|\/(?![\/\\]))/.test(v), "Use a full https:// link or a /path on this site");

export const image = (label = "image") => link(`${label} URL`);

export const number = (label: string, min = 0, max = 1e9) =>
  z.number({ error: `Enter the ${label}` }).min(min, `The ${label} can't be below ${min}`).max(max, `The ${label} can't be above ${max}`);

export const flag = z.boolean().default(false);

/** A list of rows with at least `min` entries. */
export const rows = <T extends z.ZodType>(row: T, label: string, min = 0) =>
  z.array(row).min(min, min === 1 ? `Add at least one ${label}` : `Add at least ${min} ${label}s`);
