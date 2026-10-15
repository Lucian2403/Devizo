import type { OrganizationId } from "@/domain/shared/types";
import {
  calculateResourceQuantity,
  type ResourceQuantityLine,
} from "./calculation";
import { DecimalParseError, parseDecimal } from "./calculation/decimal";
import {
  DuplicateInternalNormError,
  DuplicateNormResourceError,
  InternalNormSourceConflictError,
  NormAssignmentValidationError,
  NormLibraryRecordNotFoundError,
  type AppliedNorm,
  type CreateInternalNormData,
  type InternalNormResourceData,
  type NormResourceConsumption,
  type NormVersionDetail,
  type NormVersionSummary,
  type ProfessionalNormLibraryRepository,
} from "./professional-norm-library.repository";
import { PROFESSIONAL_RESOURCE_TYPES } from "./types";
import { isWorkspaceUuid } from "./workspace-identifiers";

export {
  DuplicateInternalNormError,
  DuplicateNormResourceError,
  InternalNormSourceConflictError,
  NormAssignmentValidationError,
  NormLibraryRecordNotFoundError,
};

export interface InternalNormFormData {
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

export interface InternalNormResourceFormData {
  code?: string;
  name: string;
  resourceType: string;
  unit: string;
  quantityPerNormBasis: string;
}

export interface CalculatedNormResource extends NormResourceConsumption {
  resourceQuantity: string;
}

export interface AppliedNormBreakdown extends Omit<AppliedNorm, "norm"> {
  norm: NormVersionDetail;
  calculatedResources: CalculatedNormResource[];
}

export interface NormAssignmentOption {
  id: string;
  code: string;
  name: string;
  versionLabel: string;
  basisQuantity: string;
  basisUnit: string;
}

export interface NormWorkspacePresentation {
  assignedByWorkItemId: Record<string, AppliedNormBreakdown>;
  eligibleByWorkItemId: Record<string, NormAssignmentOption[]>;
  assignedCount: number;
  itemCount: number;
}

export class ProfessionalNormLibraryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfessionalNormLibraryValidationError";
  }
}

function requiredText(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new ProfessionalNormLibraryValidationError(`${label} este obligatoriu.`);
  }
  if (normalized.length > 300) {
    throw new ProfessionalNormLibraryValidationError(`${label} este prea lung.`);
  }
  return normalized;
}

function optionalText(value: string | undefined, label: string): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length > 4000) {
    throw new ProfessionalNormLibraryValidationError(`${label} este prea lung.`);
  }
  return normalized;
}

function validateDecimal(
  value: string,
  label: string,
  options: { positive: boolean },
): string {
  const normalized = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    throw new ProfessionalNormLibraryValidationError(
      `${label} trebuie să fie un număr zecimal valid.`,
    );
  }

  let decimal;
  try {
    decimal = parseDecimal(normalized, label);
  } catch (error) {
    if (error instanceof DecimalParseError) {
      throw new ProfessionalNormLibraryValidationError(
        `${label} trebuie să fie un număr zecimal valid.`,
      );
    }
    throw error;
  }
  if (options.positive ? decimal.lte(0) : decimal.lt(0)) {
    throw new ProfessionalNormLibraryValidationError(
      options.positive
        ? `${label} trebuie să fie mai mare decât zero.`
        : `${label} nu poate fi negativ.`,
    );
  }

  const unsigned = normalized.replace(/^[+-]/, "");
  const [integerPart = "", fractionalPart = ""] = unsigned.split(".");
  const integerDigits = integerPart.replace(/^0+/, "") || "0";
  const significantFraction = fractionalPart.replace(/0+$/, "");
  if (integerDigits.length > 12 || significantFraction.length > 6) {
    throw new ProfessionalNormLibraryValidationError(
      `${label} poate avea maximum 12 cifre întregi și 6 zecimale.`,
    );
  }
  return normalized;
}

function validateDate(value: string | undefined, label: string): string | undefined {
  if (!value?.trim()) return undefined;
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ProfessionalNormLibraryValidationError(`${label} nu este validă.`);
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new ProfessionalNormLibraryValidationError(`${label} nu este validă.`);
  }
  return date;
}

