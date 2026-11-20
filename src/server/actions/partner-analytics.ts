"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { RANGE_PRESETS, resolveRange, type AnalyticsReport } from "@/components/portal/analytics/report";
import { getAnalyticsReport } from "@/server/partner/analytics";
import { isActionError, partnerAction } from "@/server/partner/context";
import { logPartnerActivity } from "@/server/partner/records";
import { HOUR, take } from "@/server/rate-limit";
import { invalid } from "@/server/validation";

const schema = z.object({
  range: z.enum(RANGE_PRESETS),
  from: z.string().max(10).optional(),
  to: z.string().max(10).optional(),
  format: z.enum(["csv", "excel", "pdf"]),
});

const FORMAT_LABEL = { csv: "CSV", excel: "Excel (CSV)", pdf: "PDF" } as const;

/** Fresh report data for an export of the current view — the browser builds the file. */
export async function analyticsExportAction(input: unknown): Promise<ActionResult<{ report: AnalyticsReport }>> {
  const ctx = await partnerAction("analytics.view");
  if (isActionError(ctx)) return ctx;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!take(`analytics-export:${ctx.user.id}`, 60, HOUR)) return { ok: false, error: "Too many exports in a short time. Please wait a few minutes." };

  const range = resolveRange(parsed.data);
  if (range.error) return { ok: false, error: range.error };
  const p = ctx.partner;
  const name = p.tradeName || p.legalName || p.application.business.tradeName || p.application.business.legalName || "Your dealership";
  const report = await getAnalyticsReport(p, range, name);
  await logPartnerActivity(p.id, ctx.user.id, "export", "analytics", null, `Exported analytics (${FORMAT_LABEL[parsed.data.format]}) for ${range.label}`);
  return { ok: true, report };
}
