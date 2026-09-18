/**
 * Customer-facing commercial PDF templates are immutable once released.
 * Finalized quote versions store one of these ids so future redesigns cannot
 * silently change an already-issued document.
 */
export const COMMERCIAL_OFFER_PDF_TEMPLATE_V1 = "commercial-offer-v1" as const;

export const CURRENT_COMMERCIAL_OFFER_PDF_TEMPLATE_VERSION =
  COMMERCIAL_OFFER_PDF_TEMPLATE_V1;

export const COMMERCIAL_OFFER_PDF_TEMPLATE_VERSIONS = [
  COMMERCIAL_OFFER_PDF_TEMPLATE_V1,
] as const;

export type CommercialOfferPdfTemplateVersion =
  (typeof COMMERCIAL_OFFER_PDF_TEMPLATE_VERSIONS)[number];
