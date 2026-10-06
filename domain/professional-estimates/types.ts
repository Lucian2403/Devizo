/**
 * Professional resource-based estimate domain.
 *
 * These concepts deliberately do not reuse the commercial Quote/Catalog types.
 * Work, norm, resource and resource price are separate identities.
 */

export const PROFESSIONAL_RESOURCE_TYPES = [
  "labor",
  "material",
  "machinery",
  "transport",
  "energy",
  "other",
] as const;
export type ProfessionalResourceType =
  (typeof PROFESSIONAL_RESOURCE_TYPES)[number];

export const NORMATIVE_SOURCE_TYPES = [
  "normative_document",
  "norm_collection",
  "price_catalog",
  "legislation",
  "official_guidance",
  "company_custom",
  "import",
] as const;
export type NormativeSourceType = (typeof NORMATIVE_SOURCE_TYPES)[number];

export const OFFICIAL_SOURCE_STATUSES = [
  "draft",
  "consultation",
  "approved",
  "in_force",
  "superseded",
  "repealed",
  "unknown",
] as const;
export type OfficialSourceStatus = (typeof OFFICIAL_SOURCE_STATUSES)[number];

export const SOURCE_VERIFICATION_STATUSES = [
  "never",
  "success",
  "error",
] as const;
export type SourceVerificationStatus =
  (typeof SOURCE_VERIFICATION_STATUSES)[number];

export const NORMATIVE_UPDATE_TYPES = [
  "source_page_changed",
  "amendment",
  "replacement",
  "status_change",
  "price_catalog_update",
  "other",
] as const;
export type NormativeUpdateType = (typeof NORMATIVE_UPDATE_TYPES)[number];

export const NORMATIVE_REVIEW_STATUSES = [
  "detected",
  "reviewed",
  "dismissed",
] as const;
export type NormativeReviewStatus =
  (typeof NORMATIVE_REVIEW_STATUSES)[number];

export const NORMATIVE_UPDATE_REVIEW_DECISIONS = [
  "reviewed_no_action",
  "dismissed",
  "requires_normative_version",
  "requires_metadata_update",
  "requires_follow_up",
] as const;
export type NormativeUpdateReviewDecision =
  (typeof NORMATIVE_UPDATE_REVIEW_DECISIONS)[number];

export const NORMATIVE_APPLICABILITY_DECISIONS = [
  "applicable",
  "not_applicable",
  "deferred",
  "unknown",
] as const;
export type NormativeApplicabilityDecision =
  (typeof NORMATIVE_APPLICABILITY_DECISIONS)[number];

export const NORMATIVE_SOURCE_RELATION_TYPES = [
  "amends",
  "replaces",
  "supersedes",
  "supplements",
  "corrigendum_to",
  "related_to",
] as const;
export type NormativeSourceRelationType =
  (typeof NORMATIVE_SOURCE_RELATION_TYPES)[number];

export const NORMATIVE_VERSION_PUBLICATION_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "published",
] as const;
export type NormativeVersionPublicationStatus =
  (typeof NORMATIVE_VERSION_PUBLICATION_STATUSES)[number];

export const CALCULATION_RULE_TYPES = [
  "coefficient",
  "overhead",
  "estimated_profit",
  "transport",
  "procurement_storage",
  "temporary_works",
  "winter_conditions",
  "other",
] as const;
export type CalculationRuleType = (typeof CALCULATION_RULE_TYPES)[number];

export const CALCULATION_RULE_BASES = [
  "direct_cost",
  "labor_cost",
  "material_cost",
  "machinery_cost",
  "wages",
  "resource_cost",
  "custom",
] as const;
export type CalculationRuleBasis = (typeof CALCULATION_RULE_BASES)[number];

export type ConstructionObjectId = string;
export type WorkQuantityListId = string;
export type WorkQuantityItemId = string;
export type NormativeSourceId = string;
export type EstimateNormId = string;
export type EstimateNormVersionId = string;
export type ProfessionalResourceId = string;
export type ResourcePriceId = string;
export type CalculationContextId = string;
export type NormApplicationId = string;
export type CalculationRuleId = string;

/**
 * Resource-method basis:
 *
 * resourceQuantity =
 *   workQuantity / normBasisQuantity
 *   × normativeConsumption
 *   × normApplicationCoefficient
 *
 * Monetary values are introduced only by ResourcePrice and deterministic
 * calculation rules. There is intentionally no manually-entered professional
 * unit-price field in this domain.
 */
export interface ResourceMethodInputs {
  workQuantity: string;
  normBasisQuantity: string;
  normativeConsumption: string;
  normApplicationCoefficient: string;
}
