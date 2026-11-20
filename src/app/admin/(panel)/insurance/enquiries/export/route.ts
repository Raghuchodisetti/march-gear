import type { NextRequest } from "next/server";
import { INS_INTENT_LABEL, INS_LEAD_STATUS_LABEL, INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { csvResponse } from "@/server/admin/csv";
import { dayRange, exportInsEnquiries, vendorLabel } from "@/server/admin/insurance-ops";
import { CONVERSION_LABEL, sourceLabel } from "@/components/admin/insurance/ops/labels";

const IST_OFFSET_MS = 330 * 60_000;
const ist = (d: Date | null) => (d ? new Date(d.getTime() + IST_OFFSET_MS).toISOString().replace("T", " ").slice(0, 19) : "");

/** Insurance enquiries as CSV — the same filters as the list. Cells are formula-safe (csvCell). */
export async function GET(req: NextRequest) {
  await requireStaff();
  const p = req.nextUrl.searchParams;
  const get = (k: string) => p.get(k)?.trim() || undefined;
  const range = dayRange(get("from"), get("to"));
  const rows = await exportInsEnquiries({
    q: get("q")?.slice(0, 80),
    vendor: get("vendor"),
    status: get("status"),
    intent: get("intent"),
    product: get("product"),
    company: get("company"),
    city: get("city"),
    source: get("source"),
    conversion: get("conversion"),
    ...range,
  });
  // The mobile is the bare 10-digit number: a "+91 …" cell would be read as a formula by spreadsheets.
  const header = [
    "Reference",
    "Received (IST)",
    "Intent",
    "Status",
    "Customer",
    "Mobile (+91)",
    "Email",
    "Registration",
    "Vehicle",
    "Year",
    "Fuel",
    "City",
    "State",
    "Vendor",
    "Vendor reference",
    "Product",
    "Category",
    "Insurer",
    "Source",
    "Indicative premium (₹)",
    "Quotes sent",
    "Conversion",
    "Policy number",
    "Policy premium (₹)",
    "Policy issued (IST)",
    "Verified (IST)",
  ];
  const lines = rows.map((e) => [
    e.reference,
    ist(e.createdAt),
    INS_INTENT_LABEL[e.intent],
    INS_LEAD_STATUS_LABEL[e.status],
    e.name,
    e.mobile,
    e.email,
    e.regNumber,
    [e.brandName, e.modelName, e.variantName].filter(Boolean).join(" "),
    e.year,
    e.fuel,
    e.city,
    e.state,
    vendorLabel(e),
    e.vendorRef,
    e.productName,
    e.productCategory ? INS_PRODUCT_CATEGORY_LABEL[e.productCategory] : "",
    e.companyName,
    sourceLabel(e.source),
    e.indicativePremium,
    e.quotes,
    CONVERSION_LABEL[e.conversionVerifiedAt ? "verified" : e.status === "policy_issued" ? "reported" : "none"],
    e.policyNumber,
    e.policyPremium,
    ist(e.policyIssuedAt),
    ist(e.conversionVerifiedAt),
  ]);
  const suffix = range.from || range.to ? `${range.from ?? "start"}-to-${range.to ?? "today"}` : new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
  return csvResponse(`marchgear-insurance-enquiries-${suffix}.csv`, header, lines);
}
