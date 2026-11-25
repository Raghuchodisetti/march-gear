import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { getInsurerContext } from "@/server/insurance/context";
import { InsLoginForm } from "@/components/insurance/vendor/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function InsuranceVendorLoginPage() {
  if (await getInsurerContext()) redirect("/insurance-vendor");
  const { content } = await getCatalog();
  const supportEmail = content.insuranceSettings.vendorSupportEmail || content.site.supportEmail;

  return (
    <main className="grid min-h-dvh grid-cols-1 bg-[#F6F6F6] lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-white lg:flex">
        <Link href="/insurance-vendor" className="font-display text-[22px] tracking-[-0.02em]">
          <span className="font-semibold">March</span>Gear <span className="text-white/50">Insurance</span>
        </Link>
        <div className="max-w-lg">
          <p className="type-eyebrow text-red-400">Insurance vendor portal</p>
          <p className="mt-4 font-display text-[44px] font-semibold leading-[1.04] tracking-[-0.03em]">Your motor products, quote requests and renewals — in one place.</p>
          <ul className="mt-8 space-y-3 text-[14.5px] text-white/70">
            {["List products, coverage and add-ons — each reviewed before it goes live", "Answer quote requests with indicative or insurer-authorised quotations", "Track renewals, campaigns and performance for your whole team"].map((t) => (
              <li key={t} className="flex gap-3">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12.5px] text-white/50">For registered insurers and insurance intermediaries in India.</p>
      </div>
      <div className="flex items-center justify-center px-4 py-14">
        <div className="w-full max-w-sm">
          <Link href="/insurance-vendor" className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink">
            <ArrowLeft aria-hidden className="size-4" /> MarchGear for insurers
          </Link>
          <p className="mt-6 font-display text-[22px] tracking-[-0.02em] lg:hidden">
            <span className="font-semibold">March</span>Gear <span className="text-muted">Insurance</span>
          </p>
          <h1 className="mt-6 font-display text-[30px] font-semibold tracking-[-0.02em]">Sign in</h1>
          <p className="mt-1.5 text-[14px] text-muted">Use the email and password for your insurance vendor account.</p>
          <Suspense>
            <InsLoginForm supportEmail={supportEmail} />
          </Suspense>
          <p className="mt-8 border-t border-line pt-6 text-[14px] text-muted">
            New to MarchGear?{" "}
            <Link href="/insurance-vendor/register" className="font-medium text-ink underline-offset-4 hover:text-red hover:underline">
              Apply as an insurance vendor
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
