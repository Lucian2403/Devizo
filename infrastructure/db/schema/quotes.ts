import {
  pgTable,
  uuid,
  timestamp,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { projects } from "./projects";

/**
 * A quote is a container that belongs to one organization and optionally to a
 * project. The actual content lives in quote_versions; the quote itself only
 * groups versions together.
 *
 * The project reference uses a composite foreign key on
 * (project_id, organization_id) so a quote can never point at a project that
 * belongs to a different organization.
 */
export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Composite FK: the referenced project must be in the same organization.
    // When project_id is null the FK is not enforced (MATCH SIMPLE).
    projectOrgFk: foreignKey({
      columns: [table.projectId, table.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
      name: "quotes_project_org_fkey",
    }).onDelete("set null"),
    // Lets quote_versions reference (id, organization_id) with a composite FK.
    orgIdUnique: unique("quotes_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
  }),
);

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
