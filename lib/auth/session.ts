import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/infrastructure/supabase/server";

/** Returns the current authenticated user or null. */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Returns the current user or redirects to sign-in. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return user;
}
