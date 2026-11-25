import Link from "@/components/admin/desk";
import { UserPlus } from "lucide-react";
import { listAccounts, USERS_PAGE_SIZE, type AccountListKind } from "@/server/admin/audience";
import { ACCOUNT_KINDS, accountHref } from "@/lib/accounts";
import { STAFF_SECTIONS } from "@/lib/staff-access";
import { Button } from "@/components/ui/button";
import { AdminHeader, Badge, EmptyRow, FilterForm, Pagination, SearchInput, Table, Td, Th, formatDateTime, formatDay, pageParam, strParam } from "@/components/admin/ui";

/* One kind of account per list: customers, dealer logins, insurance vendor logins, or staff & admins. */

const COPY: Record<AccountListKind, { title: string; description: string; empty: string }> = {
  customer: {
    title: "Customer accounts",
    description: "People who signed up on the website. Each account shows their saved cars, requests and where they're signed in.",
    empty: "No customer accounts yet.",
  },
  dealer: {
    title: "Dealer logins",
    description: "Sign-ins for the dealer portal (/dealer/login), by dealership. They're created when a dealership registers or adds a team member.",
    empty: "No dealer logins yet.",
  },
  insurer: {
    title: "Vendor logins",
    description: "Sign-ins for the insurance vendor portal (/insurance-vendor/login), by vendor. They're created when a vendor registers or adds a team member.",
    empty: "No vendor logins yet.",
  },
  team: {
    title: "Staff & access",
    description: "Admins sign in at /admin/login and can use everything. Staff sign in at /staff/login and see only the sections you give them.",
    empty: "No staff accounts yet.",
  },
};

const sectionLabels = (keys: string[] | null) => STAFF_SECTIONS.filter((s) => keys?.includes(s.key)).map((s) => s.label);

export async function AccountList({ kind, searchParams }: { kind: AccountListKind; searchParams: Record<string, string | string[] | undefined> }) {
  const params = { q: strParam(searchParams.q) };
  const { rows, total, page } = await listAccounts(kind, params.q, pageParam(searchParams.page));
  const base = kind === "team" ? "/admin/team" : ACCOUNT_KINDS[kind].list;
  const copy = COPY[kind];
  const org = kind === "dealer" || kind === "insurer";
  const cols = 5;

  return (
    <>
      <AdminHeader
        title={copy.title}
        description={copy.description}
        actions={
          kind === "team" && (
            <Button href="/admin/team/new" size="sm" icon={<UserPlus className="size-4" aria-hidden />}>
              Add staff
            </Button>
          )
        }
      />
      <FilterForm resetHref={base} hasFilters={Boolean(params.q)}>
        <SearchInput value={params.q} placeholder="Name, email or phone…" />
      </FilterForm>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Contact</Th>
            <Th>{org ? (kind === "dealer" ? "Dealership" : "Vendor") : kind === "team" ? "Access" : "City"}</Th>
            <Th>Joined</Th>
            <Th>Last sign-in</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={cols}>{params.q ? "No accounts match." : copy.empty}</EmptyRow>}
          {rows.map((u) => {
            const sections = sectionLabels(u.permissions);
            return (
              <tr key={u.id} className="hover:bg-mist/50">
                <Td>
                  <Link href={accountHref(u.role, u.id)} className="font-medium hover:text-red">
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
                  {org ? (
                    u.org ? (
                      <>
                        <Link href={u.org.href} className="hover:text-red">
                          {u.org.name}
                        </Link>
                        <span className="block text-[12px] capitalize text-muted">{u.org.memberRole}</span>
                      </>
                    ) : (
                      <span className="text-muted">Not linked</span>
                    )
                  ) : kind === "team" ? (
                    u.role === "admin" ? (
                      <Badge tone="dark">Admin · everything</Badge>
                    ) : (
                      <span className="flex max-w-[360px] flex-wrap gap-1">
                        <Badge tone="blue">Staff</Badge>
                        {sections.length ? (
                          sections.map((s) => (
                            <Badge key={s} tone="neutral">
                              {s}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[12.5px] text-muted">No sections yet</span>
                        )}
                      </span>
                    )
                  ) : (
                    <span className="text-muted">{u.city ?? "—"}</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-muted">{formatDay(u.createdAt)}</Td>
                <Td className="whitespace-nowrap text-muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Pagination base={base} params={params} page={page} pageSize={USERS_PAGE_SIZE} total={total} />
    </>
  );
}
