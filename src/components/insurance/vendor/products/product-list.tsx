"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Copy, ExternalLink, Eye, EyeOff, Globe, Loader2, MessageSquareWarning, PencilLine, Search, Send, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { INS_PRODUCT_CATEGORIES, type InsProductCategory, type InsProductStatus } from "@/db/enums";
import { INS_PRODUCT_CATEGORY_LABEL, INS_PRODUCT_STATUS_LABEL, INS_PRODUCT_STATUS_TONE } from "@/insurance/labels";
import { cn } from "@/lib/utils";
import { Badge, formatDateTime } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { useUI } from "@/components/providers/app-provider";
import { ConfirmDialog } from "@/components/portal/profile/kit";
import { deleteProductAction, duplicateProductAction, publishProductAction, submitProductAction, unpublishProductAction, withdrawProductAction } from "@/server/actions/ins-products";
import { control } from "./controls";
import { RowMenu, type MenuItem } from "./row-menu";
import { PRODUCT_ATTENTION, PRODUCT_LOCKED, PRODUCT_SORTS, PRODUCT_SUBMITTABLE, PRODUCT_TABS, type ProductListRow, type ProductSort, type ProductTab } from "./shared";

/* ──────────────────────────────────────────────────────────────
   /insurance-vendor/products: status tabs with counts, category
   filter, search, sort, row actions (publish, unpublish, submit,
   withdraw, duplicate, delete). Filters live in the URL.
   ────────────────────────────────────────────────────────────── */

export interface ProductFilters {
  tab: ProductTab;
  category: InsProductCategory | "";
  q: string;
  sort: ProductSort;
  dir: "asc" | "desc";
  page: number;
}

export function ProductStatusBadge({ status }: { status: InsProductStatus }) {
  return <Badge tone={INS_PRODUCT_STATUS_TONE[status]}>{INS_PRODUCT_STATUS_LABEL[status]}</Badge>;
}

type Confirm = { kind: "publish" | "unpublish" | "delete" | "withdraw"; row: ProductListRow };

