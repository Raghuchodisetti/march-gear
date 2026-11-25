import type { Metadata } from "next";
import { guideSubjects } from "@/server/guides";
import { AdminHeader } from "@/components/admin/ui";
import { GuideUploadForm } from "@/components/admin/guide-upload";

export const metadata: Metadata = { title: "New guide" };

export default async function NewGuidePage() {
  const subjects = await guideSubjects();
  return (
    <>
      <AdminHeader
        back={{ href: "/admin/guides", label: "Guides" }}
        title="New guide"
        description="Fill in the subject and topic name and upload the PDF. Its text becomes the topic page, which you can review and edit next."
      />
      <GuideUploadForm subjects={subjects} />
    </>
  );
}
