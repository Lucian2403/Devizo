import {
  isSupportedCurrency,
  type OrganizationId,
} from "@/domain/shared/types";
import {
  calculateResourceQuantity,
  calculateResources,
  parseDecimal,
  selectEligibleResourcePrice,
  type PriceEligibilityResult,
  type ResourceCalculationInput,
  type ResourceCalculationLine,
  type ResourcePriceCandidate,
} from "./calculation";
import { DecimalParseError } from "./calculation/decimal";
import {
  RESOURCE_PRICE_SOURCE_TYPES,
  type CreateResourcePriceData,
  type ProfessionalResource,
  type ProfessionalResourcePricesRepository,
  type ProfessionalResourceWithPrices,
  type ResourcePriceCandidateRecord,
  type ResourcePriceRecord,
  type ResourcePriceSourceType,
} from "./professional-resource-prices.repository";
import type { ProfessionalResourceType } from "./types";
import { isWorkspaceUuid } from "./workspace-identifiers";
import {
  PROCUREMENT_CATEGORIES, VAT_TREATMENTS, TRANSPORT_TREATMENTS,
  type PriceSemantics,
  type ProcurementCategory,
} from "./procurement-semantics";

export {
  RESOURCE_PRICE_SOURCE_TYPES,
  type CreateResourcePriceData,
  type ProfessionalResource,
  type ProfessionalResourceWithPrices,
  type ResourcePriceRecord,
  type ResourcePriceSourceType,
};

export class ProfessionalResourcePriceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfessionalResourcePriceValidationError";
  }
}

export class ProfessionalResourcePriceNotFoundError extends Error {
  constructor() {
    super("Resursa profesională nu a fost găsită.");
    this.name = "ProfessionalResourcePriceNotFoundError";
  }
}

export interface ResourcePricingInput {
  id: string;
  code: string | null;
  name: string;
  resourceType: ProfessionalResourceType;
  procurementCategory: ProcurementCategory | null;
  unit: string;
  resourceConsumptionId: string;
  resourceId: string;
  normativeConsumption: string;
}

export interface ResourcePricingPositionInput {
  workQuantityItemId: string;
  workQuantity: string;
  estimateNormVersionId: string;
  normApplicationId: string;
  normBasisQuantity: string;
  applicationCoefficient: string;
  resources: ResourcePricingInput[];
}

export type PricedResourceStatus =
  | "selected"
  | "missing"
  | "ambiguous"
  | "zero";

export interface PricedResourceLine {
  id: string;
  code: string | null;
  name: string;
  resourceId: string;
  resourceType: ProfessionalResourceType;
  procurementCategory: ProcurementCategory | null;
  unit: string;
  resourceQuantity: string;
  priceStatus: PricedResourceStatus;
  eligiblePriceCount: number;
  selectedPrice: ResourcePriceCandidateRecord | null;
  calculation: ResourceCalculationLine | null;
  eligibility: PriceEligibilityResult | null;
}

export interface DirectResourceCostPosition {
  workQuantityItemId: string;
  complete: boolean;
  requiredPriceCount: number;
  pricedResourceCount: number;
  directResourceTotal: string | null;
  totalsByResourceType: ReturnType<typeof calculateResources>["totalsByResourceType"] | null;
  resources: PricedResourceLine[];
}

export interface DirectResourceCostPresentation {
  positionsByWorkItemId: Record<string, DirectResourceCostPosition>;
  requiredPriceCount: number;
  pricedResourceCount: number;
  completePositionCount: number;
  positionCount: number;
}

function validateDate(value: string | undefined, label: string, required: boolean): string | undefined {
  if (!value?.trim()) {
    if (required) {
      throw new ProfessionalResourcePriceValidationError(`${label} este obligatorie.`);
    }
    return undefined;
  }
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ProfessionalResourcePriceValidationError(`${label} nu este validă.`);
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new ProfessionalResourcePriceValidationError(`${label} nu este validă.`);
  }
  return date;
}

