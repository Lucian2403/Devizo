import type { OrganizationId, SupportedCurrency } from "@/domain/shared/types";

export interface ProfessionalGeneralEstimateData {
  name: string;
  code?: string;
  valuationDate: string;
  currency: SupportedCurrency;
  notes?: string;
}

export interface ProfessionalGeneralEstimateRecord
  extends Omit<ProfessionalGeneralEstimateData, "code" | "notes"> {
  id: string;
  organizationId: OrganizationId;
  code: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfessionalGeneralEstimateEntryRecord {
  id: string;
  organizationId: OrganizationId;
  generalEstimateId: string;
  objectEstimateId: string;
  chapterNumber: number;
  chapterPositionNumber: number;
  included: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfessionalGeneralEstimateSummaryRecord {
  estimate: ProfessionalGeneralEstimateRecord;
  entries: ProfessionalGeneralEstimateEntryRecord[];
}

export interface ProfessionalGeneralEstimateRepository {
  list(
    organizationId: OrganizationId,
  ): Promise<ProfessionalGeneralEstimateSummaryRecord[]>;
  get(
    organizationId: OrganizationId,
    generalEstimateId: string,
  ): Promise<ProfessionalGeneralEstimateSummaryRecord | null>;
  create(
    organizationId: OrganizationId,
    data: ProfessionalGeneralEstimateData,
  ): Promise<string>;
  addEntry(
    organizationId: OrganizationId,
    generalEstimateId: string,
    objectEstimateId: string,
    chapterNumber: number,
  ): Promise<boolean>;
  updateEntry(
    organizationId: OrganizationId,
    generalEstimateId: string,
    entryId: string,
    data: { included?: boolean; chapterNumber?: number },
  ): Promise<boolean>;
}
