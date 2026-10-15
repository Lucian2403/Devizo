import {
  isSupportedCurrency,
  type OrganizationId,
} from "@/domain/shared/types";
import { DecimalParseError, parseDecimal } from "./calculation/decimal";
import { isWorkspaceUuid } from "./workspace-identifiers";
import type {
  ProfessionalEstimateData,
  ProfessionalEstimateSummary,
  ProfessionalEstimateWorkspace,
  ProfessionalEstimateWorkspaceRepository,
  ValidatedProfessionalEstimateData,
  WorkQuantityItem,
  WorkQuantityItemData,
  WorkQuantityItemUpdate,
} from "./professional-estimate-workspace.repository";

export class ProfessionalEstimateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfessionalEstimateValidationError";
  }
}

export class ProfessionalEstimateNotFoundError extends Error {
  constructor() {
    super("Devizul profesional nu a fost găsit.");
    this.name = "ProfessionalEstimateNotFoundError";
  }
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ProfessionalEstimateValidationError(`${label} este obligatoriu.`);
  }
  return normalized;
}

function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function validateDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ProfessionalEstimateValidationError(`${label} nu este validă.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ProfessionalEstimateValidationError(`${label} nu este validă.`);
  }
  return value;
}

function validateQuantity(value: string): string {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) {
    throw new ProfessionalEstimateValidationError(
      "Cantitatea trebuie să fie un număr zecimal valid.",
    );
  }

  let parsed: ReturnType<typeof parseDecimal>;
  try {
    parsed = parseDecimal(value.trim(), "quantity");
  } catch (error) {
    if (error instanceof DecimalParseError) {
      throw new ProfessionalEstimateValidationError(
        "Cantitatea trebuie să fie un număr zecimal valid.",
      );
    }
    throw error;
  }
  if (!parsed.isFinite() || parsed.lte(0)) {
    throw new ProfessionalEstimateValidationError(
      "Cantitatea trebuie să fie mai mare decât zero.",
    );
  }
  const [integerPart = "", fractionalPart = ""] = value
    .trim()
    .replace(/^[+-]/, "")
    .split(".");
  const significantIntegerPart =
    integerPart.replace(/^0+(?=\d)/, "") || "0";
  const significantFractionalPart = fractionalPart.replace(/0+$/, "");
  if (
    significantIntegerPart.length > 12 ||
    significantFractionalPart.length > 6
  ) {
    throw new ProfessionalEstimateValidationError(
      "Cantitatea poate avea maximum 12 cifre întregi și 6 zecimale.",
    );
  }
  return value.trim();
}

function validatePositionNumber(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ProfessionalEstimateValidationError(
      "Numărul poziției trebuie să fie un număr întreg mai mare decât zero.",
    );
  }
  return value;
}

function validatedNewItem(data: WorkQuantityItemData): WorkQuantityItemData {
  return {
    positionNumber: validatePositionNumber(data.positionNumber),
    code: optionalText(data.code),
    description: requiredText(data.description, "Denumirea lucrării"),
    unit: requiredText(data.unit, "Unitatea de măsură"),
    quantity: validateQuantity(data.quantity),
    notes: optionalText(data.notes),
  };
}

function validatedItemUpdate(data: WorkQuantityItemUpdate): WorkQuantityItemUpdate {
  return {
    code: optionalText(data.code),
    description: requiredText(data.description, "Denumirea lucrării"),
    unit: requiredText(data.unit, "Unitatea de măsură"),
    quantity: validateQuantity(data.quantity),
    notes: optionalText(data.notes),
  };
}

export class ProfessionalEstimateWorkspaceService {
  constructor(
    private readonly repository: ProfessionalEstimateWorkspaceRepository,
  ) {}

  listProfessionalEstimates(
    organizationId: OrganizationId,
  ): Promise<ProfessionalEstimateSummary[]> {
    return this.repository.listProfessionalEstimates(organizationId);
  }

  async getProfessionalEstimate(
    organizationId: OrganizationId,
    calculationContextId: string,
  ): Promise<ProfessionalEstimateWorkspace> {
    if (!isWorkspaceUuid(calculationContextId)) {
      throw new ProfessionalEstimateNotFoundError();
    }
    const workspace = await this.repository.getProfessionalEstimate(
      organizationId,
      calculationContextId,
    );
    if (!workspace) throw new ProfessionalEstimateNotFoundError();
    return workspace;
  }

  createProfessionalEstimate(
    organizationId: OrganizationId,
    data: ProfessionalEstimateData,
  ): Promise<string> {
    const name = requiredText(data.name, "Denumirea devizului");
    const objectName = requiredText(data.objectName, "Denumirea obiectului");
    const listName = requiredText(data.listName, "Denumirea listei de cantități");
    const valuationDate = validateDate(data.valuationDate, "Data evaluării");
    if (!isSupportedCurrency(data.currency)) {
      throw new ProfessionalEstimateValidationError("Moneda selectată nu este acceptată.");
    }
    const sourceDate = data.sourceDate
      ? validateDate(data.sourceDate, "Data sursei")
      : undefined;

    const validatedData: ValidatedProfessionalEstimateData = {
      name,
      objectName,
      listName,
      valuationDate,
      currency: data.currency,
      objectCode: optionalText(data.objectCode),
      objectAddress: optionalText(data.objectAddress),
      objectDescription: optionalText(data.objectDescription),
      sourceReference: optionalText(data.sourceReference),
      sourceDate,
    };
    return this.repository.createProfessionalEstimate(
      organizationId,
      validatedData,
    );
  }

  async createWorkQuantityItem(
    organizationId: OrganizationId,
    calculationContextId: string,
    data: WorkQuantityItemData,
  ): Promise<WorkQuantityItem> {
    if (!isWorkspaceUuid(calculationContextId)) {
      throw new ProfessionalEstimateNotFoundError();
    }
    const created = await this.repository.createWorkQuantityItem(
      organizationId,
      calculationContextId,
      validatedNewItem(data),
    );
    if (!created) throw new ProfessionalEstimateNotFoundError();
    return created;
  }

  async updateWorkQuantityItem(
    organizationId: OrganizationId,
    calculationContextId: string,
    itemId: string,
    data: WorkQuantityItemUpdate,
  ): Promise<WorkQuantityItem> {
    if (!isWorkspaceUuid(calculationContextId) || !isWorkspaceUuid(itemId)) {
      throw new ProfessionalEstimateNotFoundError();
    }
    const updated = await this.repository.updateWorkQuantityItem(
      organizationId,
      calculationContextId,
      itemId,
      validatedItemUpdate(data),
    );
    if (!updated) throw new ProfessionalEstimateNotFoundError();
    return updated;
  }
}
