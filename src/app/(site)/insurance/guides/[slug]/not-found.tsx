import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GuideNotFound() {
  return (
    <section className="py-20 md:py-28">
      <div className="container-x flex flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-mist">
          <BookOpen aria-hidden className="size-6" />
        </span>
        <p className="type-eyebrow mt-6 text-muted">404 · Guide not found</p>
        <h1 className="type-h2 mt-4 max-w-xl text-balance">We couldn&apos;t find that guide.</h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">It may have been renamed or retired. All our current insurance guides are on the guides page.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button href="/insurance/guides" arrow>
            Browse the guides
          </Button>
          <Button href="/insurance" variant="outline">
            Insurance home
          </Button>
        </div>
        <Link href="/insurance/claims" className="mt-8 text-[13.5px] text-muted underline underline-offset-4 hover:text-ink">
          Need help with a claim?
        </Link>
      </div>
    </section>
  );
}
