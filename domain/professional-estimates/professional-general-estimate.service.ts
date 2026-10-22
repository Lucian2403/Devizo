import type { OrganizationId, SupportedCurrency } from "@/domain/shared/types";
import { isSupportedCurrency } from "@/domain/shared/types";
import {
  calculateProfessionalGeneralEstimate,
  ProfessionalGeneralEstimateAggregationError,
  PROFESSIONAL_GENERAL_ESTIMATE_CHAPTERS,
  type ProfessionalGeneralEstimateChapterNumber,
  type ProfessionalGeneralEstimateTotals,
} from "./calculation";
import type {
  ProfessionalGeneralEstimateData,
  ProfessionalGeneralEstimateEntryRecord,
  ProfessionalGeneralEstimateRecord,
  ProfessionalGeneralEstimateRepository,
} from "./professional-general-estimate.repository";
import {
  ProfessionalObjectEstimateNotFoundError,
  type ProfessionalObjectEstimateListItem,
  type ProfessionalObjectEstimateService,
  type ProfessionalObjectEstimateView,
} from "./professional-object-estimate.service";
import { isWorkspaceUuid } from "./workspace-identifiers";

export class ProfessionalGeneralEstimateNotFoundError extends Error {
  constructor() {
    super("Devizul general nu a fost găsit.");
    this.name = "ProfessionalGeneralEstimateNotFoundError";
  }
}

export class ProfessionalGeneralEstimateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfessionalGeneralEstimateValidationError";
  }
}

export class ProfessionalGeneralEstimateSourceNotFoundError extends Error {
  constructor() {
    super("Devizul pe obiect asociat nu mai este disponibil.");
    this.name = "ProfessionalGeneralEstimateSourceNotFoundError";
  }
}

export interface ProfessionalGeneralEstimateEntryView
  extends ProfessionalGeneralEstimateEntryRecord {
  objectEstimate: ProfessionalObjectEstimateView | null;
  eligibilityError: string | null;
}

export interface ProfessionalGeneralEstimateView {
  id: string;
  name: string;
  code: string | null;
  valuationDate: string;
  currency: SupportedCurrency;
  notes: string | null;
  entries: ProfessionalGeneralEstimateEntryView[];
  candidates: Array<
    ProfessionalObjectEstimateListItem & {
      linked: boolean;
      eligibilityError: string | null;
    }
  >;
  complete: boolean;
  totals: ProfessionalGeneralEstimateTotals | null;
  includedCount: number;
  aggregationError: string | null;
}

export interface ProfessionalGeneralEstimateListItem {
  id: string;
  name: string;
  valuationDate: string;
  currency: SupportedCurrency;
  includedCount: number;
  complete: boolean;
  subtotal: string | null;
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ProfessionalGeneralEstimateValidationError(
      `${label} este obligatoriu.`,
    );
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
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function validChapter(value: number): value is ProfessionalGeneralEstimateChapterNumber {
  return (
    Number.isInteger(value) &&
    PROFESSIONAL_GENERAL_ESTIMATE_CHAPTERS.some(
      ({ number }) => number === value,
    )
  );
}

export class ProfessionalGeneralEstimateService {
  constructor(
    private readonly repository: ProfessionalGeneralEstimateRepository,
    private readonly objectEstimateService: Pick<
      ProfessionalObjectEstimateService,
      "list" | "get"
    >,
  ) {}

  async list(
    organizationId: OrganizationId,
  ): Promise<ProfessionalGeneralEstimateListItem[]> {
    const rows = await this.repository.list(organizationId);
    return Promise.all(
      rows.map(async ({ estimate, entries }) => {
        const evaluated = await this.evaluateEntries(
          organizationId,
          estimate,
          entries,
        );
        return {
          id: estimate.id,
          name: estimate.name,
          valuationDate: estimate.valuationDate,
          currency: estimate.currency,
          includedCount: evaluated.includedCount,
          complete: evaluated.complete,
          subtotal: evaluated.totals?.totals.total ?? null,
        };
      }),
    );
  }