function validateDecimal(
  value: string,
  label: string,
  positive: boolean,
): string {
  const normalized = value.trim();
  if (!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    throw new ProfessionalResourcePriceValidationError(
      `${label} trebuie să fie un număr zecimal valid.`,
    );
  }
  let decimal;
  try {
    decimal = parseDecimal(normalized, label);
  } catch (error) {
    if (error instanceof DecimalParseError) {
      throw new ProfessionalResourcePriceValidationError(
        `${label} trebuie să fie un număr zecimal valid.`,
      );
    }
    throw error;
  }
  if (positive ? decimal.lte(0) : decimal.lt(0)) {
    throw new ProfessionalResourcePriceValidationError(
      positive
        ? `${label} trebuie să fie mai mare decât zero.`
        : `${label} nu poate fi negativ.`,
    );
  }
  const [integer = "", fraction = ""] = normalized.replace(/^\+/, "").split(".");
  const integerDigits = integer.replace(/^0+/, "") || "0";
  const fractionalDigits = fraction.replace(/0+$/, "");
  if (integerDigits.length > 12 || fractionalDigits.length > 6) {
    throw new ProfessionalResourcePriceValidationError(
      `${label} poate avea maximum 12 cifre întregi și 6 zecimale.`,
    );
  }
  return normalized.replace(/^\+/, "");
}

function validateCreateData(data: CreateResourcePriceData): CreateResourcePriceData {
  const semantics = validatePriceSemantics(data);
  const price = validateDecimal(data.price, "Prețul", false);
  const basisQuantity = validateDecimal(
    data.basisQuantity,
    "Cantitatea de bază",
    true,
  );
  if (!isSupportedCurrency(data.currency)) {
    throw new ProfessionalResourcePriceValidationError(
      "Moneda selectată nu este acceptată.",
    );
  }
  const validFrom = validateDate(data.validFrom, "Data de început", true)!;
  const validTo = validateDate(data.validTo, "Data de sfârșit", false);
  if (validTo && validTo < validFrom) {
    throw new ProfessionalResourcePriceValidationError(
      "Data de sfârșit nu poate preceda data de început.",
    );
  }
  if (!(RESOURCE_PRICE_SOURCE_TYPES as readonly string[]).includes(data.sourceType)) {
    throw new ProfessionalResourcePriceValidationError("Tipul sursei nu este valid.");
  }
  const sourceReference = data.sourceReference?.trim() || undefined;
  const location = data.location?.trim() || undefined;
  if (sourceReference && sourceReference.length > 300) {
    throw new ProfessionalResourcePriceValidationError(
      "Referința sursei poate avea maximum 300 de caractere.",
    );
  }
  if (location && location.length > 300) {
    throw new ProfessionalResourcePriceValidationError(
      "Localitatea sau regiunea poate avea maximum 300 de caractere.",
    );
  }
  return {
    ...semantics,
    price,
    basisQuantity,
    currency: data.currency,
    validFrom,
    validTo,
    sourceType: data.sourceType,
    sourceReference,
    location,
  };
}

function validatePriceSemantics(data: {
  vatTreatment: string; transportTreatment: string;
}): PriceSemantics {
  const vatTreatment = VAT_TREATMENTS.find((value) => value === data.vatTreatment);
  const transportTreatment = TRANSPORT_TREATMENTS.find(
    (value) => value === data.transportTreatment,
  );
  if (!vatTreatment || !transportTreatment) {
    throw new ProfessionalResourcePriceValidationError(
      "Selectați tratamentul TVA și al transportului în preț.",
    );
  }
  return { vatTreatment, transportTreatment };
}

function toKernelCandidate(
  candidate: ResourcePriceCandidateRecord,
): ResourcePriceCandidate {
  return {
    resourcePriceId: candidate.id,
    resourceId: candidate.resourceId,
    sourceId: candidate.sourceId,
    price: candidate.price,
    priceBasisQuantity: candidate.basisQuantity,
    currency: candidate.currency,
    validFrom: candidate.validFrom,
    validTo: candidate.validTo,
  };
}

function isZero(value: string): boolean {
  return parseDecimal(value, "resourceQuantity").isZero();
}

export class ProfessionalResourcePricesService {
  constructor(
    private readonly repository: ProfessionalResourcePricesRepository,
  ) {}

  async updatePriceSemantics(
    organizationId: OrganizationId, resourceId: string, priceId: string,
    data: { vatTreatment: string; transportTreatment: string },
  ): Promise<void> {
    if (!isWorkspaceUuid(resourceId) || !isWorkspaceUuid(priceId)) {
      throw new ProfessionalResourcePriceNotFoundError();
    }
    const updated = await this.repository.updatePriceSemantics(
      organizationId, resourceId, priceId, validatePriceSemantics(data),
    );
    if (!updated) throw new ProfessionalResourcePriceNotFoundError();
  }

