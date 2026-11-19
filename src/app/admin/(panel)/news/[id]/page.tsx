import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { deleteArticleAction, saveArticleAction } from "@/server/actions/catalog";
import { articleForm, authorOptions, carOptions, NEW_DEFAULTS } from "@/server/admin/catalog";
import { requireStaff } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { AdminHeader } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/delete-button";
import { ResourceForm } from "@/components/admin/resource-form";
import { withOptions } from "@/components/admin/fields";
import { articleSections } from "@/components/admin/resources";

export const metadata: Metadata = { title: "Story" };

export default async function ArticleEditPage({ params }: PageProps<"/admin/news/[id]">) {
  await requireStaff();
  const { id } = await params;
  const isNew = id === "new";
  const recordId = isNew ? null : /^\d+$/.test(id) ? Number(id) : NaN;
  const [initial, authors, cars] = await Promise.all([
    isNew ? NEW_DEFAULTS.article() : Number.isNaN(recordId) ? null : articleForm(recordId!),
    authorOptions(),
    carOptions(),
  ]);
  if (!initial) notFound();

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/news", label: "News & reviews" }}
        title={isNew ? "Write a story" : String(initial.title)}
        actions={
          !isNew && (
            <>
              <Button href={`/news/${initial.slug}`} target="_blank" variant="outline" size="sm" icon={<ExternalLink className="size-4" aria-hidden />}>
                View on site
              </Button>
              <DeleteButton action={deleteArticleAction.bind(null, recordId)} confirmText="Delete this story? This can't be undone." redirectTo="/admin/news" />
            </>
          )
        }
      />
      <ResourceForm
        sections={withOptions(articleSections, { authorId: authors, relatedCar: cars })}
        initial={initial}
        action={saveArticleAction.bind(null, recordId)}
        listHref="/admin/news"
        createdHref={isNew ? "/admin/news/:id" : undefined}
        submitLabel={isNew ? "Create story" : "Save changes"}
      />
    </>
  );
}
