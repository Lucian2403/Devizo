/**
 * Builds an HTTP Content-Disposition value that is valid for the Fetch/Headers
 * ByteString rules while still preserving the real UTF-8 filename for browsers.
 */
export function buildPdfContentDisposition(filename: string): string {
  const asciiFallback =
    filename
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9._ -]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "oferta.pdf";

  const encodedUtf8Filename = encodeURIComponent(filename).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedUtf8Filename}`;
}