  async updateProcurementCategory(
    organizationId: OrganizationId, resourceId: string, value: string,
  ): Promise<void> {
    if (!isWorkspaceUuid(resourceId)) throw new ProfessionalResourcePriceNotFoundError();
    const category = value === "" ? null : PROCUREMENT_CATEGORIES.find(
      (entry) => entry === value,
    );
    if (category === undefined) {
      throw new ProfessionalResourcePriceValidationError("Categoria resursei nu este validă.");
    }
    const updated = await this.repository.updateProcurementCategory(
      organizationId, resourceId, category,
    );
    if (!updated) throw new ProfessionalResourcePriceNotFoundError();
  }

  listProfessionalResourcesWithPrices(
    organizationId: OrganizationId,
  ): Promise<ProfessionalResourceWithPrices[]> {
    return this.repository.listProfessionalResourcesWithPrices(organizationId);
  }

  async getProfessionalResourceWithPrices(
    organizationId: OrganizationId,
    resourceId: string,
  ): Promise<ProfessionalResourceWithPrices> {
    if (!isWorkspaceUuid(resourceId)) {
      throw new ProfessionalResourcePriceNotFoundError();
    }
    const resource = await this.repository.getProfessionalResourceWithPrices(
      organizationId,
      resourceId,
    );
    if (!resource) throw new ProfessionalResourcePriceNotFoundError();
    return resource;
  }

  async createResourcePrice(
    organizationId: OrganizationId,
    resourceId: string,
    data: CreateResourcePriceData,
  ): Promise<ResourcePriceRecord> {
    if (!isWorkspaceUuid(resourceId)) {
      throw new ProfessionalResourcePriceNotFoundError();
    }
    const created = await this.repository.createResourcePrice(
      organizationId,
      resourceId,
      validateCreateData(data),
    );
    if (!created) throw new ProfessionalResourcePriceNotFoundError();
    return created;
  }

  async resolvePriceStatus(
    organizationId: OrganizationId,
    resourceId: string,
    currency: string,
    valuationDate: string,
  ): Promise<PriceEligibilityResult> {
    if (!isWorkspaceUuid(resourceId)) {
      throw new ProfessionalResourcePriceNotFoundError();
    }
    if (!isSupportedCurrency(currency)) {
      throw new ProfessionalResourcePriceValidationError(
        "Moneda selectată nu este acceptată.",
      );
    }
    const candidates = await this.repository.listPriceCandidates(
      organizationId,
      [resourceId],
      currency,
    );
    return selectEligibleResourcePrice(
      candidates
        .filter(
          (candidate) =>
            candidate.organizationId === organizationId &&
            candidate.resourceId === resourceId &&
            candidate.currency === currency,
        )
        .map(toKernelCandidate),
      valuationDate,
    );
  }

