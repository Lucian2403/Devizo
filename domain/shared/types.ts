export const ORGANIZATION_ROLES = ["owner", "manager"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export type UserId = string;
export type OrganizationId = string;
export type CustomerId = string;

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
