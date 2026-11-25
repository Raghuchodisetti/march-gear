import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { ClipboardCheck, FileSearch, ShieldCheck } from "lucide-react";
import { INS_PRODUCT_CATEGORIES } from "@/db/enums";
import { INS_PRODUCT_CATEGORY_LABEL, INS_VENDOR_STATUS_LABEL } from "@/insurance/labels";
import { INS_PRODUCTS_PAGE_SIZE, insProductFilterOptions, listInsProducts } from "@/server/admin/insurance";
import { requireStaff } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { AdminHeader, FilterForm, FilterSelect, Pagination, SearchInput, formatDay, hrefWith, pageParam, strParam } from "@/components/admin/ui";
import { EmptyState, INS_PRODUCT_QUEUE, LinkTabs, ProductPill, SlaAge } from "@/components/admin/insurance/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Insurance products" };

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "queue", label: "To review" },
  { key: "published", label: "Published" },
  { key: "approved", label: "Approved — not live" },
  { key: "with_vendor", label: "Changes requested" },
  { key: "suspended", label: "Suspended" },
  { key: "rejected", label: "Rejected" },
  { key: "draft", label: "Drafts" },
] as const;

const num = (v: string | undefined) => (v && /^\d+$/.test(v) ? v : undefined);

export default async function InsuranceProductsPage({ searchParams }: PageProps<"/admin/insurance/products">) {
  await requireStaff();
  const sp = await searchParams;
  const params = { q: strParam(sp.q), status: strParam(sp.status), category: strParam(sp.category), vendor: num(strParam(sp.vendor)), company: num(strParam(sp.company)) };
  const [{ rows, total, page, byStatus, now }, options] = await Promise.all([
    listInsProducts({ ...params, vendor: params.vendor ? Number(params.vendor) : undefined, company: params.company ? Number(params.company) : undefined, page: pageParam(sp.page) }),
    insProductFilterOptions(),
  ]);
  const all = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const tabCount = (k: string) => (k === "" ? all : k === "queue" ? INS_PRODUCT_QUEUE.reduce((a, s) => a + byStatus[s], 0) : k === "with_vendor" ? byStatus.changes_requested : byStatus[k as keyof typeof byStatus]);
  const hasFilters = Boolean(params.q || params.category || params.vendor || params.company);
  const base = "/admin/insurance/products";

  return (
    <>
      <AdminHeader
        title="Insurance products"
        description="Every vendor's products — open one to review all its details, covers, pricing and history."
        actions={
          <Button href="/admin/insurance/product-approvals" size="sm" icon={<ClipboardCheck className="size-4" aria-hidden />}>
            Approval queue
          </Button>
        }
      />
      <LinkTabs active={params.status ?? ""} items={STATUS_TABS.map((t) => ({ key: t.key, label: t.label, count: tabCount(t.key), href: hrefWith(base, params, { status: t.key || undefined, page: undefined }) }))} />
      <FilterForm resetHref={hrefWith(base, { status: params.status }, {})} hasFilters={hasFilters}>
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <SearchInput value={params.q} placeholder="Product, reference, code, UIN, vendor…" />
        <FilterSelect name="category" label="Any category" value={params.category} options={INS_PRODUCT_CATEGORIES.map((c) => ({ value: c, label: INS_PRODUCT_CATEGORY_LABEL[c] }))} />
        <FilterSelect name="vendor" label="Any vendor" value={params.vendor} options={options.vendors} />
        <FilterSelect name="company" label="Any insurer" value={params.company} options={options.companies} />
      </FilterForm>
      <p className="-mt-1 mb-3 text-[12.5px] text-muted num">
        {total.toLocaleString("en-IN")} product{total === 1 ? "" : "s"}
      </p>

      {rows.length === 0 ? (
        <div className="border border-line bg-white">
          <EmptyState icon={<ShieldCheck aria-hidden className="size-5" />} title={hasFilters || params.status ? "No products match" : "No products yet"}>
            {hasFilters || params.status ? "Try another search or filter." : "Products appear here once vendors create them in their portal."}
          </EmptyState>
        </div>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`${base}/${p.id}`} className="block border border-line bg-white p-4">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold">{p.name}</span>
                      <span className="block truncate text-[12px] text-muted">
                        {p.reference} · {INS_PRODUCT_CATEGORY_LABEL[p.category]}
                      </span>
                    </span>
                    <ProductPill status={p.status} />
                  </span>
                  <span className="mt-2 block truncate text-[12.5px] text-muted">
                    {p.vendorName} · {p.companyName}
                  </span>
                  {INS_PRODUCT_QUEUE.includes(p.status) && <SlaAge since={p.submittedAt ?? p.createdAt} now={now} prefix="Waiting" className="mt-1.5" />}
                </Link>
              </li>
            ))}
          </ul>
          <div className="relative hidden overflow-x-auto border border-line bg-white md:block">
            <table className="w-full min-w-[1000px] border-collapse text-left text-[13.5px]">
              <thead>
                <tr className="text-[12px] text-muted">
                  {["Product", "Vendor", "Insurer", "Covers", "Status", "Updated", ""].map((h, i) => (
                    <th key={i} className="border-b border-line bg-mist/60 px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const waiting = INS_PRODUCT_QUEUE.includes(p.status);
                  return (
                    <tr key={p.id} className="align-top transition-colors hover:bg-mist/40">
                      <td className="min-w-[230px] border-b border-line px-4 py-3">
                        <Link href={`${base}/${p.id}`} className="font-semibold hover:text-red">
                          {p.name}
                        </Link>
                        <span className="mt-0.5 block text-[12px] text-muted">
                          {p.reference} · {INS_PRODUCT_CATEGORY_LABEL[p.category]}
                        </span>
                      </td>
                      <td className="max-w-[200px] border-b border-line px-4 py-3">
                        <Link href={`/admin/insurance/vendors/${p.vendorId}`} className="block truncate hover:text-red" title={p.vendorName}>
                          {p.vendorName}
                        </Link>
                        {p.vendorStatus !== "approved" && <span className="block text-[11.5px] text-muted">Vendor {INS_VENDOR_STATUS_LABEL[p.vendorStatus].toLowerCase()}</span>}
                      </td>
                      <td className="max-w-[180px] border-b border-line px-4 py-3">
                        <span className="block truncate" title={p.companyName}>{p.companyName}</span>
                        {!p.companyActive && <span className="block text-[11.5px] text-muted">Inactive — hidden</span>}
                      </td>
                      <td className="whitespace-nowrap border-b border-line px-4 py-3 text-[12.5px]">
                        {p.covers ? (
                          <>
                            <span className="num">{p.covers} used</span>
                            {p.coversPending > 0 && <span className="block font-medium text-[#9a5b00]">{p.coversPending} pending</span>}
                            {p.coversBlocked > 0 && <span className="block font-medium text-red">{p.coversBlocked} not approved</span>}
                          </>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                      <td className="border-b border-line px-4 py-3">
                        <ProductPill status={p.status} />
                      </td>
                      <td className="whitespace-nowrap border-b border-line px-4 py-3 text-[12.5px]">{waiting ? <SlaAge since={p.submittedAt ?? p.createdAt} now={now} prefix="Waiting" className="text-[12.5px]" /> : <span className="text-muted">{formatDay(p.updatedAt)}</span>}</td>
                      <td className="border-b border-line px-4 py-3">
                        <div className="flex justify-end">
                          <Link href={`${base}/${p.id}`} className={cn("inline-flex h-8 items-center gap-1.5 rounded-[3px] px-2.5 text-[12.5px] font-medium", waiting ? "bg-red text-white hover:bg-red-600" : "border border-line hover:border-ink")}>
                            {waiting && <FileSearch aria-hidden className="size-3.5" />} {waiting ? "Review" : "Open"}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Pagination base={base} params={params} page={page} pageSize={INS_PRODUCTS_PAGE_SIZE} total={total} />
    </>
  );
}
