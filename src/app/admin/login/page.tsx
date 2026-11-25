import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDesk, getSessionUser } from "@/server/auth";
import { AdminLoginForm } from "@/components/admin/login-form";
import { DeskProvider } from "@/components/admin/desk";

export const metadata: Metadata = { title: "Sign in" };

/* One page for both desks: /admin/login (admins) and /staff/login (staff; served from here by src/proxy.ts). */
export default async function AdminLoginPage() {
  const desk = await getDesk();
  if (await getSessionUser(desk)) redirect(desk === "staff" ? "/staff" : "/admin");
  const staff = desk === "staff";

  return (
    <main className="grid min-h-dvh grid-cols-1 bg-mist lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <p className="font-display text-[22px] tracking-[-0.02em]">
          <span className="font-semibold">March</span>Gear
        </p>
        <div>
          <p className="type-eyebrow text-red-400">{staff ? "Staff desk" : "Admin panel"}</p>
          <p className="mt-4 max-w-md font-display text-[40px] font-semibold leading-[1.05] tracking-[-0.03em]">
            {staff ? "The parts of MarchGear you look after." : "Leads, listings and stories — all in one place."}
          </p>
        </div>
        <p className="text-[12.5px] text-white/45">{staff ? "MarchGear staff only. Every sign-in is recorded." : "Administrators only. Every sign-in is recorded."}</p>
      </div>
      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <p className="font-display text-[22px] tracking-[-0.02em] lg:hidden">
            <span className="font-semibold">March</span>Gear <span className="text-muted">{staff ? "Staff" : "Admin"}</span>
          </p>
          <h1 className="mt-6 font-display text-[30px] font-semibold tracking-[-0.02em] lg:mt-0">{staff ? "Staff sign-in" : "Admin sign-in"}</h1>
          <p className="mt-1.5 text-[14px] text-muted">{staff ? "Use the staff email and password your admin gave you." : "Use your admin email and password."}</p>
          <DeskProvider desk={desk}>
            <AdminLoginForm />
          </DeskProvider>
          <p className="mt-8 border-t border-line pt-5 text-[13px] text-muted">
            {staff ? "Administrator? " : "MarchGear staff? "}
            <Link href={staff ? "/admin/login" : "/staff/login"} className="font-medium text-ink underline underline-offset-4 hover:text-red">
              {staff ? "Use the admin sign-in" : "Use the staff sign-in"}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
