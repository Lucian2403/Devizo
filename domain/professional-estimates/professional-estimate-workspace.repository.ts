import type {
  OrganizationId,
  SupportedCurrency,
} from "@/domain/shared/types";

export interface ProfessionalEstimateData {
  name: string;
  objectName: string;
  listName: string;
  valuationDate: string;
  currency: string;
  objectCode?: string;
  objectAddress?: string;
  objectDescription?: string;
  sourceReference?: string;
  sourceDate?: string;
}

export type ValidatedProfessionalEstimateData = Omit<
  ProfessionalEstimateData,
  "currency"
> & { currency: SupportedCurrency };

export class DuplicateWorkPositionError extends Error {
  constructor(positionNumber: number) {
    super(`Poziția ${positionNumber} există deja în această listă.`);
    this.name = "DuplicateWorkPositionError";
  }
}

export interface WorkQuantityItemData {
  positionNumber: number;
  code?: string;
  description: string;
  unit: string;
  quantity: string;
  notes?: string;
}

export type WorkQuantityItemUpdate = Omit<
  WorkQuantityItemData,
  "positionNumber"
>;

export interface ProfessionalEstimateWorkspace {
  context: {
    id: string;
    organizationId: OrganizationId;
    name: string;
    valuationDate: string;
    currency: SupportedCurrency;
    method: "resource";
  };
  constructionObject: {
    id: string;
    name: string;
    code: string | null;
    address: string | null;
    description: string | null;
  };
  workQuantityList: {
    id: string;
    name: string;
    revision: number;
    sourceReference: string | null;
    sourceDate: string | null;
    description: string | null;
  };
  items: WorkQuantityItem[];
}

export interface WorkQuantityItem {
  id: string;
  organizationId: OrganizationId;
  workQuantityListId: string;
  positionNumber: number;
  code: string | null;
  description: string;
  unit: string;
  quantity: string;
  notes: string | null;
}

export interface ProfessionalEstimateSummary {
  context: ProfessionalEstimateWorkspace["context"];
  constructionObject: ProfessionalEstimateWorkspace["constructionObject"];
  workQuantityList: ProfessionalEstimateWorkspace["workQuantityList"];
  itemCount: number;
}

export interface ProfessionalEstimateWorkspaceRepository {
  listProfessionalEstimates(
    organizationId: OrganizationId,
  ): Promise<ProfessionalEstimateSummary[]>;
  getProfessionalEstimate(
    organizationId: OrganizationId,
    calculationContextId: string,
  ): Promise<ProfessionalEstimateWorkspace | null>;
  createProfessionalEstimate(
    organizationId: OrganizationId,
    data: ValidatedProfessionalEstimateData,
  ): Promise<string>;
  createWorkQuantityItem(
    organizationId: OrganizationId,
    calculationContextId: string,
    data: WorkQuantityItemData,
  ): Promise<WorkQuantityItem | null>;
  updateWorkQuantityItem(
    organizationId: OrganizationId,
    calculationContextId: string,
    itemId: string,
    data: WorkQuantityItemUpdate,
  ): Promise<WorkQuantityItem | null>;
}
