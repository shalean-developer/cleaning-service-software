type JsonLdScriptProps = {
  data: object;
};

/** Renders a single JSON-LD document (object or @graph wrapper). */
export function JsonLdScript({ data }: JsonLdScriptProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
