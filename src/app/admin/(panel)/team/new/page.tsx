import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth";
import { AdminHeader } from "@/components/admin/ui";
import { CreateStaffForm } from "@/components/admin/user-forms";

export const metadata: Metadata = { title: "Add staff" };

export default async function NewStaffPage() {
  await requireAdmin();
  return (
    <>
      <AdminHeader
        back={{ href: "/admin/team", label: "Staff & access" }}
        title="Add staff"
        description="Staff sign in at /staff/login and see only the sections you tick. Admins sign in at /admin/login and can use everything."
      />
      <CreateStaffForm />
    </>
  );
}
