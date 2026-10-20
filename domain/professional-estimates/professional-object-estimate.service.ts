import {
  calculateProfessionalObjectEstimate,
  ProfessionalObjectEstimateAggregationError,
  type ProfessionalObjectEstimateCostCategory,
  type ProfessionalObjectEstimateTotals,
} from "./calculation";
import type { OrganizationId, SupportedCurrency } from "@/domain/shared/types";
import type { ProfessionalEstimateSummary } from "./professional-estimate-workspace.repository";
import type {
  ProfessionalObjectEstimateData,
  ProfessionalObjectEstimateRepository,
} from "./professional-object-estimate.repository";
import { isWorkspaceUuid } from "./workspace-identifiers";
import { isSupportedCurrency } from "@/domain/shared/types";

export class ProfessionalObjectEstimateNotFoundError extends Error {
  constructor() {
    super("Devizul pe obiect nu a fost găsit.");
    this.name = "ProfessionalObjectEstimateNotFoundError";
  }
}

export class ProfessionalObjectEstimateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfessionalObjectEstimateValidationError";
  }
}

export class LocalProfessionalEstimateNotFoundError extends Error {
  constructor() {
    super("Devizul local asociat nu mai este disponibil.");
    this.name = "LocalProfessionalEstimateNotFoundError";
  }
}

export interface LiveLocalEstimateCalculation {
  calculationContextId: string;
  constructionObjectId: string;
  name: string;
  valuationDate: string;
  currency: SupportedCurrency;
  subtotal: string | null;
  complete: boolean;
}

export interface ProfessionalObjectEstimateEntryView {
  id: string;
  calculationContextId: string;
  positionNumber: number;
  costCategory: ProfessionalObjectEstimateCostCategory;
  included: boolean;
  localEstimate: LiveLocalEstimateCalculation | null;
  eligibilityError: string | null;
}

export interface ProfessionalObjectEstimateView {
  id: string;
  constructionObjectId: string;
  constructionObjectName: string;
  name: string;
  code: string | null;
  valuationDate: string;
  currency: SupportedCurrency;
  notes: string | null;
  entries: ProfessionalObjectEstimateEntryView[];
  candidates: Array<{
    calculationContextId: string;
    name: string;
    valuationDate: string;
    currency: SupportedCurrency;
    linked: boolean;
    eligibilityError: string | null;
  }>;
  complete: boolean;
  totals: ProfessionalObjectEstimateTotals | null;
  includedCount: number;
}

export interface ProfessionalObjectEstimateListItem {
  id: string;
  constructionObjectId: string;
  constructionObjectName: string;
  name: string;
  valuationDate: string;
  currency: SupportedCurrency;
  includedCount: number;
  complete: boolean;
  total: string | null;
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ProfessionalObjectEstimateValidationError(`${label} este obligatoriu.`);
  }
  return normalized;
}

