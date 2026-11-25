import type { NextRequest } from "next/server";
import { INS_DOC_KINDS, type InsDocKind } from "@/db/enums";
import { getInsurerContext } from "@/server/insurance/context";
import { INS_FILE_MAX, saveInsurerFile, saveInsurerMedia, sniffDocument } from "@/server/insurance/files";
import { logInsurerActivity } from "@/server/insurance/records";
import { HOUR, take } from "@/server/rate-limit";

/** The image's smaller card copy, made in the browser (checked again when it's stored). */
const thumbOf = async (form: FormData) => {
  const t = form.get("thumb");
  return t && typeof t !== "string" ? Buffer.from(await t.arrayBuffer()) : null;
};

/**
 * POST multipart { file, kind } from the insurance vendor portal.
 *   kind = "media"            → public image (logo, campaign banner, ad creative)
 *   kind = a document kind    → private file (PDF or image)
 * Any member of a vendor may upload — including during registration, before approval.
 */

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "Cross-site uploads aren't allowed." }, 403);
  const ctx = await getInsurerContext();
  if (!ctx) return json({ error: "Please sign in to the insurance vendor portal again." }, 401);
  if (ctx.vendor.status === "suspended") return json({ error: "Your company account is suspended." }, 403);
  if (!take(`insurer-upload:${ctx.user.id}`, 200, HOUR)) return json({ error: "Too many uploads. Please wait a little and try again." }, 429);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Upload a file." }, 400);
  }
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  if (!(file instanceof File) || file.size === 0) return json({ error: "Choose a file to upload." }, 400);
  if (file.size > INS_FILE_MAX) return json({ error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 900 KB — compress it or upload a smaller scan.` }, 413);
  const data = Buffer.from(await file.arrayBuffer());

  if (kind === "media") {
    // Public images (logo, campaign banners, ad creatives) are for approved vendors only — an unreviewed sign-up
    // mustn't be able to host files on MarchGear's /media.
    if (!ctx.approved) return json({ error: "Images can be uploaded once your company is approved." }, 403);
    const saved = await saveInsurerMedia({ vendorId: ctx.vendor.id, userId: ctx.user.id, filename: file.name, data, thumb: await thumbOf(form), alt: String(form.get("alt") ?? "").slice(0, 300) || null });
    if (!saved) return json({ error: "That isn't a JPEG, PNG, WebP, GIF or AVIF image." }, 415);
    await logInsurerActivity(ctx.vendor.id, ctx.user.id, "upload", "media", saved.id, `Uploaded image ${file.name}`);
    return json({ media: saved });
  }

  if (!(INS_DOC_KINDS as readonly string[]).includes(kind)) return json({ error: "Unknown document type." }, 400);
  const mime = sniffDocument(data);
  if (!mime) return json({ error: "Upload a PDF, JPEG, PNG or WebP file." }, 415);
  const saved = await saveInsurerFile({ vendorId: ctx.vendor.id, kind: kind as InsDocKind, filename: file.name, mime, data, uploadedBy: ctx.user.id });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "upload", "document", saved.id, `Uploaded ${kind.replace(/_/g, " ")} (${saved.filename})`);
  return json({ file: saved });
}
