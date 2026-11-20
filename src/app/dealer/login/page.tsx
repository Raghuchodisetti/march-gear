import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPartnerContext } from "@/server/partner/context";
import { DealerLoginForm } from "@/components/portal/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function DealerLoginPage() {
  if (await getPartnerContext()) redirect("/dealer");
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-[#F6F6F6] lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-white lg:flex">
        <p className="font-display text-[22px] tracking-[-0.02em]">
          <span className="font-semibold">March</span>Gear <span className="text-white/50">Partner</span>
        </p>
        <div className="max-w-lg">
          <p className="type-eyebrow text-red">Dealer partner portal</p>
          <p className="mt-4 font-display text-[44px] font-semibold leading-[1.04] tracking-[-0.03em]">Your showroom, your offers, your customers — in one place.</p>
          <ul className="mt-8 space-y-2.5 text-[14.5px] text-white/70">
            <li>· List new and used inventory on MarchGear</li>
            <li>· Run festival and finance offers with approval built in</li>
            <li>· Track every enquiry and test drive to a sale</li>
          </ul>
        </div>
        <p className="text-[12.5px] text-white/40">For authorised and multi-brand dealers in India.</p>
      </div>
      <div className="flex items-center justify-center px-4 py-14">
        <div className="w-full max-w-sm">
          <p className="font-display text-[22px] tracking-[-0.02em] lg:hidden">
            <span className="font-semibold">March</span>Gear <span className="text-muted">Partner</span>
          </p>
          <h1 className="mt-6 font-display text-[30px] font-semibold tracking-[-0.02em] lg:mt-0">Sign in</h1>
          <p className="mt-1.5 text-[14px] text-muted">Use the email and password for your dealer account.</p>
          <Suspense>
            <DealerLoginForm />
          </Suspense>
          <p className="mt-8 border-t border-line pt-6 text-[14px] text-muted">
            New to MarchGear?{" "}
            <Link href="/dealer/register" className="font-medium text-ink underline-offset-4 hover:text-red hover:underline">
              Become a dealer partner
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
