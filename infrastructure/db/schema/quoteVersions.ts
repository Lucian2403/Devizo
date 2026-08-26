import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  foreignKey,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { quotes } from "./quotes";

/**
 * A quote version is the source of truth for a quote's content at a point in
 * time. Money fields are NUMERIC, never floats, and are computed server-side.
 *
 * Document-facing customer/project details are SNAPSHOTTED here so editing the
 * Customer or Project records later never changes an existing version. The live
 * relations (via the parent quote) are only for navigation.
 */
export const quoteVersions = pgTable(
  "quote_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    status: text("status").notNull().default("draft"),
    currency: text("currency").notNull(),

    // Snapshotted document details (see note above).
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    projectName: text("project_name"),
    projectAddress: text("project_address"),

    notes: text("notes"),
    validityDays: integer("validity_days"),

    // Rates captured on the version so later settings changes don't alter it.
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),

    // Computed totals, stored for stability and fast reads.
    subtotal: numeric("subtotal", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    taxableAmount: numeric("taxable_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    vatAmount: numeric("vat_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Composite FK: the quote must be in the same organization as the version.
    quoteOrgFk: foreignKey({
      columns: [table.quoteId, table.organizationId],
      foreignColumns: [quotes.id, quotes.organizationId],
      name: "quote_versions_quote_org_fkey",
    }).onDelete("cascade"),
    // Version numbers are sequential and unique within a quote.
    versionUnique: unique("quote_versions_quote_version_unique").on(
      table.quoteId,
      table.versionNumber,
    ),
    // Lets quote_items reference (id, organization_id) with a composite FK.
    orgIdUnique: unique("quote_versions_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    statusCheck: check(
      "quote_versions_status_check",
      sql`${table.status} in ('draft', 'sent', 'accepted', 'rejected')`,
    ),
  }),
);

export type QuoteVersion = typeof quoteVersions.$inferSelect;
export type NewQuoteVersion = typeof quoteVersions.$inferInsert;
