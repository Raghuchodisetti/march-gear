import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deleteUpcomingAction, saveUpcomingAction } from "@/server/actions/catalog";
import { brandOptions, NEW_DEFAULTS, upcomingForm } from "@/server/admin/catalog";
import { requireStaff } from "@/server/auth";
import { AdminHeader } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/delete-button";
import { ResourceForm } from "@/components/admin/resource-form";
import { withOptions } from "@/components/admin/fields";
import { upcomingSections } from "@/components/admin/resources";

export const metadata: Metadata = { title: "Upcoming launch" };

export default async function UpcomingEditPage({ params }: PageProps<"/admin/upcoming/[id]">) {
  await requireStaff();
  const { id } = await params;
  const isNew = id === "new";
  const recordId = isNew ? null : /^\d+$/.test(id) ? Number(id) : NaN;
  const [initial, brands] = await Promise.all([isNew ? NEW_DEFAULTS.upcoming() : Number.isNaN(recordId) ? null : upcomingForm(recordId!), brandOptions()]);
  if (!initial) notFound();

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/upcoming", label: "Upcoming launches" }}
        title={isNew ? "Add upcoming launch" : String(initial.name)}
        actions={!isNew && <DeleteButton action={deleteUpcomingAction.bind(null, recordId)} confirmText={`Delete ${initial.name}?`} redirectTo="/admin/upcoming" />}
      />
      <ResourceForm
        sections={withOptions(upcomingSections, { brand: brands })}
        initial={initial}
        action={saveUpcomingAction.bind(null, recordId)}
        listHref="/admin/upcoming"
        createdHref={isNew ? "/admin/upcoming/:id" : undefined}
        submitLabel={isNew ? "Create launch" : "Save changes"}
      />
    </>
  );
}
