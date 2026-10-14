"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { NormativeGovernanceValidationError } from "@/domain/professional-estimates/normative-governance.error";
import { OfficialRulePackError } from "@/domain/professional-estimates/official-rule-packs/official-rule-pack.error";
import { ProfessionalRuleDefinitionValidationError } from "@/domain/professional-estimates/professional-rule-definitions.error";
import {
  calculateCpL0107Preview,
  CpL0107PreviewValidationError,
  CP_L_01_07_PREVIEW_CATEGORIES,
  type CpL0107PreviewResult,
} from "@/domain/professional-estimates/cp-l-01-07-preview";
import {
  CP_L_01_07_2012_SOURCE_CODE,
  CP_L_01_07_2012_SOURCE_EDITION,
} from "@/domain/professional-estimates/official-rule-packs/cp-l-01-07-2012";
import {
  CostStackValidationError,
  ResourceCalculationError,
  RuleResolutionValidationError,
} from "@/domain/professional-estimates/calculation";
import type { GovernanceFormState } from "./governance-form";
import {
  getCpL010720112RulePackInstaller,
  getNormativeGovernanceService,
  getNormativeIntelligenceService,
  getProfessionalRuleDefinitionService,
} from "@/server/container";
import {
  NORMATIVE_APPLICABILITY_DECISIONS,
  NORMATIVE_SOURCE_RELATION_TYPES,
  NORMATIVE_UPDATE_REVIEW_DECISIONS,
} from "@/domain/professional-estimates/types";
import type {
  NormativeApplicabilityDecision,
  NormativeSourceRelationType,
  NormativeUpdateReviewDecision,
} from "@/domain/professional-estimates/types";

function requiredField(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string" || value.trim() === "") {
    throw new NormativeGovernanceValidationError(`Câmpul «${name}» este obligatoriu.`);
  }
  return value.trim();
}

function optionalField(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new NormativeGovernanceValidationError(`Câmpul «${name}» are un format invalid.`);
  }
  return value.trim() || null;
}

function uuidField(formData: FormData, name: string): string {
  const value = requiredField(formData, name);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new NormativeGovernanceValidationError(`Câmpul «${name}» nu este un identificator valid.`);
  }
  return value;
}

function enumField<const T extends readonly string[]>(
  formData: FormData,
  name: string,
  values: T,
): T[number] {
  const value = requiredField(formData, name);
  if (!values.some((allowed) => allowed === value)) {
    throw new NormativeGovernanceValidationError(`Câmpul «${name}» are o valoare invalidă.`);
  }
  return value as T[number];
}

export async function bootstrapMoldovaSources(): Promise<void> {
  const { org } = await requireCurrentOrg();
  await getNormativeIntelligenceService().bootstrapMoldovaBaseline(org.id);
  revalidatePath("/normative");
}

export async function verifyNormativeSources(): Promise<void> {
  const { org } = await requireCurrentOrg();
  await getNormativeIntelligenceService().verifyOrganization(org.id);
  revalidatePath("/normative");
}

async function saveReview(formData: FormData): Promise<void> {
  const { org, userId } = await requireCurrentOrg();
  await getNormativeGovernanceService().reviewUpdate({
    organizationId: org.id,
    reviewerUserId: userId,
    updateId: uuidField(formData, "updateId"),
    decision: enumField(
      formData,
      "decision",
      NORMATIVE_UPDATE_REVIEW_DECISIONS,
    ) as NormativeUpdateReviewDecision,
    note: optionalField(formData, "note"),
  });
  revalidatePath("/normative");
}

async function saveApplicability(
  formData: FormData,
): Promise<void> {
  const { org, userId } = await requireCurrentOrg();
  await getNormativeGovernanceService().decideApplicability({
    organizationId: org.id,
    decidedByUserId: userId,
    sourceId: uuidField(formData, "sourceId"),
    decision: enumField(
      formData,
      "decision",
      NORMATIVE_APPLICABILITY_DECISIONS,
    ) as NormativeApplicabilityDecision,
    applicableFrom: optionalField(formData, "applicableFrom"),
    applicableUntil: optionalField(formData, "applicableUntil"),
    basisNote: requiredField(formData, "basisNote"),
    evidenceUri: optionalField(formData, "evidenceUri"),
    triggeringUpdateId: optionalField(formData, "triggeringUpdateId")
      ? uuidField(formData, "triggeringUpdateId")
      : null,
  });
  revalidatePath("/normative");
}

