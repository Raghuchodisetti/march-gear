import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { deleteCarAction, saveCarAction } from "@/server/actions/catalog";
import { brandOptions, carForm, carOptions, NEW_DEFAULTS } from "@/server/admin/catalog";
import { requireStaff } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { AdminHeader } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/delete-button";
import { ResourceForm } from "@/components/admin/resource-form";
import { withOptions } from "@/components/admin/fields";
import { carSections } from "@/components/admin/resources";

export const metadata: Metadata = { title: "Car" };

export default async function CarEditPage({ params }: PageProps<"/admin/cars/[id]">) {
  await requireStaff();
  const { id } = await params;
  const isNew = id === "new";
  const recordId = isNew ? null : /^\d+$/.test(id) ? Number(id) : NaN;
  const [initial, brands, cars] = await Promise.all([
    isNew ? NEW_DEFAULTS.car() : Number.isNaN(recordId) ? null : carForm(recordId!),
    brandOptions(),
    carOptions(),
  ]);
  if (!initial) notFound();

  const sections = withOptions(carSections, { brand: brands, competitors: cars.filter((c) => c.value !== initial.slug) });

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/cars", label: "New cars" }}
        title={isNew ? "Add car" : String(initial.name)}
        description={isNew ? "Start as a draft — publish when the details are complete." : undefined}
        actions={
          !isNew && (
            <>
              <Button href={`/cars/${initial.slug}`} target="_blank" variant="outline" size="sm" icon={<ExternalLink className="size-4" aria-hidden />}>
                View on site
              </Button>
              <DeleteButton action={deleteCarAction.bind(null, recordId)} confirmText={`Delete ${initial.name} and all its variants? This can't be undone.`} redirectTo="/admin/cars" />
            </>
          )
        }
      />
      <ResourceForm
        sections={sections}
        initial={initial}
        action={saveCarAction.bind(null, recordId)}
        listHref="/admin/cars"
        createdHref={isNew ? "/admin/cars/:id" : undefined}
        submitLabel={isNew ? "Create car" : "Save changes"}
      />
    </>
  );
}
