import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { listArticles } from "@/server/admin/catalog";
import { Button } from "@/components/ui/button";
import { AdminHeader, Badge, EmptyRow, FilterForm, SearchInput, Table, Td, Th, formatDay, strParam } from "@/components/admin/ui";
import { Thumb } from "@/components/admin/thumb";

export const metadata: Metadata = { title: "News & reviews" };

export default async function NewsAdminPage({ searchParams }: PageProps<"/admin/news">) {
  const sp = await searchParams;
  const q = strParam(sp.q);
  const rows = await listArticles(q);
  return (
    <>
      <AdminHeader
        title="News & reviews"
        description="Stories on /news and /reviews. Drafts and future-dated stories stay hidden until published."
        actions={
          <Button href="/admin/news/new" size="sm" icon={<Plus className="size-4" aria-hidden />}>
            Write story
          </Button>
        }
      />
      <FilterForm resetHref="/admin/news" hasFilters={Boolean(q)}>
        <SearchInput value={q} placeholder="Headline or slug…" />
      </FilterForm>
      <Table>
        <thead>
          <tr>
            <Th>Story</Th>
            <Th>Category</Th>
            <Th>Author</Th>
            <Th>Date</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={5}>No stories match.</EmptyRow>}
          {rows.map((a) => (
            <tr key={a.id} className="hover:bg-mist/50">
              <Td>
                <Link href={`/admin/news/${a.id}`} className="flex items-center gap-3 font-medium hover:text-red">
                  <Thumb src={a.image} />
                  <span className="line-clamp-2 max-w-[420px]">{a.title}</span>
                </Link>
              </Td>
              <Td className="whitespace-nowrap text-muted">{a.category}</Td>
              <Td className="whitespace-nowrap text-muted">{a.author}</Td>
              <Td className="whitespace-nowrap num">{formatDay(a.publishedOn)}</Td>
              <Td>{a.status === "published" ? <Badge tone="green">Published</Badge> : <Badge tone="amber">Draft</Badge>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