  async get(
    organizationId: OrganizationId,
    generalEstimateId: string,
  ): Promise<ProfessionalGeneralEstimateView> {
    if (!isWorkspaceUuid(generalEstimateId)) {
      throw new ProfessionalGeneralEstimateNotFoundError();
    }
    const row = await this.repository.get(organizationId, generalEstimateId);
    if (!row) throw new ProfessionalGeneralEstimateNotFoundError();
    const [objectEstimates, evaluated] = await Promise.all([
      this.objectEstimateService.list(organizationId),
      this.evaluateEntries(organizationId, row.estimate, row.entries),
    ]);
    const linkedIds = new Set(
      row.entries.map(({ objectEstimateId }) => objectEstimateId),
    );
    return {
      id: row.estimate.id,
      name: row.estimate.name,
      code: row.estimate.code,
      valuationDate: row.estimate.valuationDate,
      currency: row.estimate.currency,
      notes: row.estimate.notes,
      entries: evaluated.entries,
      candidates: objectEstimates.map((candidate) => ({
        ...candidate,
        linked: linkedIds.has(candidate.id),
        eligibilityError: this.eligibilityError(
          candidate.valuationDate,
          candidate.currency,
          row.estimate.valuationDate,
          row.estimate.currency,
        ),
      })),
      complete: evaluated.complete,
      totals: evaluated.totals,
      includedCount: evaluated.includedCount,
      aggregationError: evaluated.aggregationError,
    };
  }

  async create(
    organizationId: OrganizationId,
    data: ProfessionalGeneralEstimateData,
  ): Promise<string> {
    const name = requiredText(data.name, "Denumirea devizului general");
    if (!validDate(data.valuationDate)) {
      throw new ProfessionalGeneralEstimateValidationError(
        "Data evaluării nu este validă.",
      );
    }
    if (!isSupportedCurrency(data.currency)) {
      throw new ProfessionalGeneralEstimateValidationError(
        "Moneda selectată nu este acceptată.",
      );
    }
    return this.repository.create(organizationId, {
      name,
      code: optionalText(data.code),
      valuationDate: data.valuationDate,
      currency: data.currency,
      notes: optionalText(data.notes),
    });
  }

  async addEntry(
    organizationId: OrganizationId,
    generalEstimateId: string,
    objectEstimateId: string,
    chapterNumber: number,
  ): Promise<void> {
    this.validateIds(generalEstimateId, objectEstimateId);
    if (!validChapter(chapterNumber)) {
      throw new ProfessionalGeneralEstimateValidationError(
        "Selectați explicit un capitol de la 1 la 12.",
      );
    }
    const estimate = await this.get(organizationId, generalEstimateId);
    const objectEstimate = await this.getSource(
      organizationId,
      objectEstimateId,
    );
    this.assertEligible(estimate, objectEstimate);
    const inserted = await this.repository.addEntry(
      organizationId,
      generalEstimateId,
      objectEstimateId,
      chapterNumber,
    );
    if (!inserted) throw new ProfessionalGeneralEstimateNotFoundError();
  }

  async updateEntry(
    organizationId: OrganizationId,
    generalEstimateId: string,
    entryId: string,
    data: { included?: boolean; chapterNumber?: number },
  ): Promise<void> {
    this.validateIds(generalEstimateId, entryId);
    if (
      data.chapterNumber !== undefined &&
      !validChapter(data.chapterNumber)
    ) {
      throw new ProfessionalGeneralEstimateValidationError(
        "Selectați explicit un capitol de la 1 la 12.",
      );
    }
    if (
      data.included === undefined &&
      data.chapterNumber === undefined
    ) {
      throw new ProfessionalGeneralEstimateValidationError(
        "Nu există modificări valide pentru poziția devizului general.",
      );
    }
    const updated = await this.repository.updateEntry(
      organizationId,
      generalEstimateId,
      entryId,
      data,
    );
    if (!updated) throw new ProfessionalGeneralEstimateNotFoundError();
  }

