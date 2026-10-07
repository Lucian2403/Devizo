import {
  NORMATIVE_APPLICABILITY_DECISIONS,
  NORMATIVE_SOURCE_RELATION_TYPES,
  NORMATIVE_UPDATE_REVIEW_DECISIONS,
} from "./types";
import { NormativeGovernanceValidationError } from "./normative-governance.error";
import type {
  CreateNormativeApplicabilityInput,
  CreateNormativeSourceRelationInput,
  CreateNormativeUpdateReviewInput,
  NormativeApplicabilityRecord,
  NormativeGovernanceRepository,
  NormativeSourceRelationRecord,
  NormativeUpdateReviewRecord,
} from "./normative-governance.repository";

export interface NormativeGovernanceOverview {
  reviews: NormativeUpdateReviewRecord[];
  applicability: NormativeApplicabilityRecord[];
  relations: NormativeSourceRelationRecord[];
}

function requiredText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized) throw new NormativeGovernanceValidationError(`${field} este obligatoriu.`);
  if (normalized.length > maxLength) {
    throw new NormativeGovernanceValidationError(`${field} depășește limita de ${maxLength} caractere.`);
  }
  return normalized;
}

function optionalText(
  value: string | null | undefined,
  field: string,
  maxLength: number,
): string | null {
  if (value == null || value.trim() === "") return null;
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new NormativeGovernanceValidationError(`${field} depășește limita de ${maxLength} caractere.`);
  }
  return normalized;
}

function optionalDate(value: string | null | undefined, field: string): string | null {
  if (value == null || value === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new NormativeGovernanceValidationError(`${field} trebuie să fie o dată calendaristică validă.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new NormativeGovernanceValidationError(`${field} trebuie să fie o dată calendaristică validă.`);
  }
  return value;
}

function optionalHttpsUri(
  value: string | null | undefined,
  field: string,
): string | null {
  const normalized = optionalText(value, field, 2048);
  if (!normalized) return null;
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new NormativeGovernanceValidationError(`${field} trebuie să fie un URL valid.`);
  }
  if (url.protocol !== "https:") {
    throw new NormativeGovernanceValidationError(`${field} trebuie să folosească HTTPS.`);
  }
  return normalized;
}

function assertEnum<T extends string>(
  value: string,
  values: readonly T[],
  field: string,
): asserts value is T {
  if (!values.includes(value as T)) {
    throw new NormativeGovernanceValidationError(`${field} nu este o valoare permisă.`);
  }
}

export class NormativeGovernanceService {
  constructor(
    private readonly governanceRepository: NormativeGovernanceRepository,
  ) {}

  async getOverview(organizationId: string): Promise<NormativeGovernanceOverview> {
    const [reviews, applicability, relations] = await Promise.all([
      this.governanceRepository.listUpdateReviews(organizationId),
      this.governanceRepository.listApplicabilityDecisions(organizationId),
      this.governanceRepository.listSourceRelations(organizationId),
    ]);
    return { reviews, applicability, relations };
  }

  async reviewUpdate(
    input: CreateNormativeUpdateReviewInput,
  ): Promise<void> {
    assertEnum(
      input.decision,
      NORMATIVE_UPDATE_REVIEW_DECISIONS,
      "Decizia de analiză",
    );
    const note = optionalText(input.note, "Nota de analiză", 4000);
    await this.governanceRepository.createUpdateReview({ ...input, note });
  }

  async decideApplicability(
    input: CreateNormativeApplicabilityInput,
  ): Promise<void> {
    assertEnum(
      input.decision,
      NORMATIVE_APPLICABILITY_DECISIONS,
      "Decizia de aplicabilitate",
    );
    const applicableFrom = optionalDate(input.applicableFrom, "Aplicabilă de la");
    const applicableUntil = optionalDate(
      input.applicableUntil,
      "Aplicabilă până la",
    );
    if (
      applicableFrom &&
      applicableUntil &&
      applicableUntil < applicableFrom
    ) {
      throw new NormativeGovernanceValidationError("Data de sfârșit trebuie să fie după data de început.");
    }
    if (input.decision === "applicable" && !applicableFrom) {
      throw new NormativeGovernanceValidationError(
        "Pentru o decizie «Aplicabilă» trebuie indicată data de început.",
      );
    }
    await this.governanceRepository.createApplicabilityDecision({
      ...input,
      applicableFrom,
      applicableUntil,
      basisNote: requiredText(input.basisNote, "Temeiul deciziei", 4000),
      evidenceUri: optionalHttpsUri(input.evidenceUri, "Linkul dovezii"),
    });
  }

  async relateSources(
    input: CreateNormativeSourceRelationInput,
  ): Promise<void> {
    assertEnum(
      input.relationType,
      NORMATIVE_SOURCE_RELATION_TYPES,
      "Tipul relației",
    );
    if (input.fromSourceId === input.toSourceId) {
      throw new NormativeGovernanceValidationError("O sursă normativă nu poate avea o relație cu ea însăși.");
    }
    const effectiveDate = optionalDate(input.effectiveDate, "Data relației");
    await this.governanceRepository.createSourceRelation({
      ...input,
      effectiveDate,
      evidenceUri: optionalHttpsUri(input.evidenceUri, "Linkul dovezii"),
      note: optionalText(input.note, "Nota relației", 4000),
    });
  }

}
