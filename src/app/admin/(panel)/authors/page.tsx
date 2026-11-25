import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { Plus } from "lucide-react";
import { listAuthors } from "@/server/admin/catalog";
import { Button } from "@/components/ui/button";
import { AdminHeader, EmptyRow, Table, Td, Th } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Authors" };

export default async function AuthorsAdminPage() {
  const rows = await listAuthors();
  return (
    <>
      <AdminHeader
        title="Authors"
        description="Bylines for news and expert reviews."
        actions={
          <Button href="/admin/authors/new" size="sm" icon={<Plus className="size-4" aria-hidden />}>
            Add author
          </Button>
        }
      />
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Role</Th>
            <Th>Stories</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={3}>No authors yet.</EmptyRow>}
          {rows.map((a) => (
            <tr key={a.id} className="hover:bg-mist/50">
              <Td>
                <Link href={`/admin/authors/${a.id}`} className="font-medium hover:text-red">
                  {a.name}
                </Link>
              </Td>
              <Td className="text-muted">{a.role}</Td>
              <Td className="num">{a.stories}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
