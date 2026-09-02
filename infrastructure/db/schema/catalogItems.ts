import {
  pgTable,
  uuid,
  text,
  numeric,
  boolean,
  timestamp,
  foreignKey,
  uniqueIndex,
  check,
  vector,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { catalogCategories } from "./catalogCategories";

/**
 * A single priced work item. All prices use the organization's default
 * currency (no per-item currency in the MVP). Money is NUMERIC, never a float.
 * The category reference uses a composite foreign key on
 * (category_id, organization_id) so an item can never point at a category from
 * another organization.
 */
export const catalogItems = pgTable(
  "catalog_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id"),
    code: text("code"),
    name: text("name").notNull(),
    description: text("description"),
    unit: text("unit").notNull(),
    itemType: text("item_type").notNull().default("labor"),
    sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }).notNull(),
    costPrice: numeric("cost_price", { precision: 12, scale: 2 }),
    active: boolean("active").notNull().default(true),
    // --- Semantic search (M5.1) ------------------------------------------
    // Embedding of the item's semantic fields (name/description/category/
    // item_type/unit). Nullable = not yet embedded; retrieval falls back to
    // lexical for such rows. Dimension is fixed at 768 for this schema.
    embedding: vector("embedding", { dimensions: 768 }),
    // Hash of the exact text that produced `embedding`. Used to skip
    // re-embedding when only non-semantic fields (e.g. price) change.
    embeddingSource: text("embedding_source"),
    // Provider/model that produced the embedding, so we can re-embed safely
    // if the model or dimensionality ever changes.
    embeddingModel: text("embedding_model"),
    embeddingUpdatedAt: timestamp("embedding_updated_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Composite FK keeps the category within the same organization.
    categoryOrgFk: foreignKey({
      columns: [table.categoryId, table.organizationId],
      foreignColumns: [catalogCategories.id, catalogCategories.organizationId],
      name: "catalog_items_category_org_fkey",
    }).onDelete("set null"),
    // A code, when present, must be unique inside the organization.
    codeUnique: uniqueIndex("catalog_items_org_code_unique")
      .on(table.organizationId, table.code)
      .where(sql`${table.code} is not null`),
    unitCheck: check(
      "catalog_items_unit_check",
      sql`${table.unit} in ('m2', 'm', 'm3', 'pcs', 'hour', 'day', 'kg', 'l', 'set', 'service')`,
    ),
    itemTypeCheck: check(
      "catalog_items_item_type_check",
      sql`${table.itemType} in ('labor', 'material')`,
    ),
  }),
);

export type CatalogItem = typeof catalogItems.$inferSelect;
export type NewCatalogItem = typeof catalogItems.$inferInsert;
