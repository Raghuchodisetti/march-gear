import type { NextRequest } from "next/server";
import { getSessionUser, isStaff } from "@/server/auth";
import { audit } from "@/server/audit";
import { insertMedia, safeFilename, sniffImage } from "@/server/admin/media";
import {
  MEDIA_FORMATS_LABEL,
  MEDIA_MAX_BYTES,
  MEDIA_MAX_FILES,
  MEDIA_MAX_SIDE,
  formatBytes,
  mediaUrl,
  type MediaItem,
  type UploadResponse,
} from "@/components/admin/media-shared";

/* POST multipart/form-data with one or more `file` parts (optional `width`/`height`
   hints from the browser, used only to correct for EXIF rotation). Staff only. */

const json = (body: Partial<UploadResponse>, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

class UploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Same-origin check: the session cookie is SameSite=Lax, but don't rely on that alone. */
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Non-browser clients (no cookie forgery risk without one).
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const hint = (v: FormDataEntryValue | null) => {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n > 0 && n <= MEDIA_MAX_SIDE ? n : null;
};

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return json({ error: "Your session has expired. Sign in again to upload." }, 401);
  if (!isStaff(user.role)) return json({ error: "Only staff can upload media." }, 403);
  if (!sameOrigin(request)) return json({ error: "Cross-site upload blocked." }, 403);

  // Reject obviously oversized bodies before buffering them.
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MEDIA_MAX_FILES * (MEDIA_MAX_BYTES + 64 * 1024)) return json({ error: `Upload too large — each image must be under ${formatBytes(MEDIA_MAX_BYTES)}.` }, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Couldn't read the upload. Send it as multipart/form-data with a “file” field." }, 400);
  }
  const files = form.getAll("file").filter((v): v is File => typeof v !== "string");
  if (!files.length) return json({ error: "Choose an image to upload." }, 400);
  if (files.length > MEDIA_MAX_FILES) return json({ error: `Upload up to ${MEDIA_MAX_FILES} images at a time.` }, 400);
  const widths = form.getAll("width");
  const heights = form.getAll("height");

  const items: MediaItem[] = [];
  const errors: UploadResponse["errors"] = [];
  let status = 400;

  for (const [i, file] of files.entries()) {
    const name = file.name || "image";
    try {
      if (file.size === 0) throw new UploadError("The file is empty.", 400);
      if (file.size > MEDIA_MAX_BYTES) {
        throw new UploadError(`${formatBytes(file.size)} is over the ${formatBytes(MEDIA_MAX_BYTES)} limit. Resize or compress it first.`, 413);
      }
      const data = Buffer.from(await file.arrayBuffer());
      const info = sniffImage(data);
      if (!info) throw new UploadError(`This isn't a ${MEDIA_FORMATS_LABEL} image${/\.svg$/i.test(name) ? " (SVG isn't allowed)" : ""}.`, 415);
      let { width, height } = info;
      if (width === 0 || height === 0) throw new UploadError("This image looks damaged — it has no size.", 415);
      if ((width ?? 0) > MEDIA_MAX_SIDE || (height ?? 0) > MEDIA_MAX_SIDE) {
        throw new UploadError(`${width}×${height} px is too big — keep each side under ${MEDIA_MAX_SIDE} px.`, 413);
      }
      // The browser reports the size after EXIF rotation; accept it only if it's the same box (possibly turned).
      const [w, h] = [hint(widths[i] ?? null), hint(heights[i] ?? null)];
      if (w && h && (width === null || (w === width && h === height) || (w === height && h === width))) [width, height] = [w, h];

      const filename = safeFilename(name, info.mime);
      const id = await insertMedia({ filename, mime: info.mime, data, width, height }, user.id);
      const createdAt = new Date().toISOString();
      items.push({ id, url: mediaUrl(id, filename), filename, mime: info.mime, size: data.length, width, height, alt: null, createdAt, uploader: user.name });
      await audit(user.id, "upload", "media", id, `Uploaded ${filename} (${formatBytes(data.length)}${width && height ? `, ${width}×${height}` : ""})`);
    } catch (err) {
      if (!(err instanceof UploadError)) console.error("[media] upload failed", err);
      const e = err instanceof UploadError ? err : new UploadError("Couldn't save this image. Please try again.", 500);
      errors.push({ name, error: e.message });
      status = e.status;
    }
  }

  if (!items.length) return json({ items, errors, error: errors[0]?.error }, files.length === 1 ? status : 400);
  return json({ items, errors, id: items[0].id, url: items[0].url }, 201);
}