async function saveRelation(
  formData: FormData,
): Promise<void> {
  const { org, userId } = await requireCurrentOrg();
  await getNormativeGovernanceService().relateSources({
    organizationId: org.id,
    createdByUserId: userId,
    fromSourceId: uuidField(formData, "fromSourceId"),
    toSourceId: uuidField(formData, "toSourceId"),
    relationType: enumField(
      formData,
      "relationType",
      NORMATIVE_SOURCE_RELATION_TYPES,
    ) as NormativeSourceRelationType,
    effectiveDate: optionalField(formData, "effectiveDate"),
    evidenceUri: optionalField(formData, "evidenceUri"),
    note: optionalField(formData, "note"),
  });
  revalidatePath("/normative");
}

async function submitGovernance(
  save: (data: FormData) => Promise<void>,
  data: FormData,
): Promise<GovernanceFormState> {
  try {
    await save(data);
    return { success: true };
  } catch (error) {
    if (error instanceof NormativeGovernanceValidationError) {
      return { error: error.message };
    }
    throw error;
  }
}

export async function reviewNormativeUpdate(
  _state: GovernanceFormState,
  data: FormData,
): Promise<GovernanceFormState> {
  return submitGovernance(saveReview, data);
}

export async function decideNormativeApplicability(
  _state: GovernanceFormState,
  data: FormData,
): Promise<GovernanceFormState> {
  return submitGovernance(saveApplicability, data);
}

export async function relateNormativeSources(
  _state: GovernanceFormState,
  data: FormData,
): Promise<GovernanceFormState> {
  return submitGovernance(saveRelation, data);
}

export type RulePackFormState =
  | { error: string }
  | { created: number; reused: number }
  | null;

export async function installCpL010720112RulePack(
  _state: RulePackFormState,
  data: FormData,
): Promise<RulePackFormState> {
  const { org } = await requireCurrentOrg();
  try {
    const result = await getCpL010720112RulePackInstaller().install({
      organizationId: org.id,
      sourceId: uuidField(data, "sourceId"),
      applicabilityDecisionId: uuidField(data, "applicabilityDecisionId"),
    });
    const created = result.definitions.filter((entry) => !entry.reused).length;
    const reused = result.definitions.filter((entry) => entry.reused).length;
    revalidatePath("/normative");
    return { created, reused };
  } catch (error) {
    if (
      error instanceof OfficialRulePackError ||
      error instanceof ProfessionalRuleDefinitionValidationError ||
      error instanceof NormativeGovernanceValidationError
    ) {
      return { error: error.message };
    }
    throw error;
  }
}

export type CpL0107PreviewFormState =
  | { error: string }
  | { result: CpL0107PreviewResult }
  | null;

export async function verifyCpL010720112Calculation(
  _state: CpL0107PreviewFormState,
  data: FormData,
): Promise<CpL0107PreviewFormState> {
  const { org } = await requireCurrentOrg();
  try {
    const sourceId = uuidField(data, "sourceId");
    const source = await getNormativeIntelligenceService().getSource(
      org.id,
      sourceId,
    );
    if (!source) {
      throw new OfficialRulePackError(
        "source_not_found",
        "Sursa normativă nu a fost găsită pentru compania curentă.",
      );
    }
    if (
      source.code !== CP_L_01_07_2012_SOURCE_CODE ||
      source.edition !== CP_L_01_07_2012_SOURCE_EDITION
    ) {
      throw new OfficialRulePackError(
        "source_code_mismatch",
        "Verificarea calculului este disponibilă numai pentru sursa CP L.01.07-2012, ediția 2012.",
      );
    }
    const result = await calculateCpL0107Preview(
      getProfessionalRuleDefinitionService(),
      {
        organizationId: org.id,
        sourceId,
        valuationDate: requiredField(data, "valuationDate"),
        category: enumField(data, "category", CP_L_01_07_PREVIEW_CATEGORIES),
        materialBase: requiredField(data, "materialBase"),
      },
    );
    return { result };
  } catch (error) {
    if (
      error instanceof OfficialRulePackError ||
      error instanceof NormativeGovernanceValidationError ||
      error instanceof ProfessionalRuleDefinitionValidationError ||
      error instanceof RuleResolutionValidationError ||
      error instanceof ResourceCalculationError ||
      error instanceof CostStackValidationError ||
      error instanceof CpL0107PreviewValidationError
    ) {
      return { error: error.message };
    }
    throw error;
  }
}
