import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { deleteUsedCarAction, saveUsedCarAction } from "@/server/actions/catalog";
import { brandOptions, carOptions, cityOptions, dealerOptions, NEW_DEFAULTS, usedForm } from "@/server/admin/catalog";
import { requireStaff } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { AdminHeader } from "@/components/admin/ui";
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

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/used-cars", label: "Used cars" }}
        title={isNew ? "Add used-car listing" : `${initial.name} ${initial.variant}`}
        description={isNew ? "Saved as a draft until you set the status to Active." : `Listing ${id}`}
        actions={
          !isNew && (
            <>
              <Button href={`/used-cars/${id}`} target="_blank" variant="outline" size="sm" icon={<ExternalLink className="size-4" aria-hidden />}>
                View on site
              </Button>
              <DeleteButton action={deleteUsedCarAction.bind(null, id)} confirmText="Delete this listing? This can't be undone." redirectTo="/admin/used-cars" />
            </>
          )
        }
      />
      <ResourceForm
        sections={withOptions(usedSections, { brand: brands, modelSlug: models, dealerId: dealers, city: cityOptions() })}
        initial={initial}
        action={saveUsedCarAction.bind(null, isNew ? null : id)}
        listHref="/admin/used-cars"
        createdHref={isNew ? "/admin/used-cars/:id" : undefined}
        submitLabel={isNew ? "Create listing" : "Save changes"}
      />
    </>
  );
}
