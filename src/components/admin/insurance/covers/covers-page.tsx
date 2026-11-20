import { redirect } from "next/navigation";
import { Layers } from "lucide-react";
import type { InsCoverType } from "@/db/enums";
import { STANDARD_COVER_BY_KEY } from "@/insurance/covers";
import { INS_COVERS_PAGE_SIZE, getInsCoverRow, listInsCovers } from "@/server/admin/insurance";
import { AdminHeader, FilterForm, FilterSelect, Pagination, SearchInput, hrefWith, pageParam, strParam } from "@/components/admin/ui";
import { EmptyState, LinkTabs } from "../ui";
import { CoverBoard } from "./cover-board";

/* Shared server view for /admin/insurance/coverage and /admin/insurance/add-ons. */

const TABS = [
  { key: "", label: "To review" },
  { key: "changes_requested", label: "Changes requested" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "draft", label: "Drafts" },
  { key: "all", label: "All" },
] as const;

export async function CoversPage({ type, searchParams }: { type: InsCoverType; searchParams: Record<string, string | string[] | undefined> }) {
  const sp = searchParams;
  const base = type === "addon" ? "/admin/insurance/add-ons" : "/admin/insurance/coverage";
  const vendorParam = strParam(sp.vendor);
  const params = { status: strParam(sp.status), vendor: vendorParam && /^\d+$/.test(vendorParam) ? vendorParam : undefined, key: strParam(sp.key), q: strParam(sp.q) };
  const reviewParam = strParam(sp.review);
  const reviewId = reviewParam && /^\d+$/.test(reviewParam) ? Number(reviewParam) : null;
  const [list, extra] = await Promise.all([
    listInsCovers(type, { ...params, vendor: params.vendor ? Number(params.vendor) : undefined, page: pageParam(sp.page) }),
    reviewId ? getInsCoverRow(reviewId) : Promise.resolve(null),
  ]);
  // A review link to the other kind of cover goes to its own page.
  if (extra && extra.type !== type) redirect(`${extra.type === "addon" ? "/admin/insurance/add-ons" : "/admin/insurance/coverage"}?status=all&review=${extra.id}`);
  const { rows, total, page, byStatus, keys, vendors, now } = list;
  const all = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const count = (k: string) => (k === "" ? byStatus.pending_approval : k === "all" ? all : byStatus[k as keyof typeof byStatus]);
  const hasFilters = Boolean(params.vendor || params.key || params.q);
  const noun = type === "addon" ? "add-on" : "coverage item";
  const listParams = { ...params, page: sp.page ? String(pageParam(sp.page)) : undefined };

  return (
    <>
      <AdminHeader
        title={type === "addon" ? "Add-on covers" : "Coverage items"}
        description={
          type === "addon"
            ? "Add-ons vendors offer with their products (zero depreciation, engine protection, roadside assistance…). Only approved add-ons appear publicly and in estimates — a product can't be approved while one it uses is pending."
            : "The coverage items vendors attach to their products. Only approved items appear publicly — a product can't be approved while one it uses is pending."
        }
      />
      <LinkTabs active={params.status ?? ""} items={TABS.map((t) => ({ key: t.key, label: t.label, count: count(t.key), href: hrefWith(base, { ...params, status: undefined }, { status: t.key || undefined }) }))} />
      <FilterForm resetHref={hrefWith(base, { status: params.status }, {})} hasFilters={hasFilters}>
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <SearchInput value={params.q} placeholder={`Name, description, vendor…`} />
        <FilterSelect name="vendor" label="Any vendor" value={params.vendor} options={vendors} />
        <FilterSelect name="key" label="Any cover type" value={params.key} options={keys.map((k) => ({ value: k, label: k === "custom" ? "Custom" : (STANDARD_COVER_BY_KEY[k]?.name ?? k) }))} />
      </FilterForm>

      {rows.length === 0 && !extra ? (
        <div className="border border-line bg-white">
          <EmptyState icon={<Layers aria-hidden className="size-5" />} title={!params.status && !hasFilters ? `No ${noun}s waiting` : `No ${noun}s match`}>
            {!params.status && !hasFilters ? `${noun[0].toUpperCase()}${noun.slice(1)}s vendors submit for approval appear here, oldest first.` : "Try another tab, search or filter."}
          </EmptyState>
        </div>
      ) : (
        <>
          {rows.length === 0 && <p className="mb-3 border border-line bg-white px-4 py-6 text-center text-[13.5px] text-muted">No {noun}s match this view.</p>}
          <CoverBoard key={`${params.status ?? ""}-${page}`} rows={rows} type={type} now={now} initialReview={reviewId} extra={extra} />
          <Pagination base={base} params={listParams} page={page} pageSize={INS_COVERS_PAGE_SIZE} total={total} />
        </>
      )}
    </>
  );
}
