type LoaderArgs = { src: string; width: number; quality?: number };

export default function unsplashLoader({ src, width, quality }: LoaderArgs) {
  if (src.startsWith("/")) return src;
  const url = new URL(src);
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "max");
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality ?? 75));
  return url.href;
}
