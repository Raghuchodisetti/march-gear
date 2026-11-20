import type { NextRequest } from "next/server";
import { PARTNER_DOC_KINDS, type PartnerDocKind } from "@/db/enums";
import { getPartnerContext } from "@/server/partner/context";
import { PARTNER_FILE_MAX, savePartnerFile, savePartnerMedia, sniffDocument } from "@/server/partner/files";
import { logPartnerActivity } from "@/server/partner/records";
import { HOUR, take } from "@/server/rate-limit";

/**
 * POST multipart { file, kind } from the dealer portal.
 *   kind = "media"            → public image (showroom/vehicle photos, logos, banners)
 *   kind = a document kind    → private file (PDF or image)
 * Any member of a dealership may upload — including during registration, before approval.
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
  const ctx = await getPartnerContext();
  if (!ctx) return json({ error: "Please sign in to the dealer portal again." }, 401);
  if (ctx.partner.status === "suspended" || ctx.partner.status === "deactivated") return json({ error: "Your dealership account is not active." }, 403);
  if (!take(`dealer-upload:${ctx.user.id}`, 200, HOUR)) return json({ error: "Too many uploads. Please wait a little and try again." }, 429);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Upload a file." }, 400);
  }
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  if (!(file instanceof File) || file.size === 0) return json({ error: "Choose a file to upload." }, 400);
  if (file.size > PARTNER_FILE_MAX) return json({ error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 900 KB — compress it or upload a smaller scan.` }, 413);
  const data = Buffer.from(await file.arrayBuffer());

  if (kind === "media") {
    const saved = await savePartnerMedia({ partnerId: ctx.partner.id, userId: ctx.user.id, filename: file.name, data, alt: String(form.get("alt") ?? "").slice(0, 300) || null });
    if (!saved) return json({ error: "That isn't a JPEG, PNG, WebP, GIF or AVIF image." }, 415);
    await logPartnerActivity(ctx.partner.id, ctx.user.id, "upload", "media", saved.id, `Uploaded image ${file.name}`);
    return json({ media: saved });
  }

  if (!(PARTNER_DOC_KINDS as readonly string[]).includes(kind)) return json({ error: "Unknown document type." }, 400);
  const mime = sniffDocument(data);
  if (!mime) return json({ error: "Upload a PDF, JPEG, PNG or WebP file." }, 415);
  const saved = await savePartnerFile({ partnerId: ctx.partner.id, kind: kind as PartnerDocKind, filename: file.name, mime, data, uploadedBy: ctx.user.id });
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "upload", "document", saved.id, `Uploaded ${kind.replace(/_/g, " ")} (${saved.filename})`);
  return json({ file: saved });
}
