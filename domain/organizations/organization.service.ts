import type { UserId } from "@/domain/shared/types";
import type {
  CreateOrganizationInput,
  Organization,
  OrganizationRepository,
} from "./organization.repository";

export class SlugAlreadyTakenError extends Error {
  constructor(slug: string) {
    super(`Organization slug "${slug}" is already taken.`);
    this.name = "SlugAlreadyTakenError";
  }
}

/**
 * Pure application service. Holds the business rules for creating and reading
 * organizations. Depends only on the repository port, not on infrastructure.
 */
export class OrganizationService {
  constructor(private readonly repository: OrganizationRepository) {}

  async createOrganization(
    input: CreateOrganizationInput,
  ): Promise<Organization> {
    if (await this.repository.isSlugTaken(input.slug)) {
      throw new SlugAlreadyTakenError(input.slug);
    }
    // The creator always becomes the owner.
    return this.repository.createWithOwner(input);
  }

  async getOrganizationsForUser(userId: UserId): Promise<Organization[]> {
    return this.repository.findByUser(userId);
  }
}