  async calculateDirectResourceCosts(
    organizationId: OrganizationId,
    currency: string,
    valuationDate: string,
    positions: ResourcePricingPositionInput[],
  ): Promise<DirectResourceCostPresentation> {
    if (!isSupportedCurrency(currency)) {
      throw new ProfessionalResourcePriceValidationError(
        "Moneda selectată nu este acceptată.",
      );
    }
    const resourceIds = [
      ...new Set(positions.flatMap((position) =>
        position.resources.map((resource) => resource.resourceId),
      )),
    ];
    const candidates = await this.repository.listPriceCandidates(
      organizationId,
      resourceIds,
      currency,
    );
    const candidatesByResource = new Map<string, ResourcePriceCandidateRecord[]>();
    for (const candidate of candidates) {
      if (
        candidate.organizationId !== organizationId ||
        candidate.currency !== currency ||
        !resourceIds.includes(candidate.resourceId)
      ) {
        continue;
      }
      const group = candidatesByResource.get(candidate.resourceId) ?? [];
      group.push(candidate);
      candidatesByResource.set(candidate.resourceId, group);
    }

    const positionsByWorkItemId: Record<string, DirectResourceCostPosition> = {};
    let requiredPriceCount = 0;
    let pricedResourceCount = 0;
    let completePositionCount = 0;

    for (const position of positions) {
      const pricedInputs: ResourceCalculationInput[] = [];
      const resourceLines: PricedResourceLine[] = [];
      let positionRequiredCount = 0;
      let positionPricedCount = 0;

      for (const resource of position.resources) {
        const quantityInput = {
          estimateNormVersionId: position.estimateNormVersionId,
          resourceConsumptionId: resource.resourceConsumptionId,
          resourceId: resource.resourceId,
          normApplicationId: position.normApplicationId,
          resourceType: resource.resourceType,
          workQuantity: position.workQuantity,
          normBasisQuantity: position.normBasisQuantity,
          normativeConsumption: resource.normativeConsumption,
          applicationCoefficient: position.applicationCoefficient,
        };
        const resourceQuantity =
          calculateResourceQuantity(quantityInput).resourceQuantity;
        if (isZero(resourceQuantity)) {
          // A zero requirement contributes zero and must not invent a price record.
          resourceLines.push({
            id: resource.id,
            code: resource.code,
            name: resource.name,
            resourceId: resource.resourceId,
            resourceType: resource.resourceType,
            procurementCategory: resource.procurementCategory,
            unit: resource.unit,
            resourceQuantity,
            priceStatus: "zero",
            eligiblePriceCount: 0,
            selectedPrice: null,
            calculation: null,
            eligibility: null,
          });
          continue;
        }

        positionRequiredCount += 1;
        const resourceCandidates = candidatesByResource.get(resource.resourceId) ?? [];
        const eligibility = selectEligibleResourcePrice(
          resourceCandidates.map(toKernelCandidate),
          valuationDate,
        );
        if (eligibility.status === "selected" && eligibility.selected) {
          const selectedPrice = resourceCandidates.find(
            ({ id }) => id === eligibility.selected?.resourcePriceId,
          );
          if (!selectedPrice) {
            throw new Error("Selected resource price candidate was not found in its source records.");
          }
          pricedInputs.push({
            ...quantityInput,
            resourcePriceId: selectedPrice.id,
            currency: selectedPrice.currency,
            resourcePrice: selectedPrice.price,
            priceBasisQuantity: selectedPrice.basisQuantity,
          });
          positionPricedCount += 1;
          resourceLines.push({
            id: resource.id,
            code: resource.code,
            name: resource.name,
            resourceId: resource.resourceId,
            resourceType: resource.resourceType,
            procurementCategory: resource.procurementCategory,
            unit: resource.unit,
            resourceQuantity,
            priceStatus: "selected",
            eligiblePriceCount: 1,
            selectedPrice,
            calculation: null,
            eligibility,
          });
        } else {
          resourceLines.push({
            id: resource.id,
            code: resource.code,
            name: resource.name,
            resourceId: resource.resourceId,
            resourceType: resource.resourceType,
            unit: resource.unit,
            resourceQuantity,
            priceStatus: eligibility.status,
            procurementCategory: resource.procurementCategory,
            eligiblePriceCount: eligibility.eligible.length,
            selectedPrice: null,
            calculation: null,
            eligibility,
          });
        }
      }

      const resourceCalculation = calculateResources(pricedInputs);
      let calculationIndex = 0;
      for (const resource of resourceLines) {
        if (resource.priceStatus === "selected") {
          const calculation = resourceCalculation.lines[calculationIndex];
          if (!calculation) {
            throw new Error("Resource calculation output is missing a selected price line.");
          }
          resource.calculation = calculation;
          calculationIndex += 1;
        }
      }
      const hasResourceComposition = position.resources.length > 0;
      const complete =
        hasResourceComposition &&
        positionRequiredCount === positionPricedCount;
      if (complete) completePositionCount += 1;
      requiredPriceCount += positionRequiredCount;
      pricedResourceCount += positionPricedCount;
      positionsByWorkItemId[position.workQuantityItemId] = {
        workQuantityItemId: position.workQuantityItemId,
        complete,
        requiredPriceCount: positionRequiredCount,
        pricedResourceCount: positionPricedCount,
        directResourceTotal: complete
          ? resourceCalculation.directResourceTotal
          : null,
        totalsByResourceType: complete
          ? resourceCalculation.totalsByResourceType
          : null,
        resources: resourceLines,
      };
    }

    return {
      positionsByWorkItemId,
      requiredPriceCount,
      pricedResourceCount,
      completePositionCount,
      positionCount: positions.length,
    };
  }
}
