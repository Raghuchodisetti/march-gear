import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ChevronRight, KeyRound, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { PortalHeader, formatDateTime, formatDay } from "@/components/portal/ui";
import { ProfileForm } from "@/components/customer/profile/profile-form";

export const metadata: Metadata = { title: "Personal details" };

export default async function PersonalDetailsPage() {
  const user = await requireUser("/account/profile");
  const [[row], cat] = await Promise.all([getDb().select({ lastLoginAt: users.lastLoginAt }).from(users).where(eq(users.id, user.id)), getCatalog()]);
  // Older accounts have a city but no state — fill it in when we know the city.
  const state = user.state || cat.cities.find((c) => c.name === user.city)?.state || "";

  return (
    <>
      <PortalHeader title="Personal details" description="Used to pre-fill your test-drive, quote and insurance requests. Only you and the businesses you contact see them." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <ProfileForm initial={{ name: user.name, mobile: user.phone ?? "", state, city: user.city ?? "" }} email={user.email} />

        <aside className="space-y-4 self-start">
          <dl className="border border-line bg-white px-5 py-4 text-[13px]">
            {[
              ["Member since", formatDay(user.memberSince)],
              ["Last sign-in", row?.lastLoginAt ? formatDateTime(row.lastLoginAt) : "—"],
              ["Account", "MarchGear website"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <nav aria-label="More account settings" className="border border-line bg-white">
            {[
              { href: "/account/security", label: "Password & security", note: "Change password, signed-in devices", icon: KeyRound },
              { href: "/account/preferences", label: "Preferences", note: "Alerts and how to reach you", icon: SlidersHorizontal },
              { href: "/account/privacy", label: "Privacy & data", note: "Download or delete your data", icon: ShieldCheck },
            ].map(({ href, label, note, icon: Icon }) => (
              <Link key={href} href={href} className="group flex items-center gap-3 border-b border-line px-5 py-3.5 transition-colors last:border-b-0 hover:bg-mist/60">
                <Icon aria-hidden className="size-4 shrink-0 text-ink/60" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium">{label}</span>
                  <span className="block truncate text-[12px] text-muted">{note}</span>
                </span>
                <ChevronRight aria-hidden className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </nav>
        </aside>
      </div>
    </>
  );
}
