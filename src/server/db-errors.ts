import "server-only";

/** The MySQL error code behind a failed query. Drizzle wraps driver errors (DrizzleQueryError), so look through `cause`. */
export function dbErrorCode(err: unknown): string | undefined {
  let e: unknown = err;
  for (let depth = 0; e && typeof e === "object" && depth < 5; depth++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && code.startsWith("ER_")) return code;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

/** A unique index rejected the row (e.g. a slug or email that's already taken). */
export const isDuplicate = (err: unknown) => dbErrorCode(err) === "ER_DUP_ENTRY";
/** Deleting (or re-keying) a row that other rows still point at. */
export const isInUse = (err: unknown) => /^ER_ROW_IS_REFERENCED/.test(dbErrorCode(err) ?? "");
/** Saving a row that points at a record that doesn't exist. */
export const isMissingParent = (err: unknown) => /^ER_NO_REFERENCED_ROW/.test(dbErrorCode(err) ?? "");
