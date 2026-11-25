import { getCatalog } from "@/server/catalog";
import { C, Eyebrow, OG_CONTENT_TYPE, OG_SIZE, Wordmark, clip, ogImage, photo } from "@/components/seo/og";

/** Share card for a story: its photo, darkened, with the category and headline. Rendered on first request, then cached. */
export const alt = "A story from the MarchGear newsroom";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = await getCatalog();
  const article = cat.getArticle(slug);
  const img = article ? await photo(article.image, 1200, 630) : null;
  const title = article ? clip(article.title, 90) : "News from MarchGear";

  return ogImage(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: C.ink }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered by next/og (Satori), not the browser */}
      {img && <img src={img} width={1200} height={630} alt="" style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, objectFit: "cover" }} />}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1200,
          height: 630,
          display: "flex",
          backgroundImage: "linear-gradient(90deg, rgba(17,17,17,0.95) 0%, rgba(17,17,17,0.85) 50%, rgba(17,17,17,0.3) 100%)",
        }}
      />
      <div style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "60px 72px" }}>
        <Wordmark scale={0.9} />
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
          <Eyebrow>{article ? article.category : "News"}</Eyebrow>
          <div style={{ display: "flex", marginTop: 24, fontFamily: "Archivo", fontSize: title.length > 60 ? 52 : 62, lineHeight: 1.06, letterSpacing: -1.8, color: C.white }}>{title}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "Geist", fontSize: 20, color: "rgba(255,255,255,0.7)" }}>
          <div style={{ width: 10, height: 10, borderRadius: 10, background: C.red, display: "flex" }} />
          {article ? `${article.readMinutes} min read · marchgear.in/news` : "marchgear.in/news"}
        </div>
      </div>
    </div>,
  );
}
