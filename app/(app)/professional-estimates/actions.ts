"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DuplicateConstructionObjectCodeError,
  DuplicateWorkPositionError,
} from "@/domain/professional-estimates/professional-estimate-workspace.repository";
import {
  ProfessionalEstimateNotFoundError,
  ProfessionalEstimateValidationError,
} from "@/domain/professional-estimates/professional-estimate-workspace.service";
import { isSupportedCurrency } from "@/domain/shared/types";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProfessionalEstimateWorkspaceService } from "@/server/container";
import {
  DuplicateInternalNormError,
  DuplicateNormResourceError,
  InternalNormIdentityConflictError,
  InternalNormSourceConflictError,
  NormAssignmentValidationError,
  NormLibraryRecordNotFoundError,
  NormVersionPublicationError,
  ProfessionalNormLibraryValidationError,
} from "@/domain/professional-estimates/professional-norm-library.service";
import { getProfessionalNormLibraryService } from "@/server/container";
import {
  ProfessionalResourcePriceNotFoundError,
  ProfessionalResourcePriceValidationError,
  RESOURCE_PRICE_SOURCE_TYPES,
} from "@/domain/professional-estimates/professional-resource-prices.service";
import { getProfessionalResourcePricesService } from "@/server/container";
import { VAT_TREATMENTS, TRANSPORT_TREATMENTS } from "@/domain/professional-estimates/procurement-semantics";
import {
  CompanyCalculationRuleSourceConflictError,
  ProfessionalRuleDefinitionValidationError,
} from "@/domain/professional-estimates/professional-rule-definitions.error";
import {
  ProfessionalCostComponentDecisionError,
  type SaveCostComponentDecisionInput,
} from "@/domain/professional-estimates/professional-cost-component-decisions.service";
import {
  getProfessionalCostComponentDecisionService,
  getProfessionalRuleDefinitionService,
  getProfessionalObjectEstimateService,
} from "@/server/container";
import {
  DuplicateProfessionalObjectEstimateEntryError,
} from "@/infrastructure/db/repositories/professionalObjectEstimate.repository";
import {
  LocalProfessionalEstimateNotFoundError,
  ProfessionalObjectEstimateNotFoundError,
  ProfessionalObjectEstimateValidationError,
} from "@/domain/professional-estimates/professional-object-estimate.service";

export type ProfessionalEstimateFormState =
  | { error: string }
  | null;

export type WorkQuantityItemFormState =
  | { error: string }
  | { success: string }
  | null;

export type NormLibraryFormState =
  | { error: string }
  | { success: string }
  | null;

export type ResourcePriceFormState =
  | { error: string }
  | { success: string }
  | null;

export type ProfessionalRuleFormState =
  | { error: string }
  | { success: string }
  | null;

export type ProfessionalObjectEstimateFormState =
  | { error: string }
  | { success: string }
  | null;

function revalidateObjectEstimateViews(): void {
  revalidatePath("/professional-estimates/[calculationContextId]", "page");
  revalidatePath("/professional-estimates/object-estimates");
  revalidatePath(
    "/professional-estimates/object-estimates/[objectEstimateId]",
    "page",
  );
}

function objectEstimateErrorState(
  error: unknown,
): ProfessionalObjectEstimateFormState {
  if (
    error instanceof ProfessionalObjectEstimateValidationError ||
    error instanceof ProfessionalObjectEstimateNotFoundError ||
    error instanceof LocalProfessionalEstimateNotFoundError ||
    error instanceof DuplicateProfessionalObjectEstimateEntryError
  ) {
    return { error: error.message };
  }
  throw error;
}
function errorState(error: unknown): ProfessionalEstimateFormState {
  if (
    error instanceof ProfessionalEstimateValidationError ||
    error instanceof DuplicateConstructionObjectCodeError
  ) {
    return { error: error.message };
  }
  throw error;
}

