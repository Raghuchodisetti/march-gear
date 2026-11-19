import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { deleteBrandAction, saveBrandAction } from "@/server/actions/catalog";
import { brandForm, NEW_DEFAULTS } from "@/server/admin/catalog";
import { requireStaff } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { AdminHeader } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/delete-button";
import { ResourceForm } from "@/components/admin/resource-form";
import { brandSections } from "@/components/admin/resources";

export const metadata: Metadata = { title: "Brand" };

export default async function BrandEditPage({ params }: PageProps<"/admin/brands/[id]">) {
  await requireStaff();
  const { id } = await params;
  const isNew = id === "new";
  const recordId = isNew ? null : /^\d+$/.test(id) ? Number(id) : NaN;
  const initial = isNew ? NEW_DEFAULTS.brand() : Number.isNaN(recordId) ? null : await brandForm(recordId!);
  if (!initial) notFound();

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/brands", label: "Brands" }}
        title={isNew ? "Add brand" : String(initial.name)}
        actions={
          !isNew && (
            <>
              <Button href={`/brands/${initial.slug}`} target="_blank" variant="outline" size="sm" icon={<ExternalLink className="size-4" aria-hidden />}>
                View on site
              </Button>
              <DeleteButton action={deleteBrandAction.bind(null, recordId)} confirmText={`Delete ${initial.name}? This can't be undone.`} redirectTo="/admin/brands" />
            </>
          )
        }
      />
      <ResourceForm
        sections={brandSections}
        initial={initial}
        action={saveBrandAction.bind(null, recordId)}
        listHref="/admin/brands"
        createdHref={isNew ? "/admin/brands/:id" : undefined}
        submitLabel={isNew ? "Create brand" : "Save changes"}
      />
    </>
  );
}
