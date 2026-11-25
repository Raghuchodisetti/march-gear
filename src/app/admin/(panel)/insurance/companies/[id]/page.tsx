import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { notFound } from "next/navigation";
import { deleteInsCompanyAction } from "@/server/actions/admin-insurance-config";
import { getInsCompany, insurerVendorOptions } from "@/server/admin/insurance";
import { requireStaff } from "@/server/auth";
import { INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { AdminHeader, Panel, formatDateTime } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/delete-button";
import { ProductPill, StatusPill } from "@/components/admin/insurance/ui";
import { CompanyForm, type CompanyFormValues } from "@/components/admin/insurance/companies/company-form";

export async function generateMetadata({ params }: PageProps<"/admin/insurance/companies/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: /^\d+$/.test(id) ? `Insurance company ${id}` : "Insurance company" };
}

export default async function InsuranceCompanyPage({ params }: PageProps<"/admin/insurance/companies/[id]">) {
  const me = await requireStaff();
  const { id } = await params;
  const [detail, vendors] = await Promise.all([/^\d+$/.test(id) ? getInsCompany(Number(id)) : Promise.resolve(null), insurerVendorOptions()]);
  if (!detail) notFound();
  const c = detail.company;
  const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  const initial: CompanyFormValues = {
    name: c.name,
    slug: c.slug,
    shortName: s(c.shortName),
    logo: s(c.logo),
    about: s(c.about),
    website: s(c.website),
    regulatorRegNo: s(c.regulatorRegNo),
    headquarters: s(c.headquarters),
    establishedYear: s(c.establishedYear),
    garageCount: s(c.garageCount),
    garageNote: s(c.garageNote),
    supportPhone: s(c.supportPhone),
    claimsPhone: s(c.claimsPhone),
    claimsEmail: s(c.claimsEmail),
    isActive: c.isActive,
    vendorId: s(c.vendorId),
    claim: {
      settlementRatio: s(c.claimInfo?.settlementRatio),
      year: s(c.claimInfo?.year),
      source: s(c.claimInfo?.source),
      process: (c.claimInfo?.process ?? []).join("\n"),
      verified: Boolean(c.claimInfo?.verified),
    },
  };
  const published = detail.products.filter((p) => p.status === "published").length;
  const unused = detail.products.length === 0;
  const productsPanel = (
    <Panel title="Products underwritten" padded={false}>
      {detail.products.length === 0 ? (
        <p className="p-5 text-[13.5px] text-muted">No products use this company yet.{me.role === "admin" ? " It can be deleted." : " Admins can delete unused companies."}</p>
      ) : (
        <ul className="divide-y divide-line">
          {detail.products.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/insurance/products/${p.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-mist/50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{p.name}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {p.reference} · {INS_PRODUCT_CATEGORY_LABEL[p.category]} · {p.vendorName}
                  </span>
                </span>
                <ProductPill status={p.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!unused && <p className="border-t border-line px-5 py-3 text-[12px] text-muted">Companies in use can&apos;t be deleted — deactivate them instead.</p>}
    </Panel>
  );

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/insurance/companies", label: "Insurance companies" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 break-words">{c.name}</span>
            <span className="tracking-normal">{c.isActive ? <StatusPill tone="green">Active</StatusPill> : <StatusPill tone="neutral">Inactive</StatusPill>}</span>
          </span>
        }
        description={`${detail.products.length} product${detail.products.length === 1 ? "" : "s"} · ${published} live · updated ${formatDateTime(c.updatedAt)}`}
        actions={
          me.role === "admin" && unused ? (
            <DeleteButton action={deleteInsCompanyAction.bind(null, c.id)} confirmText={`Delete ${c.name}? This can't be undone.`} redirectTo="/admin/insurance/companies" doneText="Company deleted" />
          ) : undefined
        }
      />
      <CompanyForm
        key={c.updatedAt.toISOString()}
        companyId={c.id}
        initial={initial}
        vendors={vendors}
        products={{ total: detail.products.length, published }}
        claimInfo={c.claimInfo}
        verifiedByName={detail.verifiedByName}
        extra={productsPanel}
      />
    </>
  );
}