  private async evaluateEntries(
    organizationId: OrganizationId,
    estimate: ProfessionalGeneralEstimateRecord,
    entries: ProfessionalGeneralEstimateEntryRecord[],
  ) {
    const results = await Promise.all(
      entries.map(async (entry) => {
        try {
          return await this.objectEstimateService.get(
            organizationId,
            entry.objectEstimateId,
          );
        } catch (error) {
          if (error instanceof ProfessionalObjectEstimateNotFoundError) {
            return null;
          }
          throw error;
        }
      }),
    );
    let complete = entries.some(({ included }) => included);
    let aggregationError: string | null = null;
    const viewEntries = entries.map((entry, index) => {
      const objectEstimate = results[index] ?? null;
      const eligibilityError = objectEstimate
        ? this.eligibilityError(
            objectEstimate.valuationDate,
            objectEstimate.currency,
            estimate.valuationDate,
            estimate.currency,
          )
        : "Devizul pe obiect nu mai este disponibil.";
      if (
        entry.included &&
        (!objectEstimate ||
          !objectEstimate.complete ||
          !objectEstimate.totals ||
          eligibilityError)
      ) {
        complete = false;
      }
      return { ...entry, objectEstimate, eligibilityError };
    });
    const includedEntries = viewEntries.filter(
      (entry) => entry.included,
    );
    let totals: ProfessionalGeneralEstimateTotals | null = null;
    if (complete && includedEntries.length > 0) {
      try {
        totals = calculateProfessionalGeneralEstimate(
          includedEntries.map((entry) => ({
            objectEstimateId: entry.objectEstimate!.id,
            chapterNumber: entry.chapterNumber,
            constructionWorks:
              entry.objectEstimate!.totals!.constructionWorks,
            installationWorks:
              entry.objectEstimate!.totals!.installationWorks,
            equipmentFurnitureInventory:
              entry.objectEstimate!.totals!.equipmentFurnitureInventory,
            otherCosts: entry.objectEstimate!.totals!.otherCosts,
            currency: entry.objectEstimate!.currency,
          })),
        );
      } catch (error) {
        if (error instanceof ProfessionalGeneralEstimateAggregationError) {
          aggregationError = error.message;
          complete = false;
        } else {
          throw error;
        }
      }
    }
    if (!complete) totals = null;
    return {
      entries: viewEntries,
      complete,
      totals,
      includedCount: includedEntries.length,
      aggregationError,
    };
  }

  private async getSource(
    organizationId: OrganizationId,
    objectEstimateId: string,
  ): Promise<ProfessionalObjectEstimateView> {
    try {
      return await this.objectEstimateService.get(
        organizationId,
        objectEstimateId,
      );
    } catch (error) {
      if (error instanceof ProfessionalObjectEstimateNotFoundError) {
        throw new ProfessionalGeneralEstimateSourceNotFoundError();
      }
      throw error;
    }
  }

  private eligibilityError(
    sourceDate: string,
    sourceCurrency: string,
    generalDate: string,
    generalCurrency: string,
  ): string | null {
    const errors: string[] = [];
    if (sourceDate !== generalDate) {
      errors.push("Data evaluării diferă de devizul general.");
    }
    if (sourceCurrency !== generalCurrency) {
      errors.push("Moneda diferă de devizul general.");
    }
    return errors.length > 0 ? errors.join(" ") : null;
  }

  private assertEligible(
    estimate: ProfessionalGeneralEstimateView,
    objectEstimate: ProfessionalObjectEstimateView,
  ): void {
    const error = this.eligibilityError(
      objectEstimate.valuationDate,
      objectEstimate.currency,
      estimate.valuationDate,
      estimate.currency,
    );
    if (error) throw new ProfessionalGeneralEstimateValidationError(error);
  }

  private validateIds(generalEstimateId: string, sourceId: string): void {
    if (
      !isWorkspaceUuid(generalEstimateId) ||
      !isWorkspaceUuid(sourceId)
    ) {
      throw new ProfessionalGeneralEstimateNotFoundError();
    }
  }
}
