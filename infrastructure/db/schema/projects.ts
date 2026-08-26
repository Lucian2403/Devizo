import {
  pgTable,
  uuid,
  text,
  timestamp,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { customers } from "./customers";

/**
 * A project belongs to one organization and optionally to a customer.
 * Archiving (archived_at) is kept separate from the work status.
 * The customer reference uses a composite foreign key on
 * (customer_id, organization_id) so a project can never point at a customer
 * that belongs to a different organization.
 */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id"),
    name: text("name").notNull(),
    address: text("address"),
    description: text("description"),
    notes: text("notes"),
    status: text("status").notNull().default("planned"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Composite FK: the referenced customer must be in the same organization.
    // When customer_id is null the FK is not enforced (MATCH SIMPLE), which is
    // what we want for projects without a customer yet.
    customerOrgFk: foreignKey({
      columns: [table.customerId, table.organizationId],
      foreignColumns: [customers.id, customers.organizationId],
      name: "projects_customer_org_fkey",
    }).onDelete("set null"),
    statusCheck: check(
      "projects_status_check",
      sql`${table.status} in ('planned', 'active', 'completed')`,
    ),
  }),
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
