import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deleteUsedCarAction, saveUsedCarAction } from "@/server/actions/catalog";
import { brandOptions, carOptions, cityOptions, dealerOptions, NEW_DEFAULTS, usedForm } from "@/server/admin/catalog";
import { requireStaff } from "@/server/auth";
import { AdminHeader, ViewOnSite } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/delete-button";
import { ResourceForm } from "@/components/admin/resource-form";
import { withOptions } from "@/components/admin/fields";
import { usedSections } from "@/components/admin/resources";

export const metadata: Metadata = { title: "Used car" };

export default async function UsedEditPage({ params }: PageProps<"/admin/used-cars/[id]">) {
  await requireStaff();
  const { id } = await params;
  const isNew = id === "new";
  const [initial, brands, models, dealers] = await Promise.all([
    isNew ? NEW_DEFAULTS.used() : usedForm(id),
    brandOptions({ legacy: true }),
    carOptions(),
    dealerOptions(),
  ]);
  if (!initial) notFound();
  const status = String(initial.status);

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/used-cars", label: "Used cars" }}
        title={isNew ? "Add used-car listing" : `${initial.name} ${initial.variant}`}
        description={isNew ? "Saved as a draft until you set the status to Active." : `Listing ${id}`}
        actions={
          !isNew && (
            <>
              <ViewOnSite
                href={`/used-cars/${encodeURIComponent(id)}`}
                offline={status !== "active" && `${status[0].toUpperCase()}${status.slice(1)} — not on the site`}
              />
              <DeleteButton action={deleteUsedCarAction.bind(null, id)} confirmText="Delete this listing? This can't be undone." redirectTo="/admin/used-cars" />
            </>
          )
        }
      />
      <ResourceForm
        sections={withOptions(usedSections, { brand: brands, modelSlug: models, dealerId: dealers, city: await cityOptions() })}
        initial={initial}
        action={saveUsedCarAction.bind(null, isNew ? null : id)}
        listHref="/admin/used-cars"
        createdHref={isNew ? "/admin/used-cars/:id" : undefined}
        submitLabel={isNew ? "Create listing" : "Save changes"}
      />
    </>
  );
}
