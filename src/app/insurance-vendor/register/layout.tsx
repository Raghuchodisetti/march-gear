import type { Metadata } from "next";
import { getCatalog } from "@/server/catalog";
import { getInsurerContext } from "@/server/insurance/context";
import { InsRegisterFrame } from "@/components/insurance/vendor/register/frame";

export const metadata: Metadata = { title: { default: "Apply as an insurance vendor", template: "%s · MarchGear Insurance" } };

/** Registration has its own quiet chrome — no portal sidebar. Each page checks access itself. */
export default async function InsuranceRegisterLayout({ children }: LayoutProps<"/insurance-vendor/register">) {
  const [ctx, { content }] = await Promise.all([getInsurerContext(), getCatalog()]);
  const support = {
    email: content.insuranceSettings.vendorSupportEmail || content.site.supportEmail,
    phone: content.insuranceSettings.vendorSupportPhone || content.site.phone,
  };
  return (
    <InsRegisterFrame signedIn={Boolean(ctx)} support={support}>
      {children}
    </InsRegisterFrame>
  );
}
