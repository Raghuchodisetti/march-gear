import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, ExternalLink, FileText } from "lucide-react";
import { deleteGuideAction, saveGuideAction } from "@/server/actions/guides";
import { guideForAdmin } from "@/server/guides";
import { getDesk } from "@/server/auth";
import { deskPath } from "@/lib/staff-access";
import { blocksToText, formatMB, guideHref, readMinutes, GUIDE_SUMMARY_MAX } from "@/lib/guides";
import { AdminHeader, Panel, ViewOnSite, formatDateTime } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/delete-button";
import { ResourceForm } from "@/components/admin/resource-form";
import { GuidePdfReplace } from "@/components/admin/guide-upload";
import type { Section } from "@/components/admin/fields";

export const metadata: Metadata = { title: "Guide" };

const PUBLISH = [
  { value: "published", label: "Published — visible on the site" },
  { value: "draft", label: "Draft — hidden" },
];

const sections: Section[] = [
  {
    title: "Topic",
    fields: [
      { name: "subject", label: "Subject", type: "text", required: true, hint: "Guides are grouped by subject on /guides." },
      { name: "title", label: "Topic name", type: "text", required: true },
      { name: "slug", label: "URL", type: "text", required: true, wide: true, hint: "The page's link: /guides/<this>. Changing it breaks links people already have." },
      {
        name: "summary",
        label: "Summary",
        type: "textarea",
        rows: 3,
        wide: true,
        hint: `Shown on /guides and in search results (up to ${GUIDE_SUMMARY_MAX} characters). Leave empty to use the start of the page.`,
      },
    ],
  },
  {
    title: "Page content",
    description: "Read from the PDF. Check it reads well — PDF layouts don't always convert perfectly — and edit anything that needs it.",
    fields: [
      {
        name: "content",
        label: "Text",
        type: "textarea",
        rows: 28,
        required: true,
        wide: true,
        hint: "“## ” starts a section heading and “### ” a sub-heading. “- ” is a bullet and “1. ” a numbered item. “| a | b |” is a table row. Leave a blank line between paragraphs.",
      },
    ],
  },
  {
    title: "Publishing",
    fields: [
      { name: "status", label: "Status", type: "select", required: true, options: PUBLISH },
      { name: "showPdf", label: "Offer the PDF as a download", type: "checkbox", hint: "Adds a “Download PDF” button to the page." },
    ],
  },
];

export default async function GuideEditPage({ params, searchParams }: PageProps<"/admin/guides/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const recordId = /^\d{1,10}$/.test(id) ? Number(id) : null;
  const g = recordId ? await guideForAdmin(recordId) : null;
  if (!g) notFound();
  const live = g.status === "published";

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/guides", label: "Guides" }}
        title={g.title}
        description={`${g.subject} · ${guideHref(g.slug)}`}
        actions={
          <>
            <ViewOnSite href={guideHref(g.slug)} offline={!live && "Draft — not on the site"} />
            <DeleteButton action={deleteGuideAction.bind(null, g.id)} confirmText="Delete this guide and its PDF? Its page and link stop working. This can't be undone." redirectTo="/admin/guides" />
          </>
        }
      />
      {sp.created && (
        <div role="status" className="mb-6 flex items-start gap-3 border border-[#1e7a3c]/25 bg-[#e8f5ec] px-5 py-4 text-[14px]">
          <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-[#1e7a3c]" />
          <p>
            <span className="font-medium">The topic page is ready{live ? " and live" : " as a draft"}.</span>{" "}
            {live ? (
              <>
                Its link is{" "}
                <a href={guideHref(g.slug)} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  {guideHref(g.slug)}
                </a>
                .
              </>
            ) : (
              "Publish it below when it's ready."
            )}{" "}
            Read the text below once — headings, lists and tables come from the PDF&apos;s layout, which doesn&apos;t always convert perfectly.
          </p>
        </div>
      )}
      <ResourceForm
        key={g.updatedAt.getTime()}
        sections={sections}
        initial={{ subject: g.subject, title: g.title, slug: g.slug, summary: g.summary, content: blocksToText(g.content), status: g.status, showPdf: g.showPdf }}
        action={saveGuideAction.bind(null, g.id)}
        listHref="/admin/guides"
        aside={
          <>
            <Panel title="Source PDF">
              {g.pdfName ? (
                <div className="space-y-4">
                  <a href={deskPath(await getDesk(), `/admin/guides/${g.id}/pdf`)} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-[3px] border border-line px-4 py-3 transition-colors hover:border-ink/30">
                    <FileText aria-hidden className="mt-0.5 size-5 shrink-0 text-red" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{g.pdfName}</span>
                      <span className="block text-[12px] text-muted num">
                        {g.pdfSize ? formatMB(g.pdfSize) : ""}
                        {g.pdfPages ? ` · ${g.pdfPages} ${g.pdfPages === 1 ? "page" : "pages"}` : ""}
                      </span>
                    </span>
                    <ExternalLink aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                  </a>
                  <GuidePdfReplace guideId={g.id} />
                </div>
              ) : (
                <GuidePdfReplace guideId={g.id} />
              )}
            </Panel>
            <Panel title="Page">
              <dl className="space-y-2 text-[13px]">
                {[
                  ["Words", g.words.toLocaleString("en-IN")],
                  ["Reading time", `${readMinutes(g.words)} min`],
                  ["Created", `${formatDateTime(g.createdAt)}${g.author ? ` by ${g.author}` : ""}`],
                  ["Last saved", formatDateTime(g.updatedAt)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right num">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </>
        }
      />
    </>
  );
}
