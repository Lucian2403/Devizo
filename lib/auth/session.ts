import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/infrastructure/supabase/server";

// Server components in the same request often ask for the current user more
// than once (layout + page). React's request cache lets them share one Supabase
// lookup without carrying authentication data across requests or users.
const loadSessionUserForRequest = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Returns the current authenticated user or null. */
export async function getSessionUser(): Promise<User | null> {
  return loadSessionUserForRequest();
}

/** Returns the current user or redirects to sign-in. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return user;
}
