/** Structured data for search engines, as a JSON-LD script tag.
 *
 * `<` is escaped so a product name or answer holding `</script>` cannot close
 * the tag early: the JSON is still identical once parsed. */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
