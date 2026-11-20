import type { Metadata } from "next";
import { listMedia } from "@/server/admin/media";
import { AdminHeader, strParam } from "@/components/admin/ui";
import { MediaLibrary } from "@/components/admin/media-library";

export const metadata: Metadata = { title: "Media library" };

export default async function MediaPage({ searchParams }: PageProps<"/admin/media">) {
  const sp = await searchParams;
  const q = strParam(sp.q)?.slice(0, 120) ?? "";
  const page = await listMedia({ q });
  return (
    <>
      <AdminHeader
        title="Media library"
        description="Upload photos once and use them anywhere — every image field has an “Upload / choose” button. Uploads are public at their /media/… URL."
      />
      <MediaLibrary initial={page} initialQuery={q} />
    </>
  );
}
