import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getQuoteService } from "@/server/container";
import { QuoteVersionNotFoundError } from "@/domain/quotes/quote.service";
import { renderQuotePdf } from "@/lib/pdf/render-quote-pdf";
import { PDF_STRINGS, PDF_LOCALES } from "@/lib/pdf/quote-strings";
import type { SupportedLanguage } from "@/domain/shared/types";

export const runtime = "nodejs";

// Build a deterministic, customer-friendly, filesystem-safe filename.
function buildFilename(title: string, projectName: string | null, version: number) {
  const base = projectName?.trim() ? projectName.trim() : "deviz";
  const safe = base
    .normalize("NFKD")
    // Keep letters/numbers/space/dash; replace everything else with a dash.
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${title}-${safe || "deviz"}-v${version}.pdf`;
}

/**
 * GET /api/quotes/[quoteId]/versions/[versionId]/pdf
 *
 * Streams the customer-facing PDF for one exact QuoteVersion. Renders strictly
 * from the frozen version snapshot — no live Organization/Customer/Project/
 * Catalog reads, no recomputation.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ quoteId: string; versionId: string }> },
) {
  const { quoteId, versionId } = await params;
  const { org } = await requireCurrentOrg();

  let data;
  try {
    data = await getQuoteService().getVersion(org.id, versionId);
  } catch (error) {
    if (error instanceof QuoteVersionNotFoundError) {
      return new Response("Not found", { status: 404 });
    }
    throw error;
  }

  // The version must belong to the quote in the URL.
  if (data.quote.id !== quoteId) {
    return new Response("Not found", { status: 404 });
  }

  const version = data.version;
  const pdf = await renderQuotePdf(version);

  const lang: SupportedLanguage =
    (version.documentLanguage as SupportedLanguage) in PDF_LOCALES
      ? (version.documentLanguage as SupportedLanguage)
      : "ro";
  const filename = buildFilename(
    PDF_STRINGS[lang].documentTitle,
    version.projectName,
    version.versionNumber,
  );

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
