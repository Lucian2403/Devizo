import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Supabase client for use in Client Components (runs in the browser).
// Uses the publishable key, which is safe to expose.
export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
