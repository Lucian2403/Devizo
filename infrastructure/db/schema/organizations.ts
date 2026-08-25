import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  numeric,
} from "drizzle-orm/pg-core";

/**
 * A company account. Owns all application data.
 * Language, currency and tax settings are kept as separate fields because
 * language must never imply country or currency.
 */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  // Company profile / contact details (filled in on the settings page).
  legalName: text("legal_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  country: text("country"),
  vatNumber: text("vat_number"),
  // VAT percentage, e.g. 20.00. Stored as NUMERIC so it is never a float.
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }),
  defaultCurrency: text("default_currency").notNull().default("EUR"),
  defaultLanguage: text("default_language").notNull().default("en"),
  customerDocumentLanguage: text("customer_document_language")
    .notNull()
    .default("en"),
  // Kept intentionally simple for the MVP: e.g. { "vatRate": "20" }.
  taxProfile: jsonb("tax_profile").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
