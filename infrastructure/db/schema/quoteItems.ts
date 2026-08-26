import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { quoteVersions } from "./quoteVersions";

/**
 * A single line on a quote version. Name, description, unit and unit price are
 * SNAPSHOTS taken when the item is added, so later catalog edits never change
 * an existing quote version. catalog_item_id is a soft reference kept only for
 * traceability — it is never joined to fetch pricing.
 *
 * line_total is stored (not virtual) and always computed by the pricing engine.
 */
export const quoteItems = pgTable(
  "quote_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    quoteVersionId: uuid("quote_version_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),

    // Soft reference only; not used for pricing.
    catalogItemId: uuid("catalog_item_id"),

    // Snapshotted, document-facing fields.
    name: text("name").notNull(),
    description: text("description"),
    unit: text("unit").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Composite FK: the version must be in the same organization as the item.
    versionOrgFk: foreignKey({
      columns: [table.quoteVersionId, table.organizationId],
      foreignColumns: [quoteVersions.id, quoteVersions.organizationId],
      name: "quote_items_version_org_fkey",
    }).onDelete("cascade"),
    unitCheck: check(
      "quote_items_unit_check",
      sql`${table.unit} in ('m2', 'm', 'm3', 'pcs', 'hour', 'day', 'kg', 'l', 'set', 'service')`,
    ),
  }),
);

export type QuoteItem = typeof quoteItems.$inferSelect;
export type NewQuoteItem = typeof quoteItems.$inferInsert;
