import { cache } from "react";
import { requireUser } from "@/lib/auth/session";
import { getOrganizationService } from "@/server/container";
import type { Organization } from "@/domain/organizations/organization.repository";

const loadCurrentOrganizationForRequest = cache(async (): Promise<{
  userId: string;
  org: Organization | null;
}> => {
  const user = await requireUser();
  const organizations = await getOrganizationService().getOrganizationsForUser(user.id);

  return {
    userId: user.id,
    org: organizations[0] ?? null,
  };
});

/**
 * Returns the current user id and organization when one exists.
 * Layouts and pages share this lookup during one server render.
 */
export async function getCurrentOrg(): Promise<{
  userId: string;
  org: Organization | null;
}> {
  return loadCurrentOrganizationForRequest();
}

/** Returns the current user id and organization, or fails if none exists. */
export async function requireCurrentOrg(): Promise<{
  userId: string;
  org: Organization;
}> {
  const current = await getCurrentOrg();
  if (!current.org) {
    // Server actions can call this without passing through the app layout first.
    throw new Error("No organization for the current user.");
  }

  return { userId: current.userId, org: current.org };
}
