import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

/**
 * A company account. Owns all application data.
 * Language, currency and tax settings are kept as separate fields because
 * language must never imply country or currency.
 */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
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
