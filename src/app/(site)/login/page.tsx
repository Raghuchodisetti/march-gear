import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { Bell, CalendarCheck, Heart } from "lucide-react";
import { IMG } from "@/data/images";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Eyebrow } from "@/components/ui/section-heading";
import { AuthPanel } from "@/components/account/auth-panel";
import { PRIVATE_ROBOTS } from "@/components/seo/metadata";

export const metadata: Metadata = {
  title: "Sign in or create an account",
  description: "Sign in to MarchGear to sync saved cars, comparisons, price alerts and test-drive bookings across devices.",
  alternates: { canonical: "/login" },
  // Account pages stay out of search (robots.txt also disallows /login).
  robots: PRIVATE_ROBOTS,
};

const BENEFITS = [
  { icon: Heart, label: "Saved cars and comparisons on every device" },
  { icon: Bell, label: "Price-drop and launch alerts for your shortlist" },
  { icon: CalendarCheck, label: "Test drives and dealer quotes in one place" },
];

export default function LoginPage() {
  return (
    <section className="grid grid-cols-1 lg:min-h-[calc(100dvh-72px)] lg:grid-cols-2">
      <div className="relative isolate flex min-h-[260px] flex-col overflow-hidden bg-ink text-white sm:min-h-[320px] lg:min-h-0">
        <Image
          src={IMG.wheelHands}
          alt="A driver's hands on the steering wheel on an open road"
          fill
          preload
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="-z-10 object-cover opacity-75"
          style={{ objectPosition: "50% 60%" }}
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/40 to-ink/30" />

        <div className="flex flex-1 flex-col justify-between gap-10 p-5 pt-6 md:p-10 lg:p-14">
          <Breadcrumbs items={[{ label: "Sign in" }]} tone="light" />
          <div className="max-w-xl">
            <Eyebrow tone="light">March Gear Members</Eyebrow>
            <blockquote className="mt-5">
              <p className="type-h3 text-balance md:type-h2">
                &ldquo;The best drives begin <span className="type-editorial">long before</span> the ignition.&rdquo;
              </p>
            </blockquote>
            <ul className="mt-10 hidden space-y-3.5 border-t border-white/15 pt-8 lg:block">
              {BENEFITS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-[14px] text-white/75">
                  <Icon aria-hidden className="size-4 text-red" strokeWidth={1.8} />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex justify-center px-5 py-12 md:px-12 md:py-16 lg:items-center lg:px-16 lg:py-20">
        <div className="w-full min-w-0 max-w-[440px]">
          <Suspense fallback={<AuthSkeleton />}>
            <AuthPanel />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

function AuthSkeleton() {
  return (
    <div aria-hidden>
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-6 h-12 w-3/4" />
      <div className="skeleton mt-4 h-4 w-full" />
      <div className="mt-10 flex gap-7 border-b border-line pb-3.5">
        <div className="skeleton h-4 w-16" />
        <div className="skeleton h-4 w-28" />
      </div>
      <div className="skeleton mt-8 h-11 w-full" />
      <div className="skeleton mt-8 h-12 w-full" />
      <div className="skeleton mt-6 h-13 w-full" />
    </div>
  );
}
