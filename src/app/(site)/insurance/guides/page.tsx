import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { IMG } from "@/data/images";
import { getCatalog } from "@/server/catalog";
import { Button } from "@/components/ui/button";
import { CategoryAd, CtaBand, LandingHero } from "@/components/insurance/public/landing";
import { GuidesIndex } from "@/components/insurance/public/guides-index";
import { INSURANCE_OG_IMAGE, pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Car Insurance Guides: IDV, NCB, Claims & More",
  description: "Plain-language guides to car insurance in India: how IDV and the no-claim bonus work, which add-ons matter, how to claim, and renewing a lapsed policy.",
  path: "/insurance/guides",
  images: [INSURANCE_OG_IMAGE],
});

export default async function GuidesPage() {
  const { content } = await getCatalog();
  const page = content.insurancePage.pages.guides;
  const guides = content.insuranceGuides.guides;
  const minutes = guides.reduce((n, g) => n + g.minutes, 0);

  return (
    <>
      <LandingHero hero={page} image={IMG.cockpit} imageFocus="50% 45%" crumb="Guides">
        {guides.length > 0 && (
          <p className="text-[14px] text-white/70 num">
            {guides.length} guides · about {minutes} minutes of reading in all
          </p>
        )}
      </LandingHero>
      <CategoryAd />

      <section aria-label="Guides" className="py-14 md:py-20">
        <div className="container-x">
          {guides.length ? (
            <GuidesIndex guides={guides} />
          ) : (
            <div className="flex flex-col items-center border border-dashed border-line px-6 py-20 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-mist">
                <BookOpen aria-hidden className="size-6" />
              </span>
              <h2 className="type-h3 mt-5">Guides are on their way</h2>
              <p className="mt-2 max-w-md text-[15px] text-muted">Our editors are writing plain-language guides to car insurance. Meanwhile, the policy types page covers the basics.</p>
              <Button href="/insurance/types" variant="outline" className="mt-7">
                Policy types explained
              </Button>
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-line bg-mist py-10">
        <div className="container-x flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px]">
            <span className="font-semibold">Looking for stories, not guides?</span> <span className="text-muted">Our newsroom covers insurance in ownership features too.</span>
          </p>
          <Link href="/insurance/articles" className="group inline-flex items-center gap-1.5 text-[14px] font-medium">
            Insurance stories
            <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>
      <CtaBand title="Read enough?" accent="See what your car would cost to insure." action={{ label: "Get indicative premiums", href: "/insurance#quote" }} topic="other" />
    </>
  );
}
