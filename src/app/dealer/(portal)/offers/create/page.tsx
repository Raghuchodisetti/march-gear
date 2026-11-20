import type { Metadata } from "next";
import { requirePartner } from "@/server/partner/context";
import { getEditorOptions, listOffers, newOfferInput, offerTemplates, standardTerms } from "@/server/partner/offers";
import { strParam } from "@/components/portal/ui";
import { OfferEditor } from "@/components/portal/offers/offer-editor";
import { OfferStart } from "@/components/portal/offers/offer-start";

export const metadata: Metadata = { title: "Create offer" };

export default async function CreateOfferPage(props: PageProps<"/dealer/offers/create">) {
  const ctx = await requirePartner({ perm: "offers.manage" });
  const sp = await props.searchParams;
  const templateKey = strParam(sp.template);
  const now = new Date();

  if (!templateKey && strParam(sp.start) !== "blank") {
    const previous = await listOffers(ctx, now);
    return <OfferStart templates={offerTemplates(now)} previous={previous} />;
  }

  const [{ input, template }, options] = [newOfferInput(templateKey, now), await getEditorOptions(ctx.partner.id)];
  // Keyed so switching templates (or blank) starts a fresh form.
  return <OfferEditor key={templateKey ?? "blank"} offer={null} initial={input} template={template} options={options} standardTerms={standardTerms()} renderedAt={now.getTime()} />;
}
