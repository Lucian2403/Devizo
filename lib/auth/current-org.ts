import { requireUser } from "@/lib/auth/session";
import { getOrganizationService } from "@/server/container";
import type { Organization } from "@/domain/organizations/organization.repository";

/**
 * Returns the current user and their organization.
 * For the MVP a user has exactly one organization, so we take the first.
 * If they have none, the caller (app layout) already sends them to onboarding.
 */
export async function requireCurrentOrg(): Promise<{
  userId: string;
  org: Organization;
}> {
  const user = await requireUser();
  const orgs = await getOrganizationService().getOrganizationsForUser(user.id);
  const org = orgs[0];
  if (!org) {
    // Should not happen inside the app shell, but keep it explicit.
    throw new Error("No organization for the current user.");
  }
  return { userId: user.id, org };
}
