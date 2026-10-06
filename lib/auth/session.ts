import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/infrastructure/supabase/server";

/** The identity details the app reads from the verified session token. */
export interface SessionUser {
  id: string;
  email: string | undefined;
  user_metadata: Record<string, unknown>;
}

// Server components in the same request often ask for the current user more
// than once (layout + page). React's request cache lets them share one lookup
// without carrying authentication data across requests or users.
//
// getClaims() verifies the access token's signature and expiry locally against
// Supabase's public keys instead of calling the Auth server on every request
// (getUser() costs a network round trip each time). Trade-off: a token revoked
// on the server stays valid until it expires (one hour by default); access to
// organization data is still checked against the database on every request.
const loadSessionUserForRequest = cache(
  async (): Promise<SessionUser | null> => {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims?.sub) return null;

    return {
      id: claims.sub,
      email: claims.email,
      user_metadata: claims.user_metadata ?? {},
    };
  },
);

/** Returns the current authenticated user or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  return loadSessionUserForRequest();
}

/** Returns the current user or redirects to sign-in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return user;
}
