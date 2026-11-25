type LoaderArgs = { src: string; width: number; quality?: number };

const UNSPLASH = /^(images|plus)\.unsplash\.com$/;
/**
 * Stored photos ("/media/<id>/<name>"): the image (at most 1600–2000 px) and, for imported catalogue photos and
 * uploads, a 960 px card copy served at `?w=960` — the route falls back to the image itself when there's none
 * (older uploads, GIFs). Kept in step with MEDIA_THUMB_WIDTH and src/app/media/[id]/[name]/route.ts.
 */
const STORED = /^\/media\/\d{1,10}\/[^/?#]+\.(?:webp|jpe?g|png|avif)$/i;
const CARD_WIDTH = 960;
/**
 * srcset entries up to this width get the card rendition: next/image's steps up to 1080 — thumbnails, cards (also on
 * 3× phones, where a 360 px card asks for ~1080) and a desktop hero at 1× (~950 px). Larger requests get the original.
 */
const CARD_UP_TO = 1080;

/**
 * Unsplash serves resized, format-negotiated renditions from its CDN, so we ask it for the
 * width next/image wants. Stored photos come in two sizes (see STORED). Everything
 * else — other uploads under /media/, other site paths and images on other hosts — is returned
 * unchanged and served as-is.
 */
export default function imageLoader({ src, width, quality }: LoaderArgs) {
  // Non-resizable images get the width as a #fragment: the browser fetches (and caches) one
  // file for every srcset entry, and next/image sees the loader honouring the width.
  const asIs = (url = src) => (url.includes("#") ? url : `${url}#w=${width}`);
  if (STORED.test(src)) return asIs(width <= CARD_UP_TO ? `${src}?w=${CARD_WIDTH}` : src);
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
