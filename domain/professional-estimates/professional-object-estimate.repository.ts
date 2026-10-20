import type { OrganizationId, SupportedCurrency } from "@/domain/shared/types";
import type { ProfessionalObjectEstimateCostCategory } from "./calculation";

export interface ProfessionalObjectEstimateData {
  constructionObjectId: string;
  name: string;
  code?: string;
  valuationDate: string;
  currency: SupportedCurrency;
  notes?: string;
}

export interface ProfessionalObjectEstimateRecord
  extends Omit<ProfessionalObjectEstimateData, "code" | "notes"> {
  id: string;
  organizationId: OrganizationId;
  code: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfessionalObjectEstimateEntryRecord {
  id: string;
  organizationId: OrganizationId;
  objectEstimateId: string;
  calculationContextId: string;
  positionNumber: number;
  costCategory: ProfessionalObjectEstimateCostCategory;
  included: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfessionalObjectEstimateSummaryRecord {
  estimate: ProfessionalObjectEstimateRecord;
  constructionObjectName: string;
  entries: ProfessionalObjectEstimateEntryRecord[];
}

export interface ProfessionalObjectEstimateWorkspaceRecord {
  estimate: ProfessionalObjectEstimateRecord;
  constructionObjectName: string;
  entries: ProfessionalObjectEstimateEntryRecord[];
}

export interface ProfessionalObjectEstimateRepository {
  listConstructionObjects(
    organizationId: OrganizationId,
  ): Promise<Array<{ id: string; name: string; code: string | null }>>;
  constructionObjectExists(
    organizationId: OrganizationId,
    constructionObjectId: string,
  ): Promise<boolean>;
  list(organizationId: OrganizationId): Promise<ProfessionalObjectEstimateSummaryRecord[]>;
  get(
    organizationId: OrganizationId,
    objectEstimateId: string,
  ): Promise<ProfessionalObjectEstimateWorkspaceRecord | null>;
  create(
    organizationId: OrganizationId,
    data: ProfessionalObjectEstimateData,
  ): Promise<string>;
  addEntry(
    organizationId: OrganizationId,
    objectEstimateId: string,
    calculationContextId: string,
    costCategory: ProfessionalObjectEstimateCostCategory,
  ): Promise<boolean>;
  updateEntry(
    organizationId: OrganizationId,
    objectEstimateId: string,
    entryId: string,
    data: {
      included?: boolean;
      costCategory?: ProfessionalObjectEstimateCostCategory;
    },
  ): Promise<boolean>;
}
