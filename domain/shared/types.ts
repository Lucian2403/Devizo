export const ORGANIZATION_ROLES = ["owner", "manager"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export type UserId = string;
export type OrganizationId = string;
export type CustomerId = string;
export type ProjectId = string;
export type CatalogCategoryId = string;
export type CatalogItemId = string;
export type QuoteId = string;
export type QuoteVersionId = string;
export type QuoteItemId = string;
// The languages the MVP supports. Language fields must use one of these codes.
export const SUPPORTED_LANGUAGES = [
  "ro",
  "ru",
  "en",
  "it",
  "fr",
  "de",
  "es",
] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// The currencies the MVP supports. Currency fields must use one of these codes.
export const SUPPORTED_CURRENCIES = [
  "MDL",
  "EUR",
  "RON",
  "USD",
  "GBP",
] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

// The canonical units the catalog understands. Imported values must be mapped
// to one of these; arbitrary unit strings are never stored.
export const SUPPORTED_UNITS = [
  "m2",
  "m",
  "m3",
  "pcs",
  "hour",
  "day",
  "kg",
  "l",
  "set",
  "service",
] as const;
export type SupportedUnit = (typeof SUPPORTED_UNITS)[number];

// A project moves through these stages. Archiving is separate from status.
export const PROJECT_STATUSES = ["planned", "active", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// A quote version moves through these stages. Only 'draft' is editable in the
// MVP; 'sent'/'accepted'/'rejected' versions become immutable.
export const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
