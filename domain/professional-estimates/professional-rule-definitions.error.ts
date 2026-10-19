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

export class CompanyCalculationRuleSourceConflictError extends Error {
  constructor() {
    super(
      "Sursa rezervată pentru regulile interne de calcul are date incompatibile. Contactați administratorul companiei.",
    );
    this.name = "CompanyCalculationRuleSourceConflictError";
  }
}