function validateNormData(data: InternalNormFormData): CreateInternalNormData {
  const validFrom = validateDate(data.validFrom, "Data de început");
  const validTo = validateDate(data.validTo, "Data de sfârșit");
  if (validFrom && validTo && validTo < validFrom) {
    throw new ProfessionalNormLibraryValidationError(
      "Data de sfârșit nu poate preceda data de început.",
    );
  }
  return {
    code: requiredText(data.code, "Codul normei"),
    name: requiredText(data.name, "Denumirea normei"),
    versionLabel: requiredText(data.versionLabel, "Versiunea"),
    basisQuantity: validateDecimal(data.basisQuantity, "Cantitatea de bază", {
      positive: true,
    }),
    basisUnit: requiredText(data.basisUnit, "Unitatea de bază"),
    category: optionalText(data.category, "Categoria"),
    description: optionalText(data.description, "Descrierea"),
    validFrom,
    validTo,
  };
}

function validateResourceData(
  data: InternalNormResourceFormData,
): InternalNormResourceData {
  const resourceType = data.resourceType.trim();
  if (!PROFESSIONAL_RESOURCE_TYPES.some((type) => type === resourceType)) {
    throw new ProfessionalNormLibraryValidationError("Tipul resursei nu este valid.");
  }
  return {
    code: optionalText(data.code, "Codul resursei"),
    name: requiredText(data.name, "Denumirea resursei"),
    resourceType: resourceType as InternalNormResourceData["resourceType"],
    unit: requiredText(data.unit, "Unitatea resursei"),
    quantityPerNormBasis: validateDecimal(
      data.quantityPerNormBasis,
      "Consumul pe baza normei",
      { positive: false },
    ),
  };
}

function isEligibleForDate(norm: NormVersionSummary, valuationDate: string): boolean {
  return (
    norm.publicationStatus === "published" &&
    norm.method === "resource" &&
    (norm.validFrom === null || norm.validFrom <= valuationDate) &&
    (norm.validTo === null || norm.validTo >= valuationDate)
  );
}

export class ProfessionalNormLibraryService {
  constructor(private readonly repository: ProfessionalNormLibraryRepository) {}

  listNormVersions(organizationId: OrganizationId): Promise<NormVersionSummary[]> {
    return this.repository.listNormVersions(organizationId);
  }

  async getNormVersion(
    organizationId: OrganizationId,
    estimateNormVersionId: string,
  ): Promise<NormVersionDetail> {
    if (!isWorkspaceUuid(estimateNormVersionId)) {
      throw new NormLibraryRecordNotFoundError();
    }
    const norm = await this.repository.getNormVersion(
      organizationId,
      estimateNormVersionId,
    );
    if (!norm) throw new NormLibraryRecordNotFoundError();
    return norm;
  }

  createInternalNorm(
    organizationId: OrganizationId,
    data: InternalNormFormData,
  ): Promise<string> {
    return this.repository.createInternalNorm(
      organizationId,
      validateNormData(data),
    );
  }

  addInternalNormResource(
    organizationId: OrganizationId,
    estimateNormVersionId: string,
    data: InternalNormResourceFormData,
  ): Promise<void> {
    if (!isWorkspaceUuid(estimateNormVersionId)) {
      throw new NormLibraryRecordNotFoundError();
    }
    return this.repository.addInternalNormResource(
      organizationId,
      estimateNormVersionId,
      validateResourceData(data),
    );
  }

