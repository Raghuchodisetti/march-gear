import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deleteAuthorAction, saveAuthorAction } from "@/server/actions/catalog";
import { authorForm, NEW_DEFAULTS } from "@/server/admin/catalog";
import { requireStaff } from "@/server/auth";
import { AdminHeader } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/delete-button";
import { ResourceForm } from "@/components/admin/resource-form";
import { authorSections } from "@/components/admin/resources";

export const metadata: Metadata = { title: "Author" };

export default async function AuthorEditPage({ params }: PageProps<"/admin/authors/[id]">) {
  await requireStaff();
  const { id } = await params;
  const isNew = id === "new";
  const initial = isNew ? NEW_DEFAULTS.author() : await authorForm(id);
  if (!initial) notFound();

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/authors", label: "Authors" }}
        title={isNew ? "Add author" : String(initial.name)}
        actions={!isNew && <DeleteButton action={deleteAuthorAction.bind(null, id)} confirmText={`Delete ${initial.name}?`} redirectTo="/admin/authors" />}
      />
      <ResourceForm
        sections={authorSections}
        initial={initial}
        action={saveAuthorAction.bind(null, isNew ? null : id)}
        listHref="/admin/authors"
        createdHref="/admin/authors/:id"
        submitLabel={isNew ? "Create author" : "Save changes"}
      />
    </>
  );
}
