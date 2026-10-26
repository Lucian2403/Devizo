import type {
  CreateProfessionalGeneralRuleDefinitionInput,
  ProfessionalGeneralRuleDefinitionRecord,
  ProfessionalTemporaryWorksRepository,
} from "./professional-temporary-works.repository";

export type WinterRuleDefinitionRecord = Omit<
  ProfessionalGeneralRuleDefinitionRecord,
  "component"
> & { component: "winter_conditions" };

export type CreateWinterRuleDefinitionInput = Omit<
  CreateProfessionalGeneralRuleDefinitionInput,
  "component"
> & { component: "winter_conditions" };

/**
 * Reuses the normative-governance source/decision records and the existing
 * general-rule table. All writes remain tenant and component scoped.
 */
export interface ProfessionalWinterRulesRepository extends Pick<
  ProfessionalTemporaryWorksRepository,
  "findSourceByIdentity" | "getSource" | "listApplicabilityDecisions" |
  "getApplicabilityDecision"
> {
  listRuleDefinitions(
    organizationId: string,
    sourceId: string,
  ): Promise<WinterRuleDefinitionRecord[]>;
  createRuleDefinitions(
    rules: readonly CreateWinterRuleDefinitionInput[],
  ): Promise<WinterRuleDefinitionRecord[]>;
  rebindRuleDefinitionsApplicability(
    organizationId: string,
    sourceId: string,
    ruleIds: readonly string[],
    applicabilityDecisionId: string,
  ): Promise<WinterRuleDefinitionRecord[]>;
}
