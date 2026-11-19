import type { Metadata } from "next";
import { requireStaff } from "@/server/auth";
import { AdminHeader, Panel, formatDateTime } from "@/components/admin/ui";
import { ChangePasswordForm } from "@/components/admin/user-forms";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const me = await requireStaff();
  return (
    <>
      <AdminHeader title="My account" description="Your staff sign-in." />
      <div className="grid max-w-3xl grid-cols-1 gap-6">
        <Panel title="Signed in as">
          <dl className="grid grid-cols-1 gap-3 text-[14px] sm:grid-cols-[140px_1fr]">
            <dt className="text-muted">Name</dt>
            <dd>{me.name}</dd>
            <dt className="text-muted">Email</dt>
            <dd>{me.email}</dd>
            <dt className="text-muted">Role</dt>
            <dd className="capitalize">{me.role}</dd>
            <dt className="text-muted">Member since</dt>
            <dd>{formatDateTime(me.memberSince)}</dd>
          </dl>
        </Panel>
        <ChangePasswordForm />
      </div>
    </>
  );
}
