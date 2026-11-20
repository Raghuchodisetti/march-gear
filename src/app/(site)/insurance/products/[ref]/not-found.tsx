import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="container-x flex min-h-[55vh] flex-col items-start justify-center py-24">
      <p className="type-eyebrow flex items-center gap-3 text-muted">
        <span aria-hidden className="h-px w-6 bg-red" />
        Plan not found
      </p>
      <h1 className="type-h1 mt-5 max-w-2xl text-balance">This plan isn&apos;t available.</h1>
      <p className="type-lead mt-5 max-w-lg text-muted">It may have been withdrawn by the insurer or is being updated. Compare the plans that are live now.</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button href="/insurance/quotes">See plans for your car</Button>
        <Button href="/insurance/compare" variant="outline">
          Compare plans
        </Button>
      </div>
    </section>
  );
}
