import {
  pgTable,
  uuid,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * Roles for the MVP are intentionally limited to owner and manager.
 */
export const ORGANIZATION_ROLES = ["owner", "manager"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

/**
 * Links a Supabase auth user to an organization with a role.
 * user_id references auth.users.id (enforced via SQL migration, not Drizzle,
 * because the auth schema is owned by Supabase).
 */
export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: text("role", { enum: ORGANIZATION_ROLES }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueMembership: unique().on(table.organizationId, table.userId),
  }),
);

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;
