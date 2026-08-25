import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Application-specific user data. The identity source is Supabase auth.users;
 * this row shares its id with auth.users.id and is created on first sign-in.
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
