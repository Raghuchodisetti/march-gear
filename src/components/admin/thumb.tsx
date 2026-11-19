import { cn } from "@/lib/utils";

/** Small list thumbnail for any image URL. */
export function Thumb({ src, className }: { src?: string | null; className?: string }) {
  return (
    <span className={cn("block h-10 w-14 shrink-0 overflow-hidden rounded-[2px] bg-mist", className)}>
      {src ? (
        // Arbitrary admin-entered URLs — plain <img> on purpose.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src.includes("images.unsplash.com") ? `${src.split("?")[0]}?w=160&q=60&auto=format` : src} alt="" className="size-full object-cover" loading="lazy" />
      ) : null}
    </span>
  );
}
