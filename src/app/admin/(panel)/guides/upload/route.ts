import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { guides } from "@/db/schema";
import { PUBLISH_STATUS, type PublishStatus } from "@/db/enums";
import { deskUserFor } from "@/server/auth";
import { audit } from "@/server/audit";
import { expireGuides, freeGuideSlug, writeGuidePdf } from "@/server/guides";
import { PdfReadError, extractGuide } from "@/server/guides/extract";
import { slugify } from "@/components/admin/fields";
import { GUIDE_PDF_MAX_BYTES, GUIDE_SUBJECT_MAX, GUIDE_TITLE_MAX, countWords, formatMB, summaryFrom } from "@/lib/guides";

/* POST multipart/form-data, staff only. Creates a guide from a PDF — `subject`, `title`, `file`,
   `status`, `showPdf` — or, with `id`, replaces an existing guide's PDF and the content read from it.
   A route handler rather than a Server Action: PDFs are bigger than a Server Action's 1 MB body limit. */

type UploadResult = { ok: true; id: number; slug: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const json = (body: UploadResult, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (status: number, error: string, field?: string) => json({ ok: false, error, ...(field && { fieldErrors: { [field]: error } }) }, status);

/** Same-origin check (as for media uploads): the session cookie is SameSite=Lax, but don't rely on that alone. */
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

/** A PDF starts with "%PDF-" (some generators put a few bytes of junk before it). */
const isPdf = (buf: Buffer) => buf.subarray(0, 1024).includes("%PDF-");

export async function POST(request: NextRequest) {
  const user = await deskUserFor("content");
  if (!user) return fail(401, "Your session has expired, or your account can't manage guides. Sign in again to upload.");
  if (!sameOrigin(request)) return fail(403, "Cross-site upload blocked.");

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > GUIDE_PDF_MAX_BYTES + 64 * 1024) return fail(413, `The PDF must be under ${formatMB(GUIDE_PDF_MAX_BYTES)}.`, "file");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "Couldn't read the upload. Please try again.");
  }

  const idRaw = str(form.get("id"));
  const replacing = idRaw !== "";
  const id = replacing ? Number(idRaw) : null;
  if (replacing && !(Number.isInteger(id) && id! > 0)) return fail(400, "Invalid guide.");

  // Fields (new guides only).
  const subject = str(form.get("subject"));
  const title = str(form.get("title"));
  const status = (PUBLISH_STATUS as readonly string[]).includes(str(form.get("status"))) ? (str(form.get("status")) as PublishStatus) : "published";
  const showPdf = str(form.get("showPdf")) !== "false";
  if (!replacing) {
    const errors: Record<string, string> = {};
    if (!subject) errors.subject = "Enter the subject";
    else if (subject.length > GUIDE_SUBJECT_MAX) errors.subject = "That's too long";
    if (!title) errors.title = "Enter the topic name";
    else if (title.length > GUIDE_TITLE_MAX) errors.title = "That's too long";
    if (Object.keys(errors).length) return json({ ok: false, error: "Please check the highlighted fields.", fieldErrors: errors }, 400);
  }

  const file = form.get("file");
  if (!file || typeof file === "string") return fail(400, "Choose the PDF to upload.", "file");
  if (file.size === 0) return fail(400, "That file is empty.", "file");
  if (file.size > GUIDE_PDF_MAX_BYTES) return fail(413, `${formatMB(file.size)} is over the ${formatMB(GUIDE_PDF_MAX_BYTES)} limit. Compress the PDF or split it into separate topics.`, "file");
  const data = Buffer.from(await file.arrayBuffer());
  if (!isPdf(data)) return fail(415, "That isn't a PDF. Export or save the document as PDF and upload that.", "file");
  const pdfName = (file.name || "guide.pdf").replace(/[^\w.\- ()]+/g, "_").slice(0, 190).replace(/(\.pdf)?$/i, ".pdf");

  const db = getDb();
  const existing = replacing ? (await db.select({ title: guides.title }).from(guides).where(eq(guides.id, id!)).limit(1))[0] : null;
  if (replacing && !existing) return fail(404, "This guide no longer exists.");

  let extracted;
  try {
    extracted = await extractGuide(data);
  } catch (err) {
    if (err instanceof PdfReadError) return fail(422, err.message, "file");
    console.error("[guides] PDF read failed", err);
    return fail(422, "Couldn't read this PDF. Try exporting it again, or use a different PDF.", "file");
  }
  const { blocks, pages } = extracted;
  const content = { content: blocks, words: countWords(blocks), summary: summaryFrom(blocks), pdfName, pdfSize: data.length, pdfPages: pages };

  try {
    if (replacing) {
      await db.update(guides).set(content).where(eq(guides.id, id!));
      await writeGuidePdf(id!, data);
      expireGuides();
      await audit(user.id, "upload", "guide", id, `Replaced the PDF of guide “${existing!.title}” (${pages} pages)`);
      const [g] = await db.select({ slug: guides.slug }).from(guides).where(eq(guides.id, id!));
      return json({ ok: true, id: id!, slug: g.slug }, 200);
    }

    const slug = await freeGuideSlug(slugify(title));
    const [res] = await db.insert(guides).values({ slug, subject, title, status, showPdf, createdBy: user.id, ...content });
    const newId = res.insertId;
    try {
      await writeGuidePdf(newId, data);
    } catch (err) {
      await db.delete(guides).where(eq(guides.id, newId));
      throw err;
    }
    expireGuides();
    await audit(user.id, "create", "guide", newId, `Created guide “${title}” from ${pdfName} (${pages} pages)`);
    return json({ ok: true, id: newId, slug }, 201);
  } catch (err) {
    console.error("[guides] save failed", err);
    return fail(500, "Couldn't save the guide. Please try again.");
  }
}
