import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePartner } from "@/server/partner/context";
import { getEditorOptions, getOffer, offerToInput, standardTerms } from "@/server/partner/offers";
import { offerDisplayStatus } from "@/partner/labels";
import { strParam } from "@/components/portal/ui";
import { LockedOffer, OfferEditor } from "@/components/portal/offers/offer-editor";
import { OFFER_DRAFT_STATUSES, OFFER_LIVE_STATUSES, OFFER_STEPS, type OfferStepKey } from "@/components/portal/offers/offer-input";

export const metadata: Metadata = { title: "Edit offer" };

export default async function EditOfferPage(props: PageProps<"/dealer/offers/[id]/edit">) {
  const ctx = await requirePartner({ perm: "offers.view" });
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  if (!/^\d{1,9}$/.test(id)) notFound();
  const row = await getOffer(ctx.partner.id, Number(id));
  if (!row) notFound();

  const now = new Date();
  const offer = { id: row.id, reference: row.reference, status: row.status, display: offerDisplayStatus(row, now), adminRemarks: row.adminRemarks };
  const [input, options] = [offerToInput(row), await getEditorOptions(ctx.partner.id)];
  const canManage = ctx.can("offers.manage");
  const editable = canManage && (OFFER_DRAFT_STATUSES.includes(row.status) || OFFER_LIVE_STATUSES.includes(row.status));

  if (!editable) return <LockedOffer offer={{ ...offer, title: row.title }} input={input} options={options} renderedAt={now.getTime()} canManage={canManage} />;

  const step = strParam(sp.step);
  const initialStep = OFFER_STEPS.some((s) => s.key === step) ? (step as OfferStepKey) : undefined;
  return <OfferEditor key={row.id} offer={offer} initial={input} template={null} options={options} initialStep={initialStep} standardTerms={standardTerms()} renderedAt={now.getTime()} />;
}
