import type {
  NormativeReviewStatus,
  NormativeSourceType,
  NormativeUpdateType,
  OfficialSourceStatus,
  SourceVerificationStatus,
} from "./types";

export interface NormativeSourceUsage {
  normVersions: number;
  resources: number;
  resourcePrices: number;
  calculationRules: number;
}

export interface NormativeSourceRecord {
  id: string;
  organizationId: string;
  code: string;
  title: string;
  edition: string;
  sourceType: NormativeSourceType;
  publisher: string | null;
  jurisdiction: string;
  authority: string | null;
  sourceUri: string | null;
  approvalDate: string | null;
  publicationDate: string | null;
  effectiveDate: string | null;
  validFrom: string | null;
  validTo: string | null;
  status: "draft" | "active" | "superseded";
  officialStatus: OfficialSourceStatus;
  monitoringEnabled: boolean;
  lastVerifiedAt: Date | null;
  lastVerificationStatus: SourceVerificationStatus;
  lastVerificationError: string | null;
  contentFingerprint: string | null;
  metadata: Record<string, unknown>;
}

export interface NormativeSourceOverview extends NormativeSourceRecord {
  usage: NormativeSourceUsage;
}

export interface NormativeUpdateRecord {
  id: string;
  organizationId: string;
  sourceId: string;
  sourceCode: string;
  sourceTitle: string;
  updateType: NormativeUpdateType;
  reviewStatus: NormativeReviewStatus;
  title: string;
  summary: string | null;
  impactSummary: string | null;
  officialUri: string | null;
  publicationDate: string | null;
  effectiveDate: string | null;
  eventFingerprint: string;
  detectedAt: Date;
  reviewedAt: Date | null;
  metadata: Record<string, unknown>;
}

export interface NormativeSourceUpsertInput {
  code: string;
  title: string;
  edition: string;
  sourceType: NormativeSourceType;
  publisher?: string | null;
  jurisdiction?: string;
  authority?: string | null;
  sourceUri?: string | null;
  approvalDate?: string | null;
  publicationDate?: string | null;
  effectiveDate?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  status?: "draft" | "active" | "superseded";
  officialStatus?: OfficialSourceStatus;
  monitoringEnabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SourceVerificationResult {
  checkedAt: Date;
  status: "success" | "error";
  fingerprint?: string;
  error?: string;
}

export interface DetectedNormativeUpdateInput {
  organizationId: string;
  sourceId: string;
  updateType: NormativeUpdateType;
  title: string;
  summary?: string | null;
  impactSummary?: string | null;
  officialUri?: string | null;
  publicationDate?: string | null;
  effectiveDate?: string | null;
  eventFingerprint: string;
  metadata?: Record<string, unknown>;
}

export interface NormativeIntelligenceRepository {
  listSources(
    organizationId: string,
  ): Promise<NormativeSourceOverview[]>;

  listUpdates(
    organizationId: string,
    limit?: number,
  ): Promise<NormativeUpdateRecord[]>;

  upsertSources(
    organizationId: string,
    sources: NormativeSourceUpsertInput[],
  ): Promise<number>;

  listMonitoredSources(
    organizationId?: string,
  ): Promise<NormativeSourceRecord[]>;

  getUsage(
    organizationId: string,
    sourceId: string,
  ): Promise<NormativeSourceUsage>;

  saveVerification(
    organizationId: string,
    sourceId: string,
    result: SourceVerificationResult,
  ): Promise<void>;

  recordDetectedUpdate(
    input: DetectedNormativeUpdateInput,
  ): Promise<void>;

  setUpdateReviewStatus(
    organizationId: string,
    updateId: string,
    status: Extract<NormativeReviewStatus, "reviewed" | "dismissed">,
  ): Promise<void>;
}
