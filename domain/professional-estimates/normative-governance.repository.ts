import type {
  NormativeApplicabilityDecision,
  NormativeSourceRelationType,
  NormativeUpdateReviewDecision,
} from "./types";

export interface NormativeUpdateReviewRecord {
  id: string;
  organizationId: string;
  updateId: string;
  sourceId: string;
  decision: NormativeUpdateReviewDecision;
  note: string | null;
  reviewerUserId: string;
  reviewerName: string | null;
  reviewedAt: Date;
  sourceCode: string;
  sourceEdition: string;
  sourceAuthority: string | null;
  officialUri: string | null;
  publicationDate: string | null;
  effectiveDate: string | null;
  previousFingerprint: string | null;
  detectedFingerprint: string;
}

export interface NormativeApplicabilityRecord {
  id: string;
  organizationId: string;
  sourceId: string;
  revision: number;
  decision: NormativeApplicabilityDecision;
  applicableFrom: string | null;
  applicableUntil: string | null;
  decidedAt: Date;
  decidedByUserId: string;
  decidedByName: string | null;
  basisNote: string;
  evidenceUri: string | null;
  sourceCode: string;
  sourceEdition: string;
  sourceAuthority: string | null;
  sourceUri: string | null;
  sourceFingerprint: string | null;
  officialStatus: string;
  triggeringUpdateId: string | null;
}

export interface NormativeSourceRelationRecord {
  id: string;
  organizationId: string;
  fromSourceId: string;
  toSourceId: string;
  fromSourceCode: string;
  fromSourceEdition: string;
  toSourceCode: string;
  toSourceEdition: string;
  relationType: NormativeSourceRelationType;
  effectiveDate: string | null;
  evidenceUri: string | null;
  note: string | null;
  createdAt: Date;
  createdByUserId: string;
  createdByName: string | null;
}

export interface CreateNormativeUpdateReviewInput {
  organizationId: string;
  reviewerUserId: string;
  updateId: string;
  decision: NormativeUpdateReviewDecision;
  note?: string | null;
}

export interface CreateNormativeApplicabilityInput {
  organizationId: string;
  decidedByUserId: string;
  sourceId: string;
  decision: NormativeApplicabilityDecision;
  applicableFrom?: string | null;
  applicableUntil?: string | null;
  basisNote: string;
  evidenceUri?: string | null;
  triggeringUpdateId?: string | null;
}

export interface CreateNormativeSourceRelationInput {
  organizationId: string;
  createdByUserId: string;
  fromSourceId: string;
  toSourceId: string;
  relationType: NormativeSourceRelationType;
  effectiveDate?: string | null;
  evidenceUri?: string | null;
  note?: string | null;
}

export interface NormativeGovernanceRepository {
  listUpdateReviews(
    organizationId: string,
  ): Promise<NormativeUpdateReviewRecord[]>;

  listApplicabilityDecisions(
    organizationId: string,
  ): Promise<NormativeApplicabilityRecord[]>;

  listSourceRelations(
    organizationId: string,
  ): Promise<NormativeSourceRelationRecord[]>;

  createUpdateReview(
    input: CreateNormativeUpdateReviewInput,
  ): Promise<void>;

  createApplicabilityDecision(
    input: CreateNormativeApplicabilityInput,
  ): Promise<void>;

  createSourceRelation(
    input: CreateNormativeSourceRelationInput,
  ): Promise<void>;
}
