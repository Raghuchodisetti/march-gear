type LoaderArgs = { src: string; width: number; quality?: number };

const UNSPLASH = /^(images|plus)\.unsplash\.com$/;

/**
 * Unsplash serves resized, format-negotiated renditions from its CDN, so we ask it for the
 * width next/image wants. Everything else — uploads under /media/, other site paths and
 * images on other hosts — is returned unchanged and served as-is.
 */
export default function imageLoader({ src, width, quality }: LoaderArgs) {
  // Non-resizable images get the width as a #fragment: the browser fetches (and caches) one
  // file for every srcset entry, and next/image sees the loader honouring the width.
  const asIs = () => (src.includes("#") ? src : `${src}#w=${width}`);
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return asIs(); // A relative path such as /media/12/photo.webp.
  }
  if (url.protocol !== "https:" || !UNSPLASH.test(url.hostname)) return asIs();
  // auto=format serves AVIF or WebP to browsers that accept them (JPEG otherwise). A pasted URL's
  // explicit fm=jpg/png would override that, so it's dropped.
  url.searchParams.delete("fm");
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "max");
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality ?? 75));
  return url.href;
}
