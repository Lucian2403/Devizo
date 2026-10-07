export class NormativeGovernanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NormativeGovernanceValidationError";
  }
}
