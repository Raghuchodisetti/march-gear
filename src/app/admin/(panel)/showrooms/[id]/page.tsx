import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deleteDealerAction, saveDealerAction } from "@/server/actions/catalog";
import { brandOptions, cityOptions, dealerForm, NEW_DEFAULTS } from "@/server/admin/catalog";
import { requireStaff } from "@/server/auth";
import { AdminHeader, ViewOnSite } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/delete-button";
import { ResourceForm } from "@/components/admin/resource-form";
import { withOptions } from "@/components/admin/fields";
import { dealerSections } from "@/components/admin/resources";

export const metadata: Metadata = { title: "Dealer" };

export default async function DealerEditPage({ params }: PageProps<"/admin/showrooms/[id]">) {
  await requireStaff();
  const { id } = await params;
  const isNew = id === "new";
  const [initial, brands] = await Promise.all([isNew ? NEW_DEFAULTS.dealer() : dealerForm(id), brandOptions({ multi: true })]);
  if (!initial) notFound();

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/showrooms", label: "Showroom listings" }}
        title={isNew ? "Add dealer" : String(initial.name)}
        actions={
          !isNew && (
            <>
              <ViewOnSite href={`/dealers/${encodeURIComponent(id)}`} offline={!initial.isActive && "Hidden — not on the site"} />
              <DeleteButton action={deleteDealerAction.bind(null, id)} confirmText={`Delete ${initial.name}? Its reviews are deleted too.`} redirectTo="/admin/showrooms" />
            </>
          )
        }
      />
      <ResourceForm
        sections={withOptions(dealerSections, { brand: brands, city: await cityOptions() })}
        initial={initial}
        action={saveDealerAction.bind(null, isNew ? null : id)}
        listHref="/admin/showrooms"
        // The ID can change, so always land on the saved record.
        createdHref="/admin/showrooms/:id"
        submitLabel={isNew ? "Create dealer" : "Save changes"}
      />
    </>
  );
}
