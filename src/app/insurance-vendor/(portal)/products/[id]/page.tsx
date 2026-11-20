import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { insCompanies, insCovers } from "@/db/schema";
import { INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { requireInsurer } from "@/server/insurance/context";
import { productUsage } from "@/server/insurance/catalog-limits";
import { PortalHeader, strParam } from "@/components/portal/ui";
import { Metric } from "@/components/portal/dashboard/sections";
import { ProductForm } from "@/components/insurance/vendor/products/product-form";
import { KeepTabs, ProductBanner } from "@/components/insurance/vendor/products/product-detail";
import { companyOptions, coverOptions, getProductRow, productHistory, productStats } from "@/components/insurance/vendor/products/queries";
import { productToForm, publicProductHref } from "@/components/insurance/vendor/products/shared";
import { HistoryTimeline } from "@/components/insurance/vendor/approvals/timeline";
import { historyLabel } from "@/components/insurance/vendor/approvals/shared";

export const metadata: Metadata = { title: "Insurance product" };

export default async function ProductPage(props: PageProps<"/insurance-vendor/products/[id]">) {
  const { id: raw } = await props.params;
  const ctx = await requireInsurer({ perm: "products.view", next: `/insurance-vendor/products/${encodeURIComponent(raw)}` });
  const sp = await props.searchParams;
  const id = /^\d{1,10}$/.test(raw) ? Number(raw) : 0;
  const p = id ? await getProductRow(ctx.vendor.id, id) : null;
  if (!p) notFound();

  const usedIds = [...new Set([...(p.coverage.coverIds ?? []), ...(p.addOns ?? []).map((a) => a.coverId)])];
  const db = getDb();
  const [stats, history, covers, companies, usage, company, usedCovers] = await Promise.all([
    productStats(ctx.vendor.id, p.id),
    productHistory(ctx.vendor.id, p.id),
    coverOptions(ctx.vendor.id),
    companyOptions(ctx.vendor, p.companyId),
    productUsage(ctx.vendor.id, ctx.vendor.plan),
    db.select({ name: insCompanies.name, isActive: insCompanies.isActive }).from(insCompanies).where(inArray(insCompanies.id, [p.companyId])).limit(1),
    usedIds.length ? db.select({ id: insCovers.id, status: insCovers.status }).from(insCovers).where(inArray(insCovers.id, usedIds)) : Promise.resolve([]),
  ]);
  const canManage = ctx.can("products.manage");
  const decision = history.find((h) => h.actorSide === "admin");
  const publicHref = p.status === "published" && ctx.approved ? publicProductHref(p.reference) : null;

  return (
    <>
      <PortalHeader
        title={p.name || "Untitled product"}
        description={[p.reference, p.code, INS_PRODUCT_CATEGORY_LABEL[p.category], company[0] ? `Underwritten by ${company[0].name}` : null].filter(Boolean).join(" · ")}
        back={{ href: "/insurance-vendor/products", label: "Insurance products" }}
      />

      <ProductBanner
        id={p.id}
        reference={p.reference}
        status={p.status}
        adminRemarks={p.adminRemarks}
        requiredCorrections={p.requiredCorrections ?? []}
        submittedAt={p.submittedAt?.toISOString() ?? null}
        approvedAt={p.approvedAt?.toISOString() ?? null}
        publishedAt={p.publishedAt?.toISOString() ?? null}
        publicHref={publicHref}
        canManage={canManage}
        lastDecision={decision ? { label: historyLabel(decision.action), at: decision.createdAt } : null}
        usage={{ published: usage.published, limit: usage.limit, planName: usage.plan.name }}
        companyActive={Boolean(company[0]?.isActive)}
        unapprovedCovers={usedCovers.filter((c) => c.status !== "approved").length}
      />

      <section aria-label="Performance" className="mb-8 flex flex-wrap gap-px overflow-hidden border border-line bg-line">
        <Metric label="Product views" value={stats.views.toLocaleString("en-IN")} note={`${stats.views30.toLocaleString("en-IN")} in the last 30 days`} />
        <Metric
          label="Customer enquiries"
          value={stats.enquiries.toLocaleString("en-IN")}
          note={`${stats.enquiries30.toLocaleString("en-IN")} in the last 30 days`}
          href={ctx.can("enquiries.view_all") || ctx.can("enquiries.view_own") ? "/insurance-vendor/enquiries" : undefined}
        />
        <Metric label="Quotes sent" value={stats.quotes.toLocaleString("en-IN")} note={stats.enquiries ? `${Math.round((stats.quotes / stats.enquiries) * 100)}% of enquiries` : "Shown once enquiries arrive"} />
        <Metric label="Policies issued" value={stats.policies.toLocaleString("en-IN")} note="As reported by your team" />
      </section>

      <KeepTabs
        initial={strParam(sp.tab) ?? "details"}
        items={[
          { value: "details", label: canManage && !["pending_approval", "submitted", "suspended"].includes(p.status) ? "Edit product" : "Product details" },
          { value: "history", label: "Approval history", count: history.length },
        ]}
        panels={{
          details: (
            <ProductForm
              product={{ id: p.id, reference: p.reference, status: p.status, submittedAt: p.submittedAt?.toISOString() ?? null }}
              initial={productToForm(p)}
              covers={covers}
              companies={companies}
              vendorCategory={ctx.vendor.category}
              canManage={canManage}
              check={strParam(sp.check) === "1"}
            />
          ),
          history: (
            <div className="max-w-3xl border border-line bg-white p-5 md:p-6">
              <HistoryTimeline entries={history} empty="Not submitted yet. When you submit it, every step and MarchGear's remarks appear here." />
            </div>
          ),
        }}
      />
    </>
  );
}
