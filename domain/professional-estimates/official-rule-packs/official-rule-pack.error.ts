export type OfficialRulePackErrorCode =
  | "source_not_found"
  | "source_organization_mismatch"
  | "source_code_mismatch"
  | "source_edition_mismatch"
  | "conflicting_existing_definition"
  | "duplicate_existing_definition";

/**
 * Explicit, typed failure for official rule-pack installation. A pack is
 * production normative data, so every rejection must remain visible rather than
 * silently materializing or mutating a definition.
 */
export class OfficialRulePackError extends Error {
  constructor(
    readonly code: OfficialRulePackErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "OfficialRulePackError";
  }
}
