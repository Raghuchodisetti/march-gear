import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="container-x flex min-h-[55vh] flex-col items-start justify-center py-24">
      <p className="type-eyebrow flex items-center gap-3 text-muted">
        <span aria-hidden className="h-px w-6 bg-red" />
        Provider not found
      </p>
      <h1 className="type-h1 mt-5 max-w-2xl text-balance">This insurer isn&apos;t listed right now.</h1>
      <p className="type-lead mt-5 max-w-lg text-muted">It may have been removed, or its listing is paused. See the insurers currently on MarchGear.</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button href="/insurance/providers">All providers</Button>
        <Button href="/insurance/quotes" variant="outline">
          Get quotes
        </Button>
      </div>
    </section>
  );
}
