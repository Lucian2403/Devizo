export class ProfessionalRuleDefinitionValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "ProfessionalRuleDefinitionValidationError";
  }
}
