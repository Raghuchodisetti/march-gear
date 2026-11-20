import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { BLOCKS, isBlockKey } from "@/content/registry";
import { resetContentAction, saveContentAction } from "@/server/actions/content";
import { contentForm } from "@/server/admin/content";
import { requireStaff } from "@/server/auth";
import { AdminHeader, Panel, formatDateTime } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/delete-button";
import { ResourceForm } from "@/components/admin/resource-form";

export async function generateMetadata({ params }: PageProps<"/admin/content/[key]">): Promise<Metadata> {
  const { key } = await params;
  return { title: isBlockKey(key) ? BLOCKS[key].title : "Site content" };
}

export default async function ContentBlockPage({ params }: PageProps<"/admin/content/[key]">) {
  await requireStaff();
  const { key } = await params;
  if (!isBlockKey(key)) notFound();
  const block = BLOCKS[key];
  const { values, meta, invalidSaved } = await contentForm(key);

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/content", label: "Site content" }}
        title={block.title}
        description={
          <>
            {block.description}
            <span className="mt-1 block text-[12.5px]">
              Used on: {block.usedOn.join(" · ")}
              {meta ? ` · last updated ${formatDateTime(meta.updatedAt)}${meta.updatedBy ? ` by ${meta.updatedBy}` : ""}` : " · showing the launch defaults"}
            </span>
          </>
        }
        actions={
          meta && (
            <DeleteButton
              action={resetContentAction.bind(null, key)}
              label="Reset to default"
              doneText="Reset to the launch version"
              icon={<RotateCcw aria-hidden className="size-4" />}
              confirmText={`Reset “${block.title}” to the launch version? Your saved changes will be lost.`}
              redirectTo={`/admin/content/${key}`}
            />
          )
        }
      />
      {invalidSaved && (
        <p role="alert" className="mb-6 border-l-2 border-red bg-red-50 px-4 py-3 text-[13.5px] text-red">
          The saved version no longer matches this form, so the site is showing the defaults. Saving will replace it.
        </p>
      )}
      {block.sections.length === 0 ? (
        <Panel>
          <p className="text-[14px] text-muted">This section isn&apos;t editable yet.</p>
        </Panel>
      ) : (
        <ResourceForm
          // A new saved version (or a reset to the defaults) remounts the form, so it shows what's live now.
          key={meta ? meta.updatedAt.toISOString() : "defaults"}
          sections={block.sections}
          initial={values}
          action={saveContentAction.bind(null, key)}
          listHref="/admin/content"
          submitLabel="Save & publish"
        />
      )}
    </>
  );
}
