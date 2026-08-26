import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * A flat price-list category. No parent/child hierarchy in the MVP.
 * The composite unique on (id, organization_id) lets catalog items reference a
 * category with a composite foreign key, preventing cross-organization links.
 */
export const catalogCategories = pgTable(
  "catalog_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdUnique: unique("catalog_categories_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
  }),
);

export type CatalogCategory = typeof catalogCategories.$inferSelect;
export type NewCatalogCategory = typeof catalogCategories.$inferInsert;
