import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * A customer belongs to one organization.
 * Customers are never hard-deleted; setting archived_at hides them from the
 * default list while keeping the row for history and future quotes.
 */
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  preferredLanguage: text("preferred_language"),
  notes: text("notes"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
