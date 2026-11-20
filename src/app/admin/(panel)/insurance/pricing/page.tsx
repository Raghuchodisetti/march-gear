import type { Metadata } from "next";
import { RotateCcw } from "lucide-react";
import { BLOCKS } from "@/content/registry";
import { pricingConfigFrom } from "@/insurance/estimator";
import type { FormValues } from "@/components/admin/fields";
import { resetContentAction, saveContentAction } from "@/server/actions/content";
import { estimateCars } from "@/server/admin/insurance";
import { contentForm } from "@/server/admin/content";
import { requireStaff } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { todayISO } from "@/server/validation";
import { AdminHeader, formatDateTime } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/delete-button";
import { ResourceForm } from "@/components/admin/resource-form";
import { PricingCalculator } from "@/components/admin/insurance/config/pricing-calculator";

export const metadata: Metadata = { title: "Insurance pricing configuration" };

const KEY = "insurancePricing" as const;

export default async function InsurancePricingPage() {
  await requireStaff();
  const block = BLOCKS[KEY];
  const [{ values, meta, invalidSaved }, catalog, cars] = await Promise.all([contentForm(KEY), getCatalog(), estimateCars()]);
  // The block stores "each further year" as plain numbers but edits them as rows of { pct }.
  const older = (values.olderDepreciationPct as unknown[] | undefined) ?? [];
  const initial: FormValues = { ...values, olderDepreciationPct: older.map((x) => (typeof x === "number" ? { pct: x } : x)) };
  const savedAt = meta ? `saved ${formatDateTime(meta.updatedAt)}${meta.updatedBy ? ` by ${meta.updatedBy}` : ""}` : null;

  return (
    <>
      <AdminHeader
        title="Pricing configuration"
        description={
          <>
            {block.description}
            <span className="mt-1 block text-[12.5px]">
              Used on: {block.usedOn.join(" · ")}
              {meta ? ` · last updated ${formatDateTime(meta.updatedAt)}${meta.updatedBy ? ` by ${meta.updatedBy}` : ""}` : " · showing the launch defaults"}
            </span>
          </>
        }
        actions={
          meta && (
            <DeleteButton
              action={resetContentAction.bind(null, KEY)}
              label="Reset to default"
              doneText="Reset to the launch rates"
              icon={<RotateCcw aria-hidden className="size-4" />}
              confirmText={`Reset “${block.title}” to the launch rates? Your saved changes will be lost.`}
              redirectTo="/admin/insurance/pricing"
            />
          )
        }
      />
      {invalidSaved && (
        <p role="alert" className="mb-6 border-l-2 border-red bg-red-50 px-4 py-3 text-[13.5px] text-red">
          The saved version no longer matches this form, so the site is using the launch rates. Saving will replace it.
        </p>
      )}
      <ResourceForm
        key={meta ? meta.updatedAt.toISOString() : "defaults"}
        sections={block.sections}
        initial={initial}
        action={saveContentAction.bind(null, KEY)}
        listHref="/admin/insurance/dashboard"
        submitLabel="Save & publish"
        aside={<PricingCalculator cars={cars} config={{ ...pricingConfigFrom(catalog.content.insurancePricing), disclaimer: catalog.content.insurancePricing.disclaimer }} today={todayISO()} savedAt={savedAt} />}
      />
    </>
  );
}
