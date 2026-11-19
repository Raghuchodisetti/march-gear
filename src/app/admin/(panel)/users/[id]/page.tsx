import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEAD_STATUS_LABEL, LEAD_STATUS_TONE, LEAD_TYPE_LABEL } from "@/lib/leads";
import { deleteUserAction } from "@/server/actions/admin";
import { getUserDetail } from "@/server/admin/audience";
import { getSessionUser, requireStaff } from "@/server/auth";
import { AdminHeader, Badge, Panel, formatDateTime } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/delete-button";
import { CreateStaffForm, UserEditor } from "@/components/admin/user-forms";

export const metadata: Metadata = { title: "Account" };

export default async function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  await requireStaff(["admin"]);
  const { id } = await params;

  if (id === "new")
    return (
      <>
        <AdminHeader back={{ href: "/admin/users", label: "Customers & staff" }} title="Add staff" description="Editors manage the catalogue, content and leads. Admins can also manage accounts." />
        <CreateStaffForm />
      </>
    );

  const data = /^\d+$/.test(id) ? await getUserDetail(Number(id)) : null;
  if (!data) notFound();
  const { user, leads, saved } = data;
  const me = await getSessionUser();

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/users", label: "Customers & staff" }}
        title={user.name}
        description={`Joined ${formatDateTime(user.createdAt)} · ${user.lastLoginAt ? `last signed in ${formatDateTime(user.lastLoginAt)}` : "never signed in"} · ${saved} saved cars`}
        actions={me?.id !== user.id && <DeleteButton action={deleteUserAction.bind(null, user.id)} confirmText={`Delete ${user.name}'s account? Their leads are kept.`} redirectTo="/admin/users" />}
      />
      <UserEditor user={user} />
      <Panel title={`Requests (${leads.length})`} className="mt-6" padded={false}>
        {leads.length === 0 ? (
          <p className="p-5 text-[13.5px] text-muted">No enquiries or bookings from this account.</p>
        ) : (
          <ul className="divide-y divide-line">
            {leads.map((l) => (
              <li key={l.id}>
                <Link href={`/admin/leads/${l.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-mist/50">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">
                      {LEAD_TYPE_LABEL[l.type]} <span className="font-normal text-muted">· {l.subject ?? l.reference}</span>
                    </span>
                    <span className="text-[12.5px] text-muted">{formatDateTime(l.createdAt)}</span>
                  </span>
                  <Badge tone={LEAD_STATUS_TONE[l.status]}>{LEAD_STATUS_LABEL[l.status]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