export async function createProfessionalEstimate(
  _previous: ProfessionalEstimateFormState,
  formData: FormData,
): Promise<ProfessionalEstimateFormState> {
  const { org } = await requireCurrentOrg();
  const service = getProfessionalEstimateWorkspaceService();
  let calculationContextId: string;
  const currency = String(formData.get("currency") ?? "");
  if (!isSupportedCurrency(currency)) {
    return { error: "Moneda selectată nu este acceptată." };
  }
  try {
    calculationContextId = await service.createProfessionalEstimate(org.id, {
      name: String(formData.get("name") ?? ""),
      objectName: String(formData.get("objectName") ?? ""),
      listName: String(formData.get("listName") ?? ""),
      valuationDate: String(formData.get("valuationDate") ?? ""),
      currency,
      objectCode: String(formData.get("objectCode") ?? ""),
      objectAddress: String(formData.get("objectAddress") ?? ""),
      objectDescription: String(formData.get("objectDescription") ?? ""),
      sourceReference: String(formData.get("sourceReference") ?? ""),
      sourceDate: String(formData.get("sourceDate") ?? ""),
    });
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/professional-estimates");
  revalidateObjectEstimateViews();
  redirect(`/professional-estimates/${calculationContextId}`);
}

export async function createWorkQuantityItem(
  calculationContextId: string,
  _previous: WorkQuantityItemFormState,
  formData: FormData,
): Promise<WorkQuantityItemFormState> {
  const { org } = await requireCurrentOrg();
  const positionNumber = Number(String(formData.get("positionNumber") ?? ""));
  try {
    await getProfessionalEstimateWorkspaceService().createWorkQuantityItem(
      org.id,
      calculationContextId,
      {
        positionNumber,
        code: String(formData.get("code") ?? ""),
        description: String(formData.get("description") ?? ""),
        unit: String(formData.get("unit") ?? ""),
        quantity: String(formData.get("quantity") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      },
    );
  } catch (error) {
    if (error instanceof DuplicateWorkPositionError) {
      return { error: error.message };
    }
    if (
      error instanceof ProfessionalEstimateValidationError ||
      error instanceof ProfessionalEstimateNotFoundError
    ) {
      return { error: error.message };
    }
    throw error;
  }
  revalidatePath(`/professional-estimates/${calculationContextId}`);
  revalidatePath("/professional-estimates");
  revalidateObjectEstimateViews();
  return { success: "Poziția de lucru a fost adăugată." };
}

export async function updateWorkQuantityItem(
  calculationContextId: string,
  itemId: string,
  _previous: WorkQuantityItemFormState,
  formData: FormData,
): Promise<WorkQuantityItemFormState> {
  const { org } = await requireCurrentOrg();
  try {
    await getProfessionalNormLibraryService().validateWorkItemUnitChange(
      org.id,
      calculationContextId,
      itemId,
      String(formData.get("unit") ?? ""),
    );
    await getProfessionalEstimateWorkspaceService().updateWorkQuantityItem(
      org.id,
      calculationContextId,
      itemId,
      {
        code: String(formData.get("code") ?? ""),
        description: String(formData.get("description") ?? ""),
        unit: String(formData.get("unit") ?? ""),
        quantity: String(formData.get("quantity") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      },
    );
  } catch (error) {
    if (
      error instanceof ProfessionalEstimateValidationError ||
      error instanceof ProfessionalEstimateNotFoundError
    ) {
      return { error: error.message };
    }
    if (error instanceof NormAssignmentValidationError) {
      return { error: error.message };
    }
    throw error;
  }
  revalidatePath(`/professional-estimates/${calculationContextId}`);
  revalidatePath("/professional-estimates");
  revalidateObjectEstimateViews();
  return { success: "Poziția de lucru a fost actualizată." };
}

function normLibraryErrorState(error: unknown): NormLibraryFormState {
  if (
    error instanceof ProfessionalNormLibraryValidationError ||
    error instanceof DuplicateInternalNormError ||
    error instanceof DuplicateNormResourceError ||
    error instanceof InternalNormIdentityConflictError ||
    error instanceof InternalNormSourceConflictError ||
    error instanceof NormAssignmentValidationError ||
    error instanceof NormLibraryRecordNotFoundError ||
    error instanceof NormVersionPublicationError
  ) {
    return { error: error.message };
  }
  throw error;
}

export async function createInternalNorm(
  _previous: NormLibraryFormState,
  formData: FormData,
): Promise<NormLibraryFormState> {
  const { org } = await requireCurrentOrg();
  try {
    const versionId = await getProfessionalNormLibraryService().createInternalNorm(
      org.id,
      {
        code: String(formData.get("code") ?? ""),
        name: String(formData.get("name") ?? ""),
        versionLabel: String(formData.get("versionLabel") ?? ""),
        basisQuantity: String(formData.get("basisQuantity") ?? ""),
        basisUnit: String(formData.get("basisUnit") ?? ""),
        category: String(formData.get("category") ?? ""),
        description: String(formData.get("description") ?? ""),
        validFrom: String(formData.get("validFrom") ?? ""),
        validTo: String(formData.get("validTo") ?? ""),
      },
    );
    revalidatePath("/professional-estimates/norms");
    redirect(`/professional-estimates/norms/${versionId}`);
  } catch (error) {
    return normLibraryErrorState(error);
  }
}

export async function addInternalNormResource(
  estimateNormVersionId: string,
  _previous: NormLibraryFormState,
  formData: FormData,
): Promise<NormLibraryFormState> {
  const { org } = await requireCurrentOrg();
  try {
    await getProfessionalNormLibraryService().addInternalNormResource(
      org.id,
      estimateNormVersionId,
      {
        code: String(formData.get("code") ?? ""),
        name: String(formData.get("name") ?? ""),
        resourceType: String(formData.get("resourceType") ?? ""),
        unit: String(formData.get("unit") ?? ""),
        quantityPerNormBasis: String(
          formData.get("quantityPerNormBasis") ?? "",
        ),
      },
    );
  } catch (error) {
    return normLibraryErrorState(error);
  }
  revalidatePath(`/professional-estimates/norms/${estimateNormVersionId}`);
  revalidatePath("/professional-estimates", "layout");
  revalidateObjectEstimateViews();
  return { success: "Resursa a fost adăugată la normă." };
}

export async function publishInternalNormVersion(
  estimateNormVersionId: string,
  _previous: NormLibraryFormState,
): Promise<NormLibraryFormState> {
  void _previous;
  const { org } = await requireCurrentOrg();
  try {
    await getProfessionalNormLibraryService().publishInternalNormVersion(
      org.id,
      estimateNormVersionId,
    );
  } catch (error) {
    return normLibraryErrorState(error);
  }
  revalidatePath(`/professional-estimates/norms/${estimateNormVersionId}`);
  revalidatePath("/professional-estimates/norms");
  revalidatePath("/professional-estimates");
  revalidateObjectEstimateViews();
  return { success: "Norma internă a fost publicată pentru utilizare." };
}

export async function assignNormToWorkItem(
  calculationContextId: string,
  workQuantityItemId: string,
  _previous: WorkQuantityItemFormState,
  formData: FormData,
): Promise<WorkQuantityItemFormState> {
  const { org } = await requireCurrentOrg();
  try {
    await getProfessionalNormLibraryService().assignNorm(
      org.id,
      calculationContextId,
      workQuantityItemId,
      String(formData.get("estimateNormVersionId") ?? ""),
    );
  } catch (error) {
    if (
      error instanceof NormAssignmentValidationError ||
      error instanceof NormLibraryRecordNotFoundError
    ) {
      return { error: error.message };
    }
    throw error;
  }
  revalidatePath(`/professional-estimates/${calculationContextId}`);
  revalidatePath("/professional-estimates");
  revalidateObjectEstimateViews();
  return { success: "Norma a fost alocată poziției." };
}

export async function createProfessionalResourcePrice(
  resourceId: string,
  _previous: ResourcePriceFormState,
  formData: FormData,
): Promise<ResourcePriceFormState> {
  const { org } = await requireCurrentOrg();
  const currencyValue = String(formData.get("currency") ?? "");
  if (!isSupportedCurrency(currencyValue)) {
    return { error: "Moneda selectată nu este acceptată." };
  }
  const sourceTypeValue = String(formData.get("sourceType") ?? "");
  const sourceType = RESOURCE_PRICE_SOURCE_TYPES.find(
    (value) => value === sourceTypeValue,
  );
  if (!sourceType) {
    return { error: "Tipul sursei nu este valid." };
  }
  const vatTreatment = VAT_TREATMENTS.find((value) => value === formData.get("vatTreatment"));
  const transportTreatment = TRANSPORT_TREATMENTS.find((value) => value === formData.get("transportTreatment"));
  if (!vatTreatment || !transportTreatment) {
    return { error: "Selectați tratamentul TVA și al transportului în preț." };
  }
  try {
    await getProfessionalResourcePricesService().createResourcePrice(
      org.id,
      resourceId,
      {
        price: String(formData.get("price") ?? ""),
        basisQuantity: String(formData.get("basisQuantity") ?? ""),
        currency: currencyValue,
        validFrom: String(formData.get("validFrom") ?? ""),
        validTo: String(formData.get("validTo") ?? ""),
        sourceType,
        sourceReference: String(formData.get("sourceReference") ?? ""),
        location: String(formData.get("location") ?? ""),
        vatTreatment,
        transportTreatment,
      },
    );
  } catch (error) {
    if (
      error instanceof ProfessionalResourcePriceValidationError ||
      error instanceof ProfessionalResourcePriceNotFoundError
    ) {
      return { error: error.message };
    }
    throw error;
  }
  revalidatePath(`/professional-estimates/resources/${resourceId}`);
  revalidatePath("/professional-estimates/resources");
  revalidatePath("/professional-estimates", "layout");
  revalidateObjectEstimateViews();
  return { success: "Prețul resursei a fost adăugat." };
}

export async function updateCalculationContext(
  contextId: string, _previous: ResourcePriceFormState, formData: FormData,
): Promise<ResourcePriceFormState> {
  const { org } = await requireCurrentOrg();
  try {
    await getProfessionalEstimateWorkspaceService().updateCalculationContext(org.id, contextId, {
      estimatePerspective: String(formData.get("estimatePerspective") ?? ""),
      workKind: String(formData.get("workKind") ?? ""),
    });
  } catch (error) {
    if (error instanceof ProfessionalEstimateValidationError || error instanceof ProfessionalEstimateNotFoundError) {
      return { error: error.message };
    }
    throw error;
  }
  revalidatePath(`/professional-estimates/${contextId}`);
  revalidateObjectEstimateViews();
  return { success: "Contextul de calcul a fost salvat." };
}

export async function updateResourceProcurementCategory(
  resourceId: string, _previous: ResourcePriceFormState, formData: FormData,
): Promise<ResourcePriceFormState> {
  const { org } = await requireCurrentOrg();
  try {
    await getProfessionalResourcePricesService().updateProcurementCategory(
      org.id, resourceId, String(formData.get("procurementCategory") ?? ""),
    );
  } catch (error) {
    if (error instanceof ProfessionalResourcePriceValidationError || error instanceof ProfessionalResourcePriceNotFoundError) {
      return { error: error.message };
    }
    throw error;
  }
  revalidatePath("/professional-estimates", "layout");
  revalidateObjectEstimateViews();
  return { success: "Categoria resursei a fost salvată." };
}

export async function updateResourcePriceSemantics(
  resourceId: string, priceId: string, _previous: ResourcePriceFormState, formData: FormData,
): Promise<ResourcePriceFormState> {
  const { org } = await requireCurrentOrg();
  try {
    await getProfessionalResourcePricesService().updatePriceSemantics(org.id, resourceId, priceId, {
      vatTreatment: String(formData.get("vatTreatment") ?? ""),
      transportTreatment: String(formData.get("transportTreatment") ?? ""),
    });
  } catch (error) {
    if (error instanceof ProfessionalResourcePriceValidationError || error instanceof ProfessionalResourcePriceNotFoundError) {
      return { error: error.message };
    }
    throw error;
  }
  revalidatePath("/professional-estimates", "layout");
  revalidateObjectEstimateViews();
  return { success: "Clasificarea prețului a fost salvată." };
}

export async function closeResourcePriceValidity(
  resourceId: string, priceId: string, _previous: ResourcePriceFormState, formData: FormData,
): Promise<ResourcePriceFormState> {
  const { org } = await requireCurrentOrg();
  try {
    await getProfessionalResourcePricesService().closeResourcePriceValidity(
      org.id, resourceId, priceId, String(formData.get("validTo") ?? ""),
    );
  } catch (error) {
    if (error instanceof ProfessionalResourcePriceValidationError || error instanceof ProfessionalResourcePriceNotFoundError) {
      return { error: error.message };
    }
    throw error;
  }
  revalidatePath(`/professional-estimates/resources/${resourceId}`);
  revalidatePath("/professional-estimates/resources");
  revalidatePath("/professional-estimates", "layout");
  revalidateObjectEstimateViews();
  return { success: "Data de încheiere a valabilității a fost salvată." };
}

export async function createCompanyProfessionalRule(
  _previous: ProfessionalRuleFormState,
  formData: FormData,
): Promise<ProfessionalRuleFormState> {
  const { org } = await requireCurrentOrg();
  const component = String(formData.get("component") ?? "");
  const semantic = String(formData.get("semantic") ?? "");
  let valueType: "percent" | "fixed_amount";
  let calculationBasis: "labor_cost" | "material_cost" | "fixed_amount" | "direct_cost" | "estimate_cost_before_profit";

  if (component === "labor_contributions" && semantic === "labor_percent") {
    valueType = "percent";
    calculationBasis = "labor_cost";
  } else if (component === "material_transport" && semantic === "material_percent") {
    valueType = "percent";
    calculationBasis = "material_cost";
  } else if (component === "material_transport" && semantic === "fixed_amount") {
    valueType = "fixed_amount";
    calculationBasis = "fixed_amount";
  } else if (component === "overhead" && semantic === "overhead_direct") {
    valueType = "percent";
    calculationBasis = "direct_cost";
  } else if (component === "overhead" && semantic === "overhead_labor") {
    valueType = "percent";
    calculationBasis = "labor_cost";
  } else if (component === "estimated_profit" && semantic === "profit_percent") {
    valueType = "percent";
    calculationBasis = "estimate_cost_before_profit";
  } else {
    return { error: "Selectați o combinație validă pentru componenta aleasă." };
  }

  try {
    await getProfessionalRuleDefinitionService().createCompanyRuleDefinition(
      org.id,
      {
        name: String(formData.get("name") ?? ""),
        component: component as SaveCostComponentDecisionInput["component"],
        valueType,
        value: String(formData.get("value") ?? ""),
        currency:
          valueType === "fixed_amount"
            ? String(formData.get("currency") ?? "")
            : null,
        calculationBasis,
        validFrom: String(formData.get("validFrom") ?? ""),
        validTo: String(formData.get("validTo") ?? "") || null,
        estimatePerspective: String(formData.get("estimatePerspective") ?? "") as
          | "investor"
          | "contractor"
          | "any",
        workKind: String(formData.get("workKind") ?? "") as
          | "construction"
          | "installation"
          | "commissioning"
          | "any",
        sourceReference: String(formData.get("sourceReference") ?? "") || null,
        notes: String(formData.get("notes") ?? "") || null,
      },
    );
  } catch (error) {
    if (error instanceof CompanyCalculationRuleSourceConflictError) {
      return { error: error.message };
    }
    if (error instanceof ProfessionalRuleDefinitionValidationError) {
      return { error: "Verificați denumirea, valoarea, valabilitatea și semantica regulii." };
    }
    throw error;
  }
  revalidatePath("/professional-estimates/rules");
  revalidateObjectEstimateViews();
  return { success: "Regula internă a companiei a fost salvată." };
}

export async function saveProfessionalCostComponentDecision(
  calculationContextId: string,
  _previous: WorkQuantityItemFormState,
  formData: FormData,
): Promise<WorkQuantityItemFormState> {
  const { org } = await requireCurrentOrg();
  try {
    const workspace =
      await getProfessionalEstimateWorkspaceService().getProfessionalEstimate(
        org.id,
        calculationContextId,
      );
    await getProfessionalCostComponentDecisionService().saveDecision(
      org.id,
      calculationContextId,
      {
        valuationDate: workspace.context.valuationDate,
        currency: workspace.context.currency,
        estimatePerspective: workspace.context.estimatePerspective,
        workKind: workspace.context.workKind,
      },
      {
        component: String(formData.get("component") ?? "") as
          SaveCostComponentDecisionInput["component"],
        decision: String(formData.get("decision") ?? "") as
          SaveCostComponentDecisionInput["decision"],
        professionalRuleDefinitionId:
          String(formData.get("professionalRuleDefinitionId") ?? "") || null,
        reason: String(formData.get("reason") ?? ""),
      },
    );
  } catch (error) {
    if (
      error instanceof ProfessionalCostComponentDecisionError ||
      error instanceof ProfessionalEstimateNotFoundError
    ) {
      return { error: error.message };
    }
    return errorState(error);
  }
  revalidatePath(`/professional-estimates/${calculationContextId}`);
  revalidateObjectEstimateViews();
  return { success: "Decizia componentei a fost salvată." };
}

export async function createProfessionalObjectEstimate(
  _previous: ProfessionalObjectEstimateFormState,
  formData: FormData,
): Promise<ProfessionalObjectEstimateFormState> {
  const { org } = await requireCurrentOrg();
  const currency = String(formData.get("currency") ?? "");
  if (!isSupportedCurrency(currency)) {
    return { error: "Moneda selectată nu este acceptată." };
  }
  let objectEstimateId: string;
  try {
    objectEstimateId = await getProfessionalObjectEstimateService().create(
      org.id,
      {
        constructionObjectId: String(formData.get("constructionObjectId") ?? ""),
        name: String(formData.get("name") ?? ""),
        code: String(formData.get("code") ?? ""),
        valuationDate: String(formData.get("valuationDate") ?? ""),
        currency,
        notes: String(formData.get("notes") ?? ""),
      },
    );
  } catch (error) {
    return objectEstimateErrorState(error);
  }
  revalidateObjectEstimateViews();
  redirect(`/professional-estimates/object-estimates/${objectEstimateId}`);
}

export async function addProfessionalObjectEstimateEntry(
  objectEstimateId: string,
  _previous: ProfessionalObjectEstimateFormState,
  formData: FormData,
): Promise<ProfessionalObjectEstimateFormState> {
  const { org } = await requireCurrentOrg();
  try {
    await getProfessionalObjectEstimateService().addEntry(
      org.id,
      objectEstimateId,
      String(formData.get("calculationContextId") ?? ""),
      String(formData.get("costCategory") ?? ""),
    );
  } catch (error) {
    return objectEstimateErrorState(error);
  }
  revalidateObjectEstimateViews();
  return { success: "Devizul local a fost asociat." };
}

export async function updateProfessionalObjectEstimateEntry(
  objectEstimateId: string,
  entryId: string,
  _previous: ProfessionalObjectEstimateFormState,
  formData: FormData,
): Promise<ProfessionalObjectEstimateFormState> {
  const { org } = await requireCurrentOrg();
  const includedValue = formData.get("included");
  const included =
    includedValue === null
      ? undefined
      : includedValue === "true"
        ? true
        : includedValue === "false"
          ? false
          : null;
  if (included === null) {
    return { error: "Starea includerii nu este validă." };
  }
  const categoryValue = String(formData.get("costCategory") ?? "");
  try {
    await getProfessionalObjectEstimateService().updateEntry(
      org.id,
      objectEstimateId,
      entryId,
      {
        included,
        costCategory: categoryValue || undefined,
      },
    );
  } catch (error) {
    return objectEstimateErrorState(error);
  }
  revalidateObjectEstimateViews();
  return { success: "Poziția devizului pe obiect a fost actualizată." };
}
