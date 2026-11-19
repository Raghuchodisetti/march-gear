import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { USER_ROLES } from "@/db/enums";
import { listUsers, USERS_PAGE_SIZE } from "@/server/admin/audience";
import { Button } from "@/components/ui/button";
import { AdminHeader, Badge, EmptyRow, FilterForm, FilterSelect, Pagination, SearchInput, Table, Td, Th, formatDateTime, formatDay, pageParam, strParam } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Customers & staff" };

const ROLE: Record<string, string> = { customer: "Customer", editor: "Editor", admin: "Admin" };

export default async function UsersAdminPage({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const params = { q: strParam(sp.q), role: strParam(sp.role) };
  const { rows, total, page } = await listUsers(params.q, params.role, pageParam(sp.page));

  return (
    <>
      <AdminHeader
        title="Customers & staff"
        description="Everyone with an account. Staff roles can sign in to this panel."
        actions={
          <Button href="/admin/users/new" size="sm" icon={<UserPlus className="size-4" aria-hidden />}>
            Add staff
          </Button>
        }
      />
      <FilterForm resetHref="/admin/users" hasFilters={Boolean(params.q || params.role)}>
        <SearchInput value={params.q} placeholder="Name, email or phone…" />
        <FilterSelect name="role" label="All roles" value={params.role} options={USER_ROLES.map((r) => ({ value: r, label: ROLE[r] }))} />
      </FilterForm>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Contact</Th>
            <Th>Role</Th>
            <Th>Joined</Th>
            <Th>Last sign-in</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={5}>No accounts match.</EmptyRow>}
          {rows.map((u) => (
            <tr key={u.id} className="hover:bg-mist/50">
              <Td>
                <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-red">
                  {u.name}
                </Link>
                {!u.isActive && (
                  <span className="ml-2">
                    <Badge tone="amber">Disabled</Badge>
                  </span>
                )}
              </Td>
              <Td className="text-muted">
                {u.email}
                {u.phone && <span className="block text-[12px]">+91 {u.phone}</span>}
              </Td>
              <Td>
                <Badge tone={u.role === "admin" ? "dark" : u.role === "editor" ? "blue" : "neutral"}>{ROLE[u.role]}</Badge>
              </Td>
              <Td className="whitespace-nowrap text-muted">{formatDay(u.createdAt)}</Td>
              <Td className="whitespace-nowrap text-muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination base="/admin/users" params={params} page={page} pageSize={USERS_PAGE_SIZE} total={total} />
    </>
  );
}
