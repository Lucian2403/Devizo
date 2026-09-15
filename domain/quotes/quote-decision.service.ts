import type {
  OrganizationId,
  QuoteVersionId,
  UserId,
} from "@/domain/shared/types";

export const QUOTE_DECISIONS = ["accepted", "rejected"] as const;
export type QuoteDecision = (typeof QUOTE_DECISIONS)[number];

export type QuoteDecisionWriteResult =
  | "updated"
  | "not_found"
  | "invalid_status";

export interface QuoteDecisionRepository {
  applyDecision(
    organizationId: OrganizationId,
    versionId: QuoteVersionId,
    actorUserId: UserId,
    decision: QuoteDecision,
  ): Promise<QuoteDecisionWriteResult>;
}

export class QuoteDecisionVersionNotFoundError extends Error {
  constructor() {
    super("Quote version not found.");
    this.name = "QuoteDecisionVersionNotFoundError";
  }
}

export class QuoteDecisionNotAllowedError extends Error {
  constructor() {
    super("Only sent quote versions can be accepted or rejected.");
    this.name = "QuoteDecisionNotAllowedError";
  }
}

/**
 * Handles the customer decision on an already-sent commercial quote version.
 * The repository performs the status change and audit write atomically.
 */
export class QuoteDecisionService {
  constructor(private readonly repository: QuoteDecisionRepository) {}

  async decide(
    organizationId: OrganizationId,
    versionId: QuoteVersionId,
    actorUserId: UserId,
    decision: QuoteDecision,
  ): Promise<void> {
    const result = await this.repository.applyDecision(
      organizationId,
      versionId,
      actorUserId,
      decision,
    );

    if (result === "not_found") {
      throw new QuoteDecisionVersionNotFoundError();
    }
    if (result === "invalid_status") {
      throw new QuoteDecisionNotAllowedError();
    }
  }
}
