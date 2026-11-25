import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { FileSearch, Inbox, ShieldCheck } from "lucide-react";
import { INS_PRODUCT_CATEGORY_LABEL, INS_VENDOR_STATUS_LABEL } from "@/insurance/labels";
import { insProductQueue } from "@/server/admin/insurance";
import { requireStaff } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { AdminHeader, formatDateTime } from "@/components/admin/ui";
import { EmptyState, LinkTabs, ProductPill, SlaAge } from "@/components/admin/insurance/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Product approvals" };

type View = "review" | "vendor" | "decided";

function Covers({ total, pending, blocked }: { total: number; pending: number; blocked: number }) {
  if (!total) return <span className="text-muted">No covers</span>;
  return (
    <span className="text-[12.5px]">
      <span className="num">{total} used</span>
      {blocked > 0 ? <span className="block font-medium text-red">{blocked} not approved — blocks approval</span> : pending > 0 ? <span className="block font-medium text-[#9a5b00]">{pending} pending — approve together</span> : <span className="block text-[#1e7a3c]">All approved</span>}
    </span>
  );
}

export default async function ProductApprovalsPage({ searchParams }: PageProps<"/admin/insurance/product-approvals">) {
  await requireStaff();
  const sp = await searchParams;
  const view: View = sp.view === "vendor" || sp.view === "decided" ? sp.view : "review";
  const { rows, counts, now } = await insProductQueue(view);
  const since = (r: (typeof rows)[number]) => (view === "review" ? (r.submittedAt ?? r.createdAt) : r.updatedAt);

  return (
    <>
      <AdminHeader
        title="Product approvals"
        description="Products vendors have submitted — oldest first. Open one to check every field, its covers and a sample estimate, then decide. Anything waiting over 48 hours is flagged."
        actions={
          <Button href="/admin/insurance/products" variant="outline" size="sm" icon={<ShieldCheck className="size-4" aria-hidden />}>
            All products
          </Button>
        }
      />
      <LinkTabs
        active={view}
        items={[
          { key: "review", label: "To review", count: counts.review, href: "/admin/insurance/product-approvals" },
          { key: "vendor", label: "Waiting for vendor", count: counts.vendor, href: "/admin/insurance/product-approvals?view=vendor" },
          { key: "decided", label: "Decided", href: "/admin/insurance/product-approvals?view=decided" },
        ]}
      />

      {rows.length === 0 ? (
        <div className="border border-line bg-white">
          <EmptyState icon={<Inbox aria-hidden className="size-5" />} title={view === "review" ? "Queue is clear" : view === "vendor" ? "Nothing with vendors" : "No decisions yet"}>
            {view === "review" ? "Products vendors submit for approval appear here, oldest first." : view === "vendor" ? "Products sent back for changes appear here until the vendor resubmits." : "Approved, published, rejected and suspended products appear here."}
          </EmptyState>
        </div>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/insurance/products/${p.id}`} className="block border border-line bg-white p-4">
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
                  <span className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <Covers total={p.covers} pending={p.coversPending} blocked={p.coversBlocked} />
                    {view !== "decided" ? <SlaAge since={since(p)} now={now} prefix={view === "review" ? "Waiting" : "Sent back"} /> : <span className="text-[12px] text-muted">{formatDateTime(p.updatedAt)}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="relative hidden overflow-x-auto border border-line bg-white md:block">
            <table className="w-full min-w-[980px] border-collapse text-left text-[13.5px]">
              <thead>
                <tr className="text-[12px] text-muted">
                  {["Product", "Vendor", "Insurer", "Covers", "Status", view === "review" ? "Waiting" : view === "vendor" ? "Sent back" : "Decided", ""].map((h, i) => (
                    <th key={i} className="border-b border-line bg-mist/60 px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="align-top transition-colors hover:bg-mist/40">
                    <td className="min-w-[220px] border-b border-line px-4 py-3">
                      <Link href={`/admin/insurance/products/${p.id}`} className="font-semibold hover:text-red">
                        {p.name}
                      </Link>
                      <span className="mt-0.5 block text-[12px] text-muted">
                        {p.reference} · {INS_PRODUCT_CATEGORY_LABEL[p.category]}
                      </span>
                    </td>
                    <td className="max-w-[220px] border-b border-line px-4 py-3">
                      <Link href={`/admin/insurance/vendors/${p.vendorId}`} className="block truncate hover:text-red">
                        {p.vendorName}
                      </Link>
                      {p.vendorStatus !== "approved" && <span className="block text-[11.5px] text-muted">Vendor {INS_VENDOR_STATUS_LABEL[p.vendorStatus].toLowerCase()} — can&apos;t publish yet</span>}
                    </td>
                    <td className="max-w-[200px] border-b border-line px-4 py-3">
                      <span className="block truncate">{p.companyName}</span>
                      {!p.companyActive && <span className="block text-[11.5px] text-muted">Inactive</span>}
                    </td>
                    <td className="border-b border-line px-4 py-3">
                      <Covers total={p.covers} pending={p.coversPending} blocked={p.coversBlocked} />
                    </td>
                    <td className="border-b border-line px-4 py-3">
                      <ProductPill status={p.status} />
                    </td>
                    <td className="whitespace-nowrap border-b border-line px-4 py-3">{view !== "decided" ? <SlaAge since={since(p)} now={now} className="text-[12.5px]" /> : <span className="text-[12.5px] text-muted">{formatDateTime(p.updatedAt)}</span>}</td>
                    <td className="border-b border-line px-4 py-3">
                      <div className="flex justify-end">
                        <Link href={`/admin/insurance/products/${p.id}`} className={cn("inline-flex h-8 items-center gap-1.5 rounded-[3px] px-2.5 text-[12.5px] font-medium", view === "review" ? "bg-red text-white hover:bg-red-600" : "border border-line hover:border-ink")}>
                          {view === "review" && <FileSearch aria-hidden className="size-3.5" />} {view === "review" ? "Review" : "Open"}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length >= (view === "decided" ? 40 : 100) && <p className="mt-3 text-[12.5px] text-muted">Showing the first {rows.length}. Use All products to search and filter everything.</p>}
        </>
      )}
    </>
  );
}
