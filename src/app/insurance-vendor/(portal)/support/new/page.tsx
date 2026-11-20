import type { Metadata } from "next";
import { Clock3, Mail, Paperclip, Phone } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { requireInsurer } from "@/server/insurance/context";
import { PortalHeader, strParam } from "@/components/portal/ui";
import { NewInsTicketForm } from "@/components/insurance/vendor/support/compose";

export const metadata: Metadata = { title: "New support ticket" };

export default async function Page({ searchParams }: PageProps<"/insurance-vendor/support/new">) {
  await requireInsurer({ perm: "support.use", approved: false });
  const sp = await searchParams;
  const { insuranceSettings } = (await getCatalog()).content;
  const email = insuranceSettings.vendorSupportEmail;
  const phone = insuranceSettings.vendorSupportPhone;

  return (
    <>
      <PortalHeader back={{ href: "/insurance-vendor/support", label: "Support" }} title="New support ticket" description="Tell us what you need — MarchGear's vendor team replies on the ticket and in your notifications." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <NewInsTicketForm defaultCategory={strParam(sp.category)} />
        <aside className="min-w-0 space-y-4 text-[13px] leading-relaxed text-muted">
          <div className="border border-line bg-white p-5">
            <p className="text-[13.5px] font-semibold text-ink">Getting a fast answer</p>
            <ul className="mt-3 space-y-3">
              <li className="flex gap-2.5">
                <Clock3 className="mt-0.5 size-4 shrink-0 text-red" aria-hidden />
                Include reference numbers — product (PRD-…), enquiry (ENQ-…), campaign (CMP-…) or invoice (MGI/…).
              </li>
              <li className="flex gap-2.5">
                <Paperclip className="mt-0.5 size-4 shrink-0 text-red" aria-hidden />
                Attach screenshots or documents (PDF, JPEG, PNG or WebP, up to 900 KB each). Only your team and MarchGear can open them.
              </li>
            </ul>
          </div>
          {(email || phone) && (
            <div className="border border-line bg-white p-5">
              <p className="text-[13.5px] font-semibold text-ink">Vendor support</p>
              <div className="mt-3 space-y-2">
                {phone && (
                  <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 font-medium text-ink hover:text-red">
                    <Phone className="size-4 text-red" aria-hidden /> {phone}
                  </a>
                )}
                {email && (
                  <a href={`mailto:${email}`} className="flex min-w-0 items-center gap-2 break-all font-medium text-ink hover:text-red">
                    <Mail className="size-4 shrink-0 text-red" aria-hidden /> {email}
                  </a>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
