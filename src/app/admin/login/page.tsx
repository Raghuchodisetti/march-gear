import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, isStaff } from "@/server/auth";
import { AdminLoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function AdminLoginPage() {
  const user = await getSessionUser("staff");
  if (user && isStaff(user.role)) redirect("/admin");

  return (
    <main className="grid min-h-dvh grid-cols-1 bg-mist lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <p className="font-display text-[22px] tracking-[-0.02em]">
          <span className="font-semibold">March</span>Gear
        </p>
        <div>
          <p className="type-eyebrow text-red-400">Admin panel</p>
          <p className="mt-4 max-w-md font-display text-[40px] font-semibold leading-[1.05] tracking-[-0.03em]">Leads, listings and stories — all in one place.</p>
        </div>
        <p className="text-[12.5px] text-white/45">Authorised staff only. Every sign-in is recorded.</p>
      </div>
      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <p className="font-display text-[22px] tracking-[-0.02em] lg:hidden">
            <span className="font-semibold">March</span>Gear <span className="text-muted">Admin</span>
          </p>
          <h1 className="mt-6 font-display text-[30px] font-semibold tracking-[-0.02em] lg:mt-0">Sign in</h1>
          <p className="mt-1.5 text-[14px] text-muted">Use your staff email and password.</p>
          {user && <p className="mt-4 border border-line bg-white p-3 text-[13px] text-muted">You&apos;re signed in as {user.email}, which isn&apos;t a staff account.</p>}
          <AdminLoginForm />
        </div>
      </div>
    </main>
  );
}
