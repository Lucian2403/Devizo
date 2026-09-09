import {
  pgTable,
  uuid,
  text,
  timestamp,
  foreignKey,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { quotes } from "./quotes";

/**
 * Immutable audit log for important quote lifecycle decisions (M6). Each row
 * records WHO did WHAT and WHEN — never any duplicated financial data. The
 * exact quote_version_id ties the event to the frozen commercial document.
 *
 * Rows are append-only; there are deliberately no update/delete paths.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").notNull(),
    quoteVersionId: uuid("quote_version_id").notNull(),
    actorUserId: uuid("actor_user_id").notNull(),
    eventType: text("event_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Composite FK: the quote must belong to the same organization.
    quoteOrgFk: foreignKey({
      columns: [table.quoteId, table.organizationId],
      foreignColumns: [quotes.id, quotes.organizationId],
      name: "audit_events_quote_org_fkey",
    }).onDelete("cascade"),
    orgCreatedIdx: index("audit_events_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    versionIdx: index("audit_events_version_idx").on(table.quoteVersionId),
    eventTypeCheck: check(
      "audit_events_event_type_check",
      sql`${table.eventType} in ('quote_sent', 'quote_accepted', 'quote_rejected')`,
    ),
  }),
);

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
