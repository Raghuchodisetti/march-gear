/**
 * Structured data as a JSON-LD script. `<` is escaped so text from the CMS can't close the tag.
 * Renders on the server and in client components alike.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