  async getNormWorkspacePresentation(
    organizationId: OrganizationId,
    calculationContextId: string,
  ): Promise<NormWorkspacePresentation> {
    if (!isWorkspaceUuid(calculationContextId)) {
      throw new NormLibraryRecordNotFoundError();
    }
    const workspace = await this.repository.getNormWorkspace(
      organizationId,
      calculationContextId,
    );
    if (!workspace) throw new NormLibraryRecordNotFoundError();
    const assignedByWorkItemId: Record<string, AppliedNormBreakdown> = {};
    const eligibleByWorkItemId: Record<string, NormAssignmentOption[]> = {};

    for (const item of workspace.items) {
      const eligible = workspace.normVersions.filter(
        ({ norm }) =>
            norm.basisUnit === item.unit &&
            isEligibleForDate(norm, workspace.valuationDate),
      );
      eligibleByWorkItemId[item.id] = eligible.map(({ norm }) => ({
        id: norm.id,
        code: norm.code,
        name: norm.name,
        versionLabel: norm.versionLabel,
        basisQuantity: norm.basisQuantity,
        basisUnit: norm.basisUnit,
      }));

      if (!item.application) continue;
      const application = item.application;
      const calculatedResources = application.norm.resources.map((resource) => {
        const quantity: ResourceQuantityLine = calculateResourceQuantity({
          estimateNormVersionId: application.norm.norm.id,
          resourceConsumptionId: resource.id,
          resourceId: resource.resourceId,
          normApplicationId: application.id,
          resourceType: resource.resourceType,
          workQuantity: item.quantity,
          normBasisQuantity: application.norm.norm.basisQuantity,
          normativeConsumption: resource.quantityPerNormBasis,
          applicationCoefficient: application.applicationCoefficient,
        });
        return { ...resource, resourceQuantity: quantity.resourceQuantity };
      });
      assignedByWorkItemId[item.id] = {
        ...application,
        calculatedResources,
      };
    }

    return {
      assignedByWorkItemId,
      eligibleByWorkItemId,
      assignedCount: Object.keys(assignedByWorkItemId).length,
      itemCount: workspace.items.length,
    };
  }

  async validateWorkItemUnitChange(
    organizationId: OrganizationId,
    calculationContextId: string,
    workQuantityItemId: string,
    unit: string,
  ): Promise<void> {
    if (
      !isWorkspaceUuid(calculationContextId) ||
      !isWorkspaceUuid(workQuantityItemId)
    ) {
      return;
    }
    const status = await this.repository.getWorkItemNormAssignmentStatus(
      organizationId,
      calculationContextId,
      workQuantityItemId,
    );
    if (
      status?.hasNormApplication &&
      status.unit !== unit.trim()
    ) {
      throw new NormAssignmentValidationError(
        "Unitatea nu poate fi modificată după alocarea unei norme profesionale.",
      );
    }
  }

  async assignNorm(
    organizationId: OrganizationId,
    calculationContextId: string,
    workQuantityItemId: string,
    estimateNormVersionId: string,
  ): Promise<void> {
    if (
      !isWorkspaceUuid(calculationContextId) ||
      !isWorkspaceUuid(workQuantityItemId) ||
      !isWorkspaceUuid(estimateNormVersionId)
    ) {
      throw new NormAssignmentValidationError(
        "Devizul, poziția sau norma selectată nu a fost găsită.",
      );
    }
    const workspace = await this.repository.getNormWorkspace(
      organizationId,
      calculationContextId,
    );
    const item = workspace?.items.find(({ id }) => id === workQuantityItemId);
    if (!workspace || !item) {
      throw new NormAssignmentValidationError("Poziția sau devizul nu a fost găsit.");
    }
    if (item.application) {
      throw new NormAssignmentValidationError(
        "Poziția are deja o normă alocată.",
      );
    }
    const norm = workspace.normVersions.find(
      ({ norm }) => norm.id === estimateNormVersionId,
    )?.norm;
    if (!norm) throw new NormLibraryRecordNotFoundError();
    if (norm.basisUnit !== item.unit) {
      throw new NormAssignmentValidationError(
        `Unitatea normei (${norm.basisUnit}) nu corespunde cu unitatea poziției (${item.unit}).`,
      );
    }
    if (!isEligibleForDate(norm, workspace.valuationDate)) {
      throw new NormAssignmentValidationError(
        "Norma nu este valabilă la data evaluării devizului.",
      );
    }
    await this.repository.createNormApplication(
      organizationId,
      calculationContextId,
      workQuantityItemId,
      estimateNormVersionId,
    );
  }
}

export { isEligibleForDate as isNormVersionEligibleForDate };
