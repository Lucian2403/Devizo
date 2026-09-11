import { cache } from "react";
import { requireUser } from "@/lib/auth/session";
import { getOrganizationService } from "@/server/container";
import type { Organization } from "@/domain/organizations/organization.repository";

const loadCurrentOrganizationForRequest = cache(async (): Promise<{
  userId: string;
  org: Organization;
}> => {
  const user = await requireUser();
  const organizations = await getOrganizationService().getOrganizationsForUser(user.id);
  const organization = organizations[0];

  if (!organization) {
    // Protected app routes normally pass through the app shell first, but keep
    // this guard here too because server actions may call this function directly.
    throw new Error("No organization for the current user.");
  }

  return { userId: user.id, org: organization };
});

/**
 * Returns the current user id and organization for this request.
 * Layouts, pages and server components share the same lookup when they ask for
 * it more than once during one render.
 */
export async function requireCurrentOrg(): Promise<{
  userId: string;
  org: Organization;
}> {
  return loadCurrentOrganizationForRequest();
}
