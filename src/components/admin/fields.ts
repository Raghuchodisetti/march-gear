/* ──────────────────────────────────────────────────────────────
   Declarative field definitions for admin edit forms. Plain data,
   so server pages can fill in options and pass them to the client.
   ────────────────────────────────────────────────────────────── */

export interface Option {
  value: string;
  label: string;
}

interface Base {
  name: string;
  label: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  /** Full width in the two-column grid. */
  wide?: boolean;
}

export type Field =
  | (Base & { type: "text" | "textarea" | "date" | "url" | "image" | "color"; rows?: number; slugFrom?: string })
  | (Base & { type: "number"; step?: number; min?: number; max?: number; prefix?: string; suffix?: string })
  | (Base & { type: "select"; options: Option[]; allowEmpty?: boolean })
  | (Base & { type: "multi"; options: Option[] })
  | (Base & { type: "checkbox" })
  | (Base & { type: "lines"; rows?: number })
  | (Base & { type: "images" })
  | (Base & { type: "rows"; fields: Field[]; addLabel: string; itemTitle?: string })
  | (Base & { type: "group"; fields: Field[]; optionalLabel?: string });

export interface Section {
  title: string;
  description?: string;
  fields: Field[];
}

export type FormValues = Record<string, unknown>;

/** Replaces the options of select/multi fields by name — for options that come from the database. */
export function withOptions(sections: Section[], options: Record<string, Option[]>): Section[] {
  const fill = (f: Field): Field => {
    if ((f.type === "select" || f.type === "multi") && options[f.name]) return { ...f, options: options[f.name] };
    if (f.type === "rows" || f.type === "group") return { ...f, fields: f.fields.map(fill) };
    return f;
  };
  return sections.map((s) => ({ ...s, fields: s.fields.map(fill) }));
}

export const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

export const toOptions = (values: readonly string[]): Option[] => values.map((v) => ({ value: v, label: v }));