function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export class ProfessionalObjectEstimateService {
  constructor(
    private readonly repository: ProfessionalObjectEstimateRepository,
    private readonly listLocalEstimates: (
      organizationId: OrganizationId,
    ) => Promise<ProfessionalEstimateSummary[]>,
    private readonly calculateLocalEstimate: (
      organizationId: OrganizationId,
      calculationContextId: string,
    ) => Promise<LiveLocalEstimateCalculation>,
  ) {}

  listConstructionObjects(organizationId: OrganizationId) {
    return this.repository.listConstructionObjects(organizationId);
  }

  async list(
    organizationId: OrganizationId,
  ): Promise<ProfessionalObjectEstimateListItem[]> {
    const rows = await this.repository.list(organizationId);
    return Promise.all(
      rows.map(async ({ estimate, constructionObjectName, entries }) => {
        const live = await this.evaluateEntries(organizationId, estimate, entries);
        return {
          id: estimate.id,
          constructionObjectId: estimate.constructionObjectId,
          constructionObjectName,
          name: estimate.name,
          valuationDate: estimate.valuationDate,
          currency: estimate.currency,
          includedCount: live.includedCount,
          complete: live.complete,
          total: live.totals?.total ?? null,
        };
      }),
    );
  }

  async get(
    organizationId: OrganizationId,
    objectEstimateId: string,
  ): Promise<ProfessionalObjectEstimateView> {
    if (!isWorkspaceUuid(objectEstimateId)) {
      throw new ProfessionalObjectEstimateNotFoundError();
    }
    const row = await this.repository.get(organizationId, objectEstimateId);
    if (!row) throw new ProfessionalObjectEstimateNotFoundError();
    const localEstimates = await this.listLocalEstimates(organizationId);
    const linkedIds = new Set(row.entries.map(({ calculationContextId }) => calculationContextId));
    const candidates = localEstimates
      .filter(
        ({ constructionObject }) =>
          constructionObject.id === row.estimate.constructionObjectId,
      )
      .map((summary) => ({
        calculationContextId: summary.context.id,
        name: summary.context.name,
        valuationDate: summary.context.valuationDate,
        currency: summary.context.currency,
        linked: linkedIds.has(summary.context.id),
        eligibilityError: this.eligibilityError(
          summary.context.valuationDate,
          summary.context.currency,
          row.estimate.valuationDate,
          row.estimate.currency,
        ),
      }));
    const evaluated = await this.evaluateEntries(
      organizationId,
      row.estimate,
      row.entries,
    );
    return {
      id: row.estimate.id,
      constructionObjectId: row.estimate.constructionObjectId,
      constructionObjectName: row.constructionObjectName,
      name: row.estimate.name,
      code: row.estimate.code ?? null,
      valuationDate: row.estimate.valuationDate,
      currency: row.estimate.currency,
      notes: row.estimate.notes ?? null,
      entries: evaluated.entries,
      candidates,
      complete: evaluated.complete,
      totals: evaluated.totals,
      includedCount: evaluated.includedCount,
    };
  }

  async create(
    organizationId: OrganizationId,
    data: ProfessionalObjectEstimateData,
  ): Promise<string> {
    if (!isWorkspaceUuid(data.constructionObjectId)) {
      throw new ProfessionalObjectEstimateValidationError("Selectați un obiect valid.");
    }
    const name = requiredText(data.name, "Denumirea devizului pe obiect");
    if (!validDate(data.valuationDate)) {
      throw new ProfessionalObjectEstimateValidationError("Data evaluării nu este validă.");
    }
    if (!isSupportedCurrency(data.currency)) {
      throw new ProfessionalObjectEstimateValidationError("Moneda selectată nu este acceptată.");
    }
    if (
      !(await this.repository.constructionObjectExists(
        organizationId,
        data.constructionObjectId,
      ))
    ) {
      throw new ProfessionalObjectEstimateValidationError(
        "Obiectul selectat nu este accesibil.",
      );
    }
    return this.repository.create(organizationId, {
      constructionObjectId: data.constructionObjectId,
      name,
      code: optionalText(data.code),
      valuationDate: data.valuationDate,
      currency: data.currency,
      notes: optionalText(data.notes),
    });
  }

  async addEntry(
    organizationId: OrganizationId,
    objectEstimateId: string,
    calculationContextId: string,
    costCategory: string,
  ): Promise<void> {
    this.validateIds(objectEstimateId, calculationContextId);
    if (!this.isCostCategory(costCategory)) {
      throw new ProfessionalObjectEstimateValidationError(
        "Selectați explicit categoria de cheltuieli.",
      );
    }
    const objectEstimate = await this.get(organizationId, objectEstimateId);
    const localEstimate = await this.calculateLocalEstimate(
      organizationId,
      calculationContextId,
    );
    this.assertMatchesObject(objectEstimate, localEstimate);
    const added = await this.repository.addEntry(
      organizationId,
      objectEstimateId,
      calculationContextId,
      costCategory,
    );
    if (!added) throw new ProfessionalObjectEstimateNotFoundError();
  }

  async updateEntry(
    organizationId: OrganizationId,
    objectEstimateId: string,
    entryId: string,
    data: { included?: boolean; costCategory?: string },
  ): Promise<void> {
    this.validateIds(objectEstimateId, entryId);
    const update: {
      included?: boolean;
      costCategory?: ProfessionalObjectEstimateCostCategory;
    } = {};
    if (data.included !== undefined) update.included = data.included;
    if (data.costCategory !== undefined) {
      if (!this.isCostCategory(data.costCategory)) {
        throw new ProfessionalObjectEstimateValidationError(
          "Selectați explicit categoria de cheltuieli.",
        );
      }
      update.costCategory = data.costCategory;
    }
    if (Object.keys(update).length === 0) {
      throw new ProfessionalObjectEstimateValidationError(
        "Nu există modificări valide pentru poziția devizului.",
      );
    }
    const updated = await this.repository.updateEntry(
      organizationId,
      objectEstimateId,
      entryId,
      update,
    );
    if (!updated) throw new ProfessionalObjectEstimateNotFoundError();
  }

  private async evaluateEntries(
    organizationId: OrganizationId,
    estimate: { id: string; constructionObjectId: string; valuationDate: string; currency: string },
    entries: Array<{
      id: string;
      calculationContextId: string;
      positionNumber: number;
      costCategory: ProfessionalObjectEstimateCostCategory;
      included: boolean;
    }>,
  ) {
    const localCalculations = await Promise.all(
      entries.map(async (entry) => {
        try {
          return await this.calculateLocalEstimate(
            organizationId,
            entry.calculationContextId,
          );
        } catch (error) {
          if (error instanceof LocalProfessionalEstimateNotFoundError) return null;
          throw error;
        }
      }),
    );
    let complete = entries.some(({ included }) => included);
    const viewEntries = entries.map((entry, index) => {
      const localEstimate = localCalculations[index] ?? null;
      const eligibilityError = localEstimate
        ? this.eligibilityError(
            localEstimate.valuationDate,
            localEstimate.currency,
            estimate.valuationDate,
            estimate.currency,
          ) ??
          (localEstimate.constructionObjectId !== estimate.constructionObjectId
            ? "Devizul local aparține altui obiect."
            : null)
        : "Devizul local nu mai este disponibil.";
      const isComplete =
        localEstimate?.complete === true &&
        localEstimate.subtotal !== null &&
        eligibilityError === null;
      if (entry.included && !isComplete) complete = false;
      return { ...entry, localEstimate, eligibilityError };
    });
    const includedEntries = viewEntries.filter(({ included }) => included);
    let totals: ProfessionalObjectEstimateTotals | null = null;
    if (complete && includedEntries.length > 0) {
      try {
        totals = calculateProfessionalObjectEstimate(
          includedEntries.map((entry) => ({
            calculationContextId: entry.calculationContextId,
            costCategory: entry.costCategory,
            amount: entry.localEstimate!.subtotal!,
            currency: entry.localEstimate!.currency,
          })),
        );
      } catch (error) {
        if (error instanceof ProfessionalObjectEstimateAggregationError) {
          complete = false;
        }
        else throw error;
      }
    }
    if (!complete) totals = null;
    return {
      entries: viewEntries,
      complete,
      totals,
      includedCount: includedEntries.length,
    };
  }

  private eligibilityError(
    localDate: string,
    localCurrency: string,
    objectDate: string,
    objectCurrency: string,
  ): string | null {
    const errors: string[] = [];
    if (localDate !== objectDate) {
      errors.push("Data evaluării diferă de devizul pe obiect.");
    }
    if (localCurrency !== objectCurrency) {
      errors.push("Moneda diferă de devizul pe obiect.");
    }
    return errors.length > 0 ? errors.join(" ") : null;
  }

  private assertMatchesObject(
    estimate: ProfessionalObjectEstimateView,
    localEstimate: LiveLocalEstimateCalculation,
  ): void {
    if (localEstimate.constructionObjectId !== estimate.constructionObjectId) {
      throw new ProfessionalObjectEstimateValidationError(
        "Devizele locale și pe obiect trebuie să aparțină aceluiași obiect.",
      );
    }
    const mismatch = this.eligibilityError(
      localEstimate.valuationDate,
      localEstimate.currency,
      estimate.valuationDate,
      estimate.currency,
    );
    if (mismatch) throw new ProfessionalObjectEstimateValidationError(mismatch);
  }

  private validateIds(objectEstimateId: string, entryOrContextId: string): void {
    if (
      !isWorkspaceUuid(objectEstimateId) ||
      !isWorkspaceUuid(entryOrContextId)
    ) {
      throw new ProfessionalObjectEstimateNotFoundError();
    }
  }

  private isCostCategory(
    value: string,
  ): value is ProfessionalObjectEstimateCostCategory {
    return [
      "construction_works",
      "installation_works",
      "equipment_furniture_inventory",
      "other_costs",
    ].includes(value);
  }
}
