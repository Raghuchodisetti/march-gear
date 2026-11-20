import type { Metadata } from "next";
import { listStaff } from "@/server/admin/leads";
import { requireStaff } from "@/server/auth";
import { AdminHeader } from "@/components/admin/ui";
import { NewLeadForm } from "@/components/admin/lead-create-form";

export const metadata: Metadata = { title: "Add lead" };

export default async function NewLeadPage() {
  const me = await requireStaff();
  const staff = await listStaff();
  return (
    <>
      <AdminHeader
        back={{ href: "/admin/leads", label: "All leads" }}
        title="Add lead"
        description="Record an enquiry taken by phone, at the showroom or on WhatsApp. It's handled like any website lead."
      />
      <NewLeadForm staff={staff} meId={me.id} />
    </>
  );
}
