import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { FileText, Plus } from "lucide-react";
import { listGuidesAdmin } from "@/server/guides";
import { guideHref } from "@/lib/guides";
import { Button } from "@/components/ui/button";
import { AdminHeader, Badge, EmptyRow, FilterForm, SearchInput, Table, Td, Th, formatDay, strParam } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Guides" };

export default async function GuidesAdminPage({ searchParams }: PageProps<"/admin/guides">) {
  const sp = await searchParams;
  const q = strParam(sp.q);
  const rows = await listGuidesAdmin(q);
  return (
    <>
      <AdminHeader
        title="Guides"
        description="Topic pages on /guides, linked from the site footer. Upload a PDF with a subject and topic name — its text becomes the page, and every topic gets its own link."
        actions={
          <Button href="/admin/guides/new" size="sm" icon={<Plus className="size-4" aria-hidden />}>
            New guide
          </Button>
        }
      />
      <FilterForm resetHref="/admin/guides" hasFilters={Boolean(q)}>
        <SearchInput value={q} placeholder="Topic, subject or URL…" />
      </FilterForm>
      <Table>
        <thead>
          <tr>
            <Th>Topic</Th>
            <Th>Subject</Th>
            <Th>From</Th>
            <Th>Words</Th>
            <Th>Updated</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={6}>{q ? "No guides match." : "No guides yet. Upload a PDF to create the first topic page."}</EmptyRow>}
          {rows.map((g) => (
            <tr key={g.id} className="hover:bg-mist/50">
              <Td>
                <Link href={`/admin/guides/${g.id}`} className="block max-w-[420px] font-medium hover:text-red">
                  <span className="line-clamp-2">{g.title}</span>
                </Link>
                <span className="mt-0.5 block text-[12px] text-muted">{guideHref(g.slug)}</span>
              </Td>
              <Td className="whitespace-nowrap text-muted">{g.subject}</Td>
              <Td className="text-muted">
                {g.pdfName ? (
                  <span className="inline-flex max-w-[220px] items-center gap-1.5">
                    <FileText aria-hidden className="size-3.5 shrink-0" />
                    <span className="truncate" title={g.pdfName}>
                      {g.pdfName}
                    </span>
                    {g.pdfPages ? <span className="shrink-0 num">· {g.pdfPages} pp</span> : null}
                  </span>
                ) : (
                  "—"
                )}
              </Td>
              <Td className="whitespace-nowrap num">{g.words.toLocaleString("en-IN")}</Td>
              <Td className="whitespace-nowrap num">{formatDay(g.updatedAt)}</Td>
              <Td>{g.status === "published" ? <Badge tone="green">Published</Badge> : <Badge tone="amber">Draft</Badge>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
