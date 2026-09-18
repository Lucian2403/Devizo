import type { QuoteVersion } from "../../domain/quotes/quote.repository";
import {
  COMMERCIAL_OFFER_PDF_TEMPLATE_V1,
  CURRENT_COMMERCIAL_OFFER_PDF_TEMPLATE_VERSION,
} from "../../domain/quotes/pdf-template-version";
import { renderCommercialOfferV1 } from "./templates/commercial-offer-v1/document";

/**
 * Routes rendering through the template id frozen on the finalized version.
 * Drafts have no frozen template yet, so preview/test rendering uses the
 * current template. Unknown frozen ids fail loudly instead of silently
 * re-rendering a historical document with a newer layout.
 */
export async function renderQuotePdf(version: QuoteVersion): Promise<Buffer> {
  const templateVersion: string =
    version.pdfTemplateVersion ??
    CURRENT_COMMERCIAL_OFFER_PDF_TEMPLATE_VERSION;

  if (templateVersion === COMMERCIAL_OFFER_PDF_TEMPLATE_V1) {
    return renderCommercialOfferV1(version);
  }

  throw new Error(`Unsupported quote PDF template version: ${templateVersion}`);
}
