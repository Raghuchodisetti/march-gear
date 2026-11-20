import Image from "next/image";
import { Check } from "lucide-react";
import { IMG } from "@/data/images";
import { InsuranceSearchForm } from "@/components/insurance/search/insurance-search-form";

interface HeroCopy {
  eyebrow: string;
  title: string;
  accent: string;
  subtitle: string;
  points: string[];
}

/** The title with its accent words set in the italic serif. */
function Accented({ title, accent }: { title: string; accent: string }) {
  const at = accent ? title.indexOf(accent) : -1;
  if (at < 0) return <>{title}</>;
  return (
    <>
      {title.slice(0, at)}
      <span className="type-editorial font-normal text-white/90">{accent}</span>
      {title.slice(at + accent.length)}
    </>
  );
}

/** /insurance opener: photography, the promise, and the search form (buy new / renew). */
export function InsuranceHomeHero({ copy, stats }: { copy: HeroCopy; stats: { providers: number; plans: number } }) {
  return (
    <section aria-labelledby="ins-hero-title" className="relative isolate overflow-hidden bg-ink text-white">
      <Image
        src={IMG.autumnRoad}
        alt=""
        fill
        preload
        quality={75}
        sizes="100vw"
        className="-z-20 animate-kenburns object-cover opacity-70 [object-position:30%_60%]"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/70 via-ink/45 to-ink lg:bg-gradient-to-r lg:from-ink/85 lg:via-ink/55 lg:to-ink/30" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-ink to-transparent" />

      <div className="container-x grid grid-cols-1 gap-10 pb-14 pt-12 md:pb-20 md:pt-16 lg:grid-cols-12 lg:items-center lg:gap-12 lg:pb-24 lg:pt-20">
        <div className="min-w-0 lg:col-span-6 xl:col-span-6">
          <p className="type-eyebrow flex animate-rise items-center gap-3 text-white/85 [animation-delay:100ms]">
            <span aria-hidden className="h-px w-8 bg-red" />
            {copy.eyebrow}
          </p>
          <h1
            id="ins-hero-title"
            className="mt-6 max-w-[15ch] animate-rise text-balance font-display text-[clamp(2.6rem,1.6rem+3.6vw,5rem)] font-semibold leading-[0.98] tracking-[-0.035em] [animation-delay:200ms] [font-stretch:110%]"
          >
            <Accented title={copy.title} accent={copy.accent} />
          </h1>
          <p className="type-lead mt-6 max-w-xl animate-rise text-white/75 [animation-delay:350ms]">{copy.subtitle}</p>
          {copy.points.length > 0 && (
            <ul className="mt-8 grid max-w-xl animate-rise gap-3 [animation-delay:500ms]">
              {copy.points.slice(0, 3).map((p) => (
                <li key={p} className="flex items-start gap-3 text-[14.5px] text-white/85">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-inset ring-white/20">
                    <Check aria-hidden className="size-3 text-white" strokeWidth={3} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          )}
          {stats.providers > 0 && (
            <dl className="mt-10 hidden max-w-md animate-rise grid-cols-2 gap-px bg-white/10 [animation-delay:650ms] lg:grid">
              <div className="bg-ink/50 px-4 py-4 backdrop-blur-sm">
                <dt className="text-[12px] text-white/55">Listed providers</dt>
                <dd className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em] num">{stats.providers}</dd>
              </div>
              <div className="bg-ink/50 px-4 py-4 backdrop-blur-sm">
                <dt className="text-[12px] text-white/55">Plans to compare</dt>
                <dd className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em] num">{stats.plans}</dd>
              </div>
            </dl>
          )}
        </div>

        <div id="quote" className="min-w-0 scroll-mt-36 animate-rise [animation-delay:300ms] lg:col-span-6 xl:col-span-6">
          <InsuranceSearchForm variant="hero" source="insurance-home" />
        </div>
      </div>
    </section>
  );
}
