import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { catalogItems } from "./catalogItems";

/**
 * Minimal correction log for AI catalog matching (M5.1). When a user changes
 * the suggested catalog match we record what was suggested vs what was chosen.
 * This is raw data only — there is deliberately no automatic learning yet; it
 * exists so future company-specific ranking/fine-tuning has real corrections.
 */
export const catalogMatchFeedback = pgTable(
  "catalog_match_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // The extracted/original text the suggestion was made for.
    extractedText: text("extracted_text").notNull(),
    // What the matcher suggested (nullable = suggested NO_MATCH).
    suggestedCatalogItemId: uuid("suggested_catalog_item_id").references(
      () => catalogItems.id,
      { onDelete: "set null" },
    ),
    // What the user actually chose (nullable = user chose NO_MATCH).
    selectedCatalogItemId: uuid("selected_catalog_item_id").references(
      () => catalogItems.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgCreatedIdx: index("catalog_match_feedback_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
  }),
);

export type CatalogMatchFeedback = typeof catalogMatchFeedback.$inferSelect;
export type NewCatalogMatchFeedback = typeof catalogMatchFeedback.$inferInsert;
