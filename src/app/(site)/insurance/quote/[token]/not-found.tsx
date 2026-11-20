import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="container-x flex min-h-[55vh] flex-col items-start justify-center py-24">
      <p className="type-eyebrow flex items-center gap-3 text-muted">
        <span aria-hidden className="h-px w-6 bg-red" />
        Quote not found
      </p>
      <h1 className="type-h1 mt-5 max-w-2xl text-balance">This quote link doesn&apos;t work.</h1>
      <p className="type-lead mt-5 max-w-lg text-muted">The insurer may have withdrawn the quote, or the link is incomplete. Check the link they sent you, or ask for a fresh quote.</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button href="/insurance/quotes">Your quote requests</Button>
        <Button href="/insurance" variant="outline">
          Insurance home
        </Button>
      </div>
    </section>
  );
}
