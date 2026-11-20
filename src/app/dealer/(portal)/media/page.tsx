import type { Metadata } from "next";
import { requirePartner } from "@/server/partner/context";
import { listPartnerMedia } from "@/server/partner/inventory";
import { PortalHeader } from "@/components/portal/ui";
import { MediaLibrary } from "@/components/portal/media/media-library";

export const metadata: Metadata = { title: "Media library" };

export default async function MediaPage() {
  const ctx = await requirePartner({ perm: "media.manage", next: "/dealer/media" });
  const initial = await listPartnerMedia(ctx.partner.id);
  return (
    <>
      <PortalHeader
        title="Media library"
        description="Every public image your dealership has uploaded — vehicle photos, logos, banners. Images are resized in your browser before upload (900 KB limit)."
      />
      <MediaLibrary initial={initial} />
    </>
  );
}
