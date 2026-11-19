import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { deleteDealerAction, saveDealerAction } from "@/server/actions/catalog";
import { brandOptions, cityOptions, dealerForm, NEW_DEFAULTS } from "@/server/admin/catalog";
import { requireStaff } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { AdminHeader } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/delete-button";
import { ResourceForm } from "@/components/admin/resource-form";
import { withOptions } from "@/components/admin/fields";
import { dealerSections } from "@/components/admin/resources";

export const metadata: Metadata = { title: "Dealer" };

export default async function DealerEditPage({ params }: PageProps<"/admin/dealers/[id]">) {
  await requireStaff();
  const { id } = await params;
  const isNew = id === "new";
  const [initial, brands] = await Promise.all([isNew ? NEW_DEFAULTS.dealer() : dealerForm(id), brandOptions({ multi: true })]);
  if (!initial) notFound();

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/dealers", label: "Dealers" }}
        title={isNew ? "Add dealer" : String(initial.name)}
        actions={
          !isNew && (
            <>
              <Button href={`/dealers/${id}`} target="_blank" variant="outline" size="sm" icon={<ExternalLink className="size-4" aria-hidden />}>
                View on site
              </Button>
              <DeleteButton action={deleteDealerAction.bind(null, id)} confirmText={`Delete ${initial.name}? Its reviews are deleted too.`} redirectTo="/admin/dealers" />
            </>
          )
        }
      />
      <ResourceForm
        sections={withOptions(dealerSections, { brand: brands, city: cityOptions() })}
        initial={initial}
        action={saveDealerAction.bind(null, isNew ? null : id)}
        listHref="/admin/dealers"
        // The ID can change, so always land on the saved record.
        createdHref="/admin/dealers/:id"
        submitLabel={isNew ? "Create dealer" : "Save changes"}
      />
    </>
  );
}
