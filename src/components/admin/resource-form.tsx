"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, ImageOff, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Label, SelectField, TextField } from "@/components/ui/field";
import { useUI } from "@/components/providers/app-provider";
import { slugify, type Field, type FormValues, type Section } from "./fields";
import { MediaPickerButton } from "./media-picker";

type SaveAction = (values: FormValues) => Promise<ActionResult<{ id: string | number }>>;

const HEX = /^#[0-9a-f]{6}$/i;

const inputClass =
  "w-full rounded-[3px] border border-line bg-white px-3.5 text-[14px] text-ink placeholder:text-muted outline-none transition-[border-color] duration-200 hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red";

function emptyValue(f: Field): unknown {
  switch (f.type) {
    case "number":
      return null;
    case "checkbox":
      return false;
    case "multi":
    case "lines":
    case "images":
    case "rows":
      return [];
    case "group":
      return f.optionalLabel ? null : Object.fromEntries(f.fields.map((x) => [x.name, emptyValue(x)]));
    default:
      return "";
  }
}

export function ResourceForm({
  sections,
  initial,
  action,
  listHref,
  createdHref,
  submitLabel = "Save changes",
  aside,
}: {
  sections: Section[];
  initial: FormValues;
  action: SaveAction;
  /** Where Cancel goes. */
  listHref: string;
  /** For new records: where to go after the first save, with `:id` replaced. */
  createdHref?: string;
  submitLabel?: string;
  aside?: ReactNode;
}) {
  const router = useRouter();
  const { toast } = useUI();
  const [values, setValues] = useState<FormValues>(() => {
    const v: FormValues = { ...initial };
    for (const s of sections) for (const f of s.fields) if (!(f.name in v)) v[f.name] = emptyValue(f);
    return v;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Bumped after a failed save, so the effect below scrolls once the new errors are on screen.
  const [errorScroll, setErrorScroll] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // The field that auto-fills from another (e.g. slug from name) until edited by hand.
  const slugField = sections.flatMap((s) => s.fields).find((f) => f.type === "text" && f.slugFrom)?.name;
  const [slugTouched, setSlugTouched] = useState(Boolean(slugField && initial[slugField]));

  useEffect(() => {
    if (!errorScroll) return;
    // The highest field with an error (issue order isn't always page order)…
    const first = Object.keys(errors)
      .map(fieldElement)
      .filter((el): el is Element => el !== null)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))[0];
    // …then its first marked control or message: a whole list of rows is taller than the screen, and its own message sits at the bottom.
    (first?.querySelector('[aria-invalid="true"], [data-error]') ?? first)?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Only after a save attempt, not as errors clear while editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorScroll]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** Drops the error for a field once it's edited; `nested` also drops its rows' errors (their indexes may have shifted). */
  const clearError = (path: string, nested = false) =>
    setErrors((prev) => {
      const keys = Object.keys(prev).filter((k) => k === path || (nested && k.startsWith(`${path}.`)));
      if (!keys.length) return prev;
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });

  const set = (name: string, value: unknown) => {
    setDirty(true);
    // Keep the slug in step with the name until someone edits it by hand.
    const follower = slugTouched ? undefined : sections.flatMap((s) => s.fields).find((f) => f.type === "text" && f.slugFrom === name)?.name;
    setValues((prev) => ({ ...prev, [name]: value, ...(follower && { [follower]: slugify(String(value ?? "")) }) }));
    if (follower) clearError(follower);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await action(values);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast(res.error ?? "Couldn't save. Check the highlighted fields.", { tone: "error" });
        setErrorScroll((n) => n + 1);
        return;
      }
      setDirty(false);
      setErrors({});
      toast("Saved", { tone: "success" });
      if (createdHref) router.push(createdHref.replace(":id", String(res.id)));
      else router.refresh();
    } catch {
      toast("Couldn't reach the server. Please try again.", { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="pb-28">
      <div className={cn("grid grid-cols-1 gap-6", aside && "xl:grid-cols-[minmax(0,1fr)_320px]")}>
        <div className="min-w-0 space-y-6">
          {sections.map((s) => (
            <section key={s.title} className="border border-line bg-white">
              <header className="border-b border-line px-5 py-4 md:px-6">
                <h2 className="text-[15px] font-semibold">{s.title}</h2>
                {s.description && <p className="mt-0.5 text-[13px] text-muted">{s.description}</p>}
              </header>
              <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 md:p-6">
                {s.fields.map((f) => (
                  <FieldInput
                    key={f.name}
                    field={f}
                    path={f.name}
                    value={values[f.name]}
                    errors={errors}
                    clearError={clearError}
                    onChange={(v) => {
                      if (f.name === slugField) setSlugTouched(true);
                      set(f.name, v);
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
        {aside && <aside className="space-y-6">{aside}</aside>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:left-64">
        <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-8">
          <p className="text-[13px] text-muted" aria-live="polite">
            {saving ? "Saving…" : dirty ? <span className="text-ink">Unsaved changes</span> : "All changes saved"}
          </p>
          <div className="flex gap-2">
            <Button href={listHref} variant="ghost" size="sm">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving} icon={saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}>
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

/** The element for a field error key; nested keys (e.g. "images.1") fall back to the closest field on screen. */
function fieldElement(key: string): Element | null {
  const parts = key.split(".");
  for (let n = parts.length; n > 0; n--) {
    const el = document.querySelector(`[data-field="${CSS.escape(parts.slice(0, n).join("."))}"]`);
    if (el) return el;
  }
  return null;
}

function ErrorText({ path, errors, id, className }: { path: string; errors: Record<string, string>; id?: string; className?: string }) {
  const msg = errors[path];
  return msg ? (
    <p id={id} data-error className={cn("mt-1.5 text-xs text-red", className)}>
      {msg}
    </p>
  ) : null;
}

function FieldInput({
  field: f,
  path,
  value,
  errors,
  clearError,
  onChange: setValue,
}: {
  field: Field;
  path: string;
  value: unknown;
  errors: Record<string, string>;
  clearError: (path: string, nested?: boolean) => void;
  onChange: (v: unknown) => void;
}) {
  const id = useId();
  const wide = f.wide || f.type === "textarea" || f.type === "lines" || f.type === "images" || f.type === "rows" || f.type === "group" || f.type === "multi";
  const err = errors[path];
  const errId = err ? `${id}-err` : undefined;
  const label = `${f.label}${f.required ? "" : f.type === "checkbox" || f.type === "rows" || f.type === "group" ? "" : " (optional)"}`;
  const onChange = (v: unknown) => {
    clearError(path);
    setValue(v);
  };
  const wrap = (node: ReactNode) => (
    <div data-field={path} className={cn("min-w-0", wide && "sm:col-span-2")}>
      {node}
    </div>
  );

  switch (f.type) {
    case "text":
    case "url":
    case "date":
      return wrap(
        <TextField
          label={label}
          type={f.type === "text" ? "text" : f.type}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder}
          hint={f.hint}
          error={err}
        />,
      );
    case "color":
      return wrap(
        <div>
          <Label htmlFor={id}>{label}</Label>
          <div className="flex gap-2">
            {/* The picker only accepts #rrggbb; while the text box holds anything else (half-typed, "red"…) it shows the fallback. */}
            <input
              type="color"
              aria-label={`${f.label} picker`}
              value={HEX.test(String(value ?? "")) ? String(value) : "#111111"}
              onChange={(e) => onChange(e.target.value)}
              className="h-12 w-14 shrink-0 cursor-pointer rounded-[3px] border border-line bg-white p-1"
            />
            <input id={id} className={cn(inputClass, "h-12")} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder="#111111" aria-invalid={err ? true : undefined} aria-describedby={errId} />
          </div>
          <ErrorText id={errId} path={path} errors={errors} />
        </div>,
      );
    case "image":
      return wrap(
        <div className="flex gap-3">
          <Preview src={String(value ?? "")} />
          <div className="min-w-0 flex-1">
            <TextField label={label} type="url" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder="https://… or upload one" hint={f.hint} error={err} />
            <MediaPickerButton className="mt-2" onPick={([url]) => url && onChange(url)} />
          </div>
        </div>,
      );
    case "textarea":
      return wrap(
        <div>
          <Label htmlFor={id}>{label}</Label>
          <textarea
            id={id}
            className={cn(inputClass, "min-h-28 py-3 leading-relaxed")}
            rows={f.rows ?? 4}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={f.placeholder}
            aria-invalid={err ? true : undefined}
            aria-describedby={errId}
          />
          {f.hint && !err && <p className="mt-1.5 text-xs text-muted">{f.hint}</p>}
          <ErrorText id={errId} path={path} errors={errors} />
        </div>,
      );
    case "number":
      return wrap(
        <div>
          <Label htmlFor={id}>{label}</Label>
          <div className="relative">
            {f.prefix && <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-muted">{f.prefix}</span>}
            <input
              id={id}
              type="number"
              inputMode="decimal"
              step={f.step ?? 1}
              min={f.min}
              max={f.max}
              value={value === null || value === undefined ? "" : String(value)}
              onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
              placeholder={f.placeholder}
              aria-invalid={err ? true : undefined}
              aria-describedby={errId}
              className={cn(inputClass, "h-12 num", f.prefix && "pl-8", f.suffix && "pr-14")}
            />
            {f.suffix && <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[13px] text-muted">{f.suffix}</span>}
          </div>
          {f.hint && !err && <p className="mt-1.5 text-xs text-muted">{f.hint}</p>}
          <ErrorText id={errId} path={path} errors={errors} />
        </div>,
      );
    case "select":
      return wrap(
        <SelectField
          label={label}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          options={f.options}
          placeholder={f.allowEmpty || !value ? (f.placeholder ?? "Select…") : undefined}
          error={err}
        />,
      );
    case "checkbox":
      // Rules can fail on a checkbox too (e.g. "only one plan can be most popular"), so it shows its own error.
      return wrap(
        <div className="flex h-full flex-col">
          <label className={cn("flex flex-1 cursor-pointer items-start gap-3 rounded-[3px] border px-4 py-3.5 transition-colors hover:border-ink/30", err ? "border-red" : "border-line")}>
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              aria-invalid={err ? true : undefined}
              aria-describedby={errId}
              className="mt-0.5 size-4 accent-[var(--color-red)]"
            />
            <span>
              <span className="block text-[14px] font-medium">{f.label}</span>
              {f.hint && <span className="mt-0.5 block text-[12.5px] text-muted">{f.hint}</span>}
            </span>
          </label>
          <ErrorText id={errId} path={path} errors={errors} />
        </div>,
      );
    case "multi": {
      const list = Array.isArray(value) ? (value as string[]) : [];
      return wrap(
        <fieldset>
          <legend className="mb-2 block text-[12.5px] font-medium text-ink">{label}</legend>
          <div className="flex flex-wrap gap-2">
            {f.options.map((o) => {
              const on = list.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(on ? list.filter((x) => x !== o.value) : [...list, o.value])}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                    on ? "border-ink bg-ink text-white" : "border-line text-ink hover:border-ink/40",
                  )}
                >
                  {on && <Check aria-hidden className="size-3.5" strokeWidth={3} />}
                  {o.label}
                </button>
              );
            })}
          </div>
          {f.hint && !err && <p className="mt-1.5 text-xs text-muted">{f.hint}</p>}
          <ErrorText path={path} errors={errors} />
        </fieldset>,
      );
    }
    case "lines": {
      const list = Array.isArray(value) ? (value as string[]) : [];
      // Rules on individual lines report at "<path>.<n>" (n counts non-blank lines).
      const lineErr = err ? null : Object.entries(errors).find(([k]) => k.startsWith(`${path}.`));
      const lineMsg = lineErr ? `Line ${Number(lineErr[0].slice(path.length + 1).split(".")[0]) + 1}: ${lineErr[1]}` : null;
      return wrap(
        <div>
          <Label htmlFor={id}>{label}</Label>
          <textarea
            id={id}
            className={cn(inputClass, "min-h-24 py-3 leading-relaxed")}
            rows={f.rows ?? Math.min(10, Math.max(3, list.length + 1))}
            value={list.join("\n")}
            onChange={(e) => onChange(e.target.value.split("\n"))}
            placeholder={f.placeholder ?? "One per line"}
            aria-invalid={err || lineMsg ? true : undefined}
            aria-describedby={errId}
          />
          <p className="mt-1.5 text-xs text-muted">{f.hint ?? "One item per line."}</p>
          <ErrorText id={errId} path={path} errors={errors} />
          {lineMsg && (
            <p id={errId} data-error className="mt-1.5 text-xs text-red">
              {lineMsg}
            </p>
          )}
        </div>,
      );
    }
    case "images": {
      const list = Array.isArray(value) ? (value as string[]) : [];
      // Adding, removing or reordering shifts indexes, so per-row errors no longer line up.
      const reshape = (next: string[]) => {
        clearError(path, true);
        setValue(next);
      };
      return wrap(
        <div>
          <Label htmlFor={list.length ? `${id}-0` : undefined}>{label}</Label>
          <ul className="space-y-2">
            {list.map((src, i) => {
              const rowErr = errors[`${path}.${i}`];
              return (
                <li key={i}>
                  <div className="flex items-center gap-3">
                    <Preview src={src} />
                    <input
                      id={`${id}-${i}`}
                      className={cn(inputClass, "h-11 min-w-0 flex-1")}
                      value={src}
                      placeholder="https://images.unsplash.com/…"
                      onChange={(e) => {
                        clearError(`${path}.${i}`);
                        onChange(list.map((x, j) => (j === i ? e.target.value : x)));
                      }}
                      aria-label={`Image ${i + 1} URL`}
                      aria-invalid={rowErr ? true : undefined}
                      aria-describedby={rowErr ? `${id}-${i}-err` : undefined}
                    />
                    <RowTools index={i} count={list.length} onMove={(to) => reshape(move(list, i, to))} onRemove={() => reshape(list.filter((_, j) => j !== i))} />
                  </div>
                  <ErrorText id={`${id}-${i}-err`} path={`${path}.${i}`} errors={errors} className="pl-15" />
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <button type="button" onClick={() => onChange([...list, ""])} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-red hover:underline">
              <Plus aria-hidden className="size-4" /> Add image URL
            </button>
            {/* Picked images replace any blank rows and go to the end. */}
            <MediaPickerButton multiple look="link" onPick={(urls) => reshape([...list.filter((x) => x.trim()), ...urls])} />
          </div>
          <p className="mt-1.5 text-xs text-muted">{f.hint ?? "The first image is the cover."}</p>
          <ErrorText path={path} errors={errors} />
        </div>,
      );
    }
    case "rows": {
      const list = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      const blank = () => Object.fromEntries(f.fields.map((x) => [x.name, emptyValue(x)]));
      // Removing or reordering shifts indexes, so per-row errors no longer line up.
      const reshape = (next: Record<string, unknown>[]) => {
        clearError(path, true);
        setValue(next);
      };
      return wrap(
        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="text-[12.5px] font-medium text-ink">{f.label}</p>
            <p className="text-[12px] text-muted num">{list.length} added</p>
          </div>
          <ol className="space-y-3">
            {list.map((row, i) => (
              <li key={i} className="border border-line bg-mist/40">
                <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
                  <p className="truncate text-[13px] font-semibold">
                    {String(row[f.itemTitle ?? "name"] ?? "") || `${f.addLabel.replace(/^Add /, "")} ${i + 1}`}
                  </p>
                  <RowTools index={i} count={list.length} onMove={(to) => reshape(move(list, i, to))} onRemove={() => reshape(list.filter((_, j) => j !== i))} />
                </div>
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                  {f.fields.map((sub) => (
                    <FieldInput
                      key={sub.name}
                      field={sub}
                      path={`${path}.${i}.${sub.name}`}
                      value={row[sub.name]}
                      errors={errors}
                      clearError={clearError}
                      onChange={(v) => onChange(list.map((r, j) => (j === i ? { ...r, [sub.name]: v } : r)))}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <Button type="button" variant="outline" size="sm" className="mt-3" icon={<Plus className="size-4" aria-hidden />} onClick={() => onChange([...list, blank()])}>
            {f.addLabel}
          </Button>
          <ErrorText path={path} errors={errors} />
        </div>,
      );
    }
    case "group": {
      const obj = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
      const blank = () => Object.fromEntries(f.fields.map((x) => [x.name, emptyValue(x)]));
      return wrap(
        <div>
          {f.optionalLabel ? (
            <label className="flex cursor-pointer items-center gap-3 text-[14px] font-medium">
              <input
                type="checkbox"
                checked={Boolean(obj)}
                onChange={(e) => {
                  clearError(path, true);
                  setValue(e.target.checked ? blank() : null);
                }}
                className="size-4 accent-[var(--color-red)]"
              />
              {f.optionalLabel}
            </label>
          ) : (
            <p className="text-[12.5px] font-medium text-ink">{f.label}</p>
          )}
          {obj && (
            <div className="mt-3 grid grid-cols-1 gap-4 border-l-2 border-line pl-4 sm:grid-cols-2">
              {f.fields.map((sub) => (
                <FieldInput
                  key={sub.name}
                  field={sub}
                  path={`${path}.${sub.name}`}
                  value={obj[sub.name]}
                  errors={errors}
                  clearError={clearError}
                  onChange={(v) => onChange({ ...obj, [sub.name]: v })}
                />
              ))}
            </div>
          )}
          <ErrorText path={path} errors={errors} />
        </div>,
      );
    }
  }
}

function move<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function RowTools({ index, count, onMove, onRemove }: { index: number; count: number; onMove: (to: number) => void; onRemove: () => void }) {
  const btn = "inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-white hover:text-ink disabled:opacity-30";
  return (
    <div className="flex shrink-0 items-center">
      <button type="button" className={btn} disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="Move up">
        <ArrowUp className="size-4" />
      </button>
      <button type="button" className={btn} disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label="Move down">
        <ArrowDown className="size-4" />
      </button>
      <button type="button" className={cn(btn, "hover:text-red")} onClick={onRemove} aria-label="Remove">
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function Preview({ src }: { src: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const ok = /^(https?:\/\/|\/)/.test(src) && failed !== src;
  return (
    <span className="relative inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-line bg-mist">
      {ok ? (
        // Admin preview of arbitrary URLs — plain <img> on purpose.
        // eslint-disable-next-line @next/next/no-img-element
        <img loading="lazy" decoding="async" src={src} alt="" className="size-full object-cover" onError={() => setFailed(src)} />
      ) : (
        <ImageOff aria-hidden className="size-4 text-muted" />
      )}
    </span>
  );
}

