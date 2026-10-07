"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { NormativeGovernanceValidationError } from "@/domain/professional-estimates/normative-governance.error";
import type { GovernanceFormState } from "./governance-form";
import {
  getNormativeGovernanceService,
  getNormativeIntelligenceService,
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
