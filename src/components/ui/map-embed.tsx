"use client";

import { useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Click-to-load third-party map. Nothing is requested from the map provider (and no cookies are
 * set) until the viewer asks for the map; a plain link opens it in the provider's own site instead.
 */
export function MapEmbed({
  src,
  title,
  href,
  provider = "Google Maps",
  className,
}: {
  /** The provider's embed URL. */
  src: string;
  /** Accessible title for the iframe, e.g. "Map of Gajuwaka showroom". */
  title: string;
  /** Link to open the same place on the provider's site. */
  href?: string;
  provider?: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  if (loaded)
    return <iframe title={title} src={src} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className={cn("w-full border-0 bg-mist", className)} />;

  return (
    <div className={cn("flex w-full flex-col items-center justify-center gap-3 bg-mist px-6 py-8 text-center", className)}>
      <span className="inline-flex size-11 items-center justify-center rounded-full bg-white text-ink shadow-soft">
        <MapPin aria-hidden className="size-5" />
      </span>
      <p className="text-[13.5px] font-medium text-ink">{title}</p>
      <p className="max-w-xs text-[12.5px] leading-relaxed text-muted">The map loads from {provider}, which may set its own cookies.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setLoaded(true)}
          className="inline-flex h-9 items-center rounded-[3px] bg-ink px-3.5 text-[12.5px] font-medium text-white transition-colors duration-[250ms] hover:bg-ink-3"
        >
          Show map
        </button>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-[3px] border border-line bg-white px-3.5 text-[12.5px] font-medium text-ink transition-colors duration-[250ms] hover:border-ink"
          >
            <ExternalLink aria-hidden className="size-3.5" /> Open in {provider}
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </div>
    </div>
  );
}