export function ProductList({
  rows,
  total,
  pageSize,
  filters,
  tabCounts,
  canManage,
  usage,
}: {
  rows: ProductListRow[];
  total: number;
  pageSize: number;
  filters: ProductFilters;
  tabCounts: Record<ProductTab, number>;
  canManage: boolean;
  usage: { published: number; limit: number | null; planName: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useUI();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(filters.q);
  const [sentQ, setSentQ] = useState(filters.q);
  const [seenQ, setSeenQ] = useState(filters.q);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);

  if (seenQ !== filters.q) {
    setSeenQ(filters.q);
    if (filters.q !== sentQ) {
      setQ(filters.q);
      setSentQ(filters.q);
    }
  }

  // The filters we last asked for — so a search typed while a tab change is still loading keeps that tab.
  const latest = useRef(filters);
  useEffect(() => {
    latest.current = filters;
  }, [filters]);
  const go = (patch: Partial<ProductFilters>) => {
    const next = { ...latest.current, page: 1, ...patch };
    latest.current = next;
    const p = new URLSearchParams();
    if (next.tab !== "all") p.set("tab", next.tab);
    if (next.category) p.set("category", next.category);
    if (next.q) p.set("q", next.q);
    if (next.sort !== "updated") p.set("sort", next.sort);
    if (next.dir !== "desc") p.set("dir", next.dir);
    if (next.page > 1) p.set("page", String(next.page));
    const s = p.toString();
    start(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };
  const search = (value: string, patch: Partial<ProductFilters> = {}) => {
    setSentQ(value);
    go({ ...patch, q: value });
  };
  useEffect(() => {
    if (q.trim() === sentQ) return;
    const t = setTimeout(() => search(q.trim()), 450);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const atLimit = usage.limit !== null && usage.published >= usage.limit;

  const submit = async (row: ProductListRow) => {
    toast(`Submitting ${row.reference}…`);
    const res = await submitProductAction(row.id);
    if (!res.ok) {
      toast(res.error ?? "Couldn't submit.", { tone: "error" });
      if (res.fieldErrors) router.push(`/insurance-vendor/products/${row.id}?check=1`);
      return;
    }
    toast(`${row.reference} sent to MarchGear for approval`, { tone: "success" });
    router.refresh();
  };
  const duplicate = async (row: ProductListRow) => {
    toast(`Copying ${row.reference}…`);
    const res = await duplicateProductAction(row.id);
    if (!res.ok) return toast(res.error ?? "Couldn't copy the product.", { tone: "error" });
    toast(`Draft copy ${res.reference} created`, { tone: "success" });
    router.push(`/insurance-vendor/products/${res.id}`);
  };
  const runConfirmed = async () => {
    if (!confirm) return;
    setBusy(true);
    const { kind, row } = confirm;
    const res =
      kind === "publish" ? await publishProductAction(row.id) : kind === "unpublish" ? await unpublishProductAction(row.id) : kind === "withdraw" ? await withdrawProductAction(row.id) : await deleteProductAction(row.id);
    setBusy(false);
    setConfirm(null);
    if (!res.ok) return toast(res.error ?? "Couldn't do that. Please try again.", { tone: "error" });
    toast(
      kind === "publish" ? `${row.reference} is live on the website` : kind === "unpublish" ? `${row.reference} is offline` : kind === "withdraw" ? `${row.reference} is back to draft` : `${row.reference} deleted`,
      { tone: "success" },
    );
    router.refresh();
  };

  const menuFor = (row: ProductListRow): MenuItem[] => {
    const items: MenuItem[] = [{ label: canManage && !PRODUCT_LOCKED.includes(row.status) ? "Edit" : "Open", icon: <PencilLine className="size-4" />, href: `/insurance-vendor/products/${row.id}` }];
    if (row.publicHref) items.push({ label: "View on website", icon: <ExternalLink className="size-4" />, href: row.publicHref, external: true });
    if (!canManage) return items;
    items.push("divider");
    if (row.status === "approved") items.push({ label: atLimit ? `Publish (plan limit reached)` : "Publish", icon: <Globe className="size-4" />, disabled: atLimit, onSelect: () => setConfirm({ kind: "publish", row }) });
    if (row.status === "published") items.push({ label: "Unpublish", icon: <EyeOff className="size-4" />, onSelect: () => setConfirm({ kind: "unpublish", row }) });
    if (PRODUCT_SUBMITTABLE.includes(row.status)) items.push({ label: row.everSubmitted ? "Resubmit for approval" : "Submit for approval", icon: <Send className="size-4" />, onSelect: () => submit(row) });
    if (row.status === "pending_approval" || row.status === "submitted") items.push({ label: "Withdraw from review", icon: <Undo2 className="size-4" />, onSelect: () => setConfirm({ kind: "withdraw", row }) });
    items.push({ label: "Duplicate", icon: <Copy className="size-4" />, onSelect: () => duplicate(row) });
    if (row.status === "draft" && !row.everSubmitted) items.push({ label: "Delete draft", icon: <Trash2 className="size-4" />, tone: "danger", onSelect: () => setConfirm({ kind: "delete", row }) });
    return items;
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(filters.q || filters.category);

  return (
    <div>
      <div role="tablist" aria-label="Status" className="no-scrollbar flex gap-6 overflow-x-auto border-b border-line">
        {PRODUCT_TABS.filter((t) => t.value !== "suspended" || tabCounts.suspended > 0).map((t) => {
          const on = filters.tab === t.value;
          return (
            <button
              key={t.value}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => go({ tab: t.value })}
              className={cn("relative shrink-0 whitespace-nowrap pb-3.5 text-[14px] font-medium transition-colors duration-[250ms]", on ? "text-ink" : "text-muted hover:text-ink")}
            >
              {t.label}
              <span className={cn("ml-2 rounded-full px-1.5 py-0.5 text-[11px] num", on ? "bg-ink text-white" : "bg-mist text-muted")}>{tabCounts[t.value]}</span>
              {on && <span aria-hidden className="absolute inset-x-0 -bottom-px h-[2px] bg-red" />}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-2 md:flex-row md:items-center">
        <label className="relative block md:w-80">
          <span className="sr-only">Search products</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search(q.trim())} placeholder="Name, code, UIN or reference" className={cn(control, "h-10 pl-9 text-[13.5px]")} />
        </label>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <select aria-label="Category" value={filters.category} onChange={(e) => go({ category: e.target.value as InsProductCategory | "" })} className={cn(control, "h-10 min-w-0 cursor-pointer text-[13.5px] md:w-52")}>
            <option value="">All categories</option>
            {INS_PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {INS_PRODUCT_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <div className="flex min-w-0 gap-2">
            <select aria-label="Sort by" value={filters.sort} onChange={(e) => go({ sort: e.target.value as ProductSort })} className={cn(control, "h-10 min-w-0 flex-1 cursor-pointer text-[13.5px] md:w-40")}>
              {PRODUCT_SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => go({ dir: filters.dir === "asc" ? "desc" : "asc" })}
              aria-label={filters.dir === "asc" ? "Ascending — switch to descending" : "Descending — switch to ascending"}
              className={cn(control, "inline-flex h-10 w-10 shrink-0 items-center justify-center px-0")}
            >
              {filters.dir === "asc" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 md:ml-auto">
          {pending && <Loader2 aria-label="Loading" className="size-4 animate-spin text-muted" />}
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                search("", { category: "" });
              }}
              className="text-[13px] font-medium text-muted transition-colors hover:text-ink"
            >
              Clear filters
            </button>
          )}
          <p className="text-[13px] text-muted num" aria-live="polite">
            {total} {total === 1 ? "product" : "products"}
          </p>
        </div>
      </div>

      <div className={cn("mt-4 transition-opacity duration-300", pending && "opacity-60")}>
        {rows.length === 0 ? (
          <div className="border border-line bg-white px-6 py-16 text-center">
            <span className="mx-auto mb-4 inline-flex size-11 items-center justify-center rounded-full bg-mist text-ink/60">
              <ShieldCheck className="size-5" />
            </span>
            <p className="text-[15px] font-semibold">{hasFilters || filters.tab !== "all" ? "No products match" : "No products yet"}</p>
            <p className="mx-auto mt-1.5 max-w-md text-[13.5px] text-muted">
              {hasFilters || filters.tab !== "all"
                ? "Try another status, category or search."
                : "Create your first motor insurance product. MarchGear reviews it, and once approved you can publish it to customers comparing cover on the site."}
            </p>
            {canManage && !hasFilters && filters.tab === "all" && (
              <Button href="/insurance-vendor/products/create" className="mt-6" arrow>
                Create a product
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden border border-line bg-white md:block">
              <table className="w-full table-fixed border-collapse text-left text-[13.5px]">
                <thead>
                  <tr>
                    <th className="border-b border-line bg-[#fafafa] px-4 py-3 text-[12px] font-semibold text-muted">Product</th>
                    <th className="w-44 border-b border-line bg-[#fafafa] px-4 py-3 text-[12px] font-semibold text-muted max-lg:hidden">Category</th>
                    <th className="w-44 border-b border-line bg-[#fafafa] px-4 py-3 text-[12px] font-semibold text-muted">Status</th>
                    <th className="w-28 border-b border-line bg-[#fafafa] px-4 py-3 text-[12px] font-semibold text-muted">Views / Enq.</th>
                    <th className="w-44 border-b border-line bg-[#fafafa] px-4 py-3 text-[12px] font-semibold text-muted max-xl:hidden">Updated</th>
                    <th className="w-14 border-b border-line bg-[#fafafa] px-2 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="align-top transition-colors duration-200 hover:bg-[#fcfcfc]">
                      <td className="border-b border-line px-4 py-4">
                        <p className="flex items-center gap-2 text-[11.5px] text-muted">
                          <span className="num">{row.reference}</span>
                          <span aria-hidden>·</span>
                          <span className="truncate font-mono text-[11px]">{row.code}</span>
                        </p>
                        <Link href={`/insurance-vendor/products/${row.id}`} className="mt-1 block truncate font-semibold transition-colors hover:text-red">
                          {row.name}
                        </Link>
                        <p className="truncate text-[12.5px] text-muted">Underwritten by {row.companyName}</p>
                        <Remarks row={row} />
                        {row.publicHref && (
                          <a href={row.publicHref} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-red underline-offset-4 hover:underline">
                            <Eye aria-hidden className="size-3.5" /> View on website
                          </a>
                        )}
                      </td>
                      <td className="border-b border-line px-4 py-4 text-[13px] max-lg:hidden">{INS_PRODUCT_CATEGORY_LABEL[row.category]}</td>
                      <td className="border-b border-line px-4 py-4">
                        <ProductStatusBadge status={row.status} />
                      </td>
                      <td className="border-b border-line px-4 py-4 text-[13px] num">
                        {row.views.toLocaleString("en-IN")} <span className="text-muted">/</span> {row.enquiries.toLocaleString("en-IN")}
                      </td>
                      <td className="border-b border-line px-4 py-4 text-[12.5px] text-muted max-xl:hidden">{formatDateTime(row.updatedAt)}</td>
                      <td className="border-b border-line px-2 py-3 text-right">
                        <RowMenu label={row.reference} items={menuFor(row)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden">
              {rows.map((row) => (
                <li key={row.id} className="border border-line bg-white p-4">
                  <div className="flex gap-3">
                    <Link href={`/insurance-vendor/products/${row.id}`} className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] text-muted num">
                        {row.reference} · {row.code}
                      </span>
                      <span className="mt-1 block truncate text-[14px] font-semibold">{row.name}</span>
                      <span className="block truncate text-[12.5px] text-muted">{INS_PRODUCT_CATEGORY_LABEL[row.category]}</span>
                    </Link>
                    <div className="-mr-2 -mt-1 shrink-0">
                      <RowMenu label={row.reference} items={menuFor(row)} />
                    </div>
                  </div>
                  <Remarks row={row} />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3">
                    <ProductStatusBadge status={row.status} />
                    <span className="text-[12.5px] text-muted num">
                      {row.views} views · {row.enquiries} enq.
                    </span>
                  </div>
                  {row.publicHref && (
                    <a href={row.publicHref} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-red">
                      <Eye aria-hidden className="size-3.5" /> View on website
                    </a>
                  )}
                </li>
              ))}
            </ul>

            {pages > 1 && (
              <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-4 text-[13px] text-muted">
                <p className="num">
                  {(filters.page - 1) * pageSize + 1}–{Math.min(total, filters.page * pageSize)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={filters.page <= 1} onClick={() => go({ page: filters.page - 1 })}>
                    Previous
                  </Button>
                  <Button size="sm" variant="outline" disabled={filters.page >= pages} onClick={() => go({ page: filters.page + 1 })}>
                    Next
                  </Button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        busy={busy}
        onConfirm={runConfirmed}
        tone={confirm?.kind === "delete" || confirm?.kind === "unpublish" ? "primary" : "dark"}
        title={
          confirm?.kind === "publish"
            ? `Publish ${confirm.row.reference}?`
            : confirm?.kind === "unpublish"
              ? `Take ${confirm.row.reference} off the website?`
              : confirm?.kind === "withdraw"
                ? `Withdraw ${confirm.row.reference} from review?`
                : `Delete ${confirm?.row.reference ?? ""}?`
        }
        confirm={confirm?.kind === "publish" ? "Publish" : confirm?.kind === "unpublish" ? "Unpublish" : confirm?.kind === "withdraw" ? "Withdraw to draft" : "Delete draft"}
        body={
          confirm?.kind === "publish" ? (
            <>
              It goes live on the MarchGear insurance pages straight away.{" "}
              {usage.limit !== null && (
                <span>
                  This uses {usage.published + 1} of the {usage.limit} published products on your {usage.planName} plan.
                </span>
              )}
            </>
          ) : confirm?.kind === "unpublish" ? (
            "Customers can no longer find it or request quotes for it. It stays approved, so you can publish it again at any time."
          ) : confirm?.kind === "withdraw" ? (
            "It leaves MarchGear's queue and goes back to draft so you can keep editing. Submit it again when you're ready."
          ) : (
            "This draft was never submitted, so it's removed for good."
          )
        }
      />
    </div>
  );
}

function Remarks({ row }: { row: ProductListRow }) {
  if (!PRODUCT_ATTENTION.includes(row.status)) return null;
  const rejected = row.status === "rejected";
  return (
    <Link href={`/insurance-vendor/products/${row.id}`} className={cn("mt-2 flex w-full max-w-md items-start gap-1.5 rounded-[3px] px-2 py-1.5 text-left text-[12.5px]", rejected ? "bg-red-50 text-red" : "bg-[#fdf3e1] text-[#9a5b00]")}>
      <MessageSquareWarning aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span className="line-clamp-2 min-w-0">
        <span className="font-semibold">MarchGear: </span>
        {row.adminRemarks || "Open the product to see what to change."}
      </span>
    </Link>
  );
}
