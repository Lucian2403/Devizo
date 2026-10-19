import type { OrganizationId } from "@/domain/shared/types";
import type { ProfessionalResourceType } from "./types";
import type { ProcurementCategory } from "./procurement-semantics";

export interface CreateInternalNormData {
  code: string;
  name: string;
  versionLabel: string;
  basisQuantity: string;
  basisUnit: string;
  category?: string;
  description?: string;
  validFrom?: string;
  validTo?: string;
}

export interface InternalNormResourceData {
  code?: string;
  name: string;
  resourceType: ProfessionalResourceType;
  unit: string;
  quantityPerNormBasis: string;
}

export interface NormVersionSummary {
  id: string;
  estimateNormId: string;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  versionLabel: string;
  basisQuantity: string;
  basisUnit: string;
  method: string;
  sourceType: string;
  sourceTitle: string;
  sourceCode: string;
  officialStatus: string;
  validFrom: string | null;
  validTo: string | null;
  publicationStatus: string;
  resourceCount: number;
}

export interface NormResourceConsumption {
  id: string;
  positionNumber: number;
  resourceId: string;
  code: string | null;
  name: string;
  resourceType: ProfessionalResourceType;
  procurementCategory: ProcurementCategory | null;
  unit: string;
  quantityPerNormBasis: string;
}

export interface NormVersionDetail {
  norm: NormVersionSummary;
  resources: NormResourceConsumption[];
}

export interface AppliedNorm {
  id: string;
  estimateNormVersionId: string;
  applicationOrder: number;
  applicationCoefficient: string;
  norm: NormVersionDetail;
}

export interface NormWorkspaceItem {
  id: string;
  unit: string;
  quantity: string;
  application: AppliedNorm | null;
}

export interface NormWorkspace {
  valuationDate: string;
  items: NormWorkspaceItem[];
  normVersions: NormVersionDetail[];
}

export class DuplicateInternalNormError extends Error {
  constructor() {
    super("Această versiune a normei există deja în biblioteca companiei.");
    this.name = "DuplicateInternalNormError";
  }
}

export class InternalNormIdentityConflictError extends Error {
  constructor() {
    super(
      "Codul normei există deja cu alte date de identificare. Folosiți denumirea și categoria existente.",
    );
    this.name = "InternalNormIdentityConflictError";
  }
}

export class NormVersionPublicationError extends Error {
  constructor(message = "Versiunea nu poate fi publicată în starea curentă.") {
    super(message);
    this.name = "NormVersionPublicationError";
  }
}

export class DuplicateNormResourceError extends Error {
  constructor() {
    super("Codul resursei există deja cu alte caracteristici.");
    this.name = "DuplicateNormResourceError";
  }
}

export class NormLibraryRecordNotFoundError extends Error {
  constructor() {
    super("Norma profesională nu a fost găsită.");
    this.name = "NormLibraryRecordNotFoundError";
  }
}

export class InternalNormSourceConflictError extends Error {
  constructor() {
    super(
      "Sursa dedicată normelor interne are o configurație incompatibilă. Contactați administratorul.",
    );
    this.name = "InternalNormSourceConflictError";
  }
}

export class NormAssignmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NormAssignmentValidationError";
  }
}

export interface ProfessionalNormLibraryRepository {
  listNormVersions(organizationId: OrganizationId): Promise<NormVersionSummary[]>;
  getNormVersion(
    organizationId: OrganizationId,
    estimateNormVersionId: string,
  ): Promise<NormVersionDetail | null>;
  createInternalNorm(
    organizationId: OrganizationId,
    data: CreateInternalNormData,
  ): Promise<string>;
  addInternalNormResource(
    organizationId: OrganizationId,
    estimateNormVersionId: string,
    data: InternalNormResourceData,
  ): Promise<void>;
  publishInternalNormVersion(
    organizationId: OrganizationId,
    estimateNormVersionId: string,
  ): Promise<void>;
  getNormWorkspace(
    organizationId: OrganizationId,
    calculationContextId: string,
  ): Promise<NormWorkspace | null>;
  getWorkItemNormAssignmentStatus(
    organizationId: OrganizationId,
    calculationContextId: string,
    workQuantityItemId: string,
  ): Promise<{ unit: string; hasNormApplication: boolean } | null>;
  createNormApplication(
    organizationId: OrganizationId,
    calculationContextId: string,
    workQuantityItemId: string,
    estimateNormVersionId: string,
  ): Promise<void>;
}
