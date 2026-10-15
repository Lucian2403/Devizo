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
  InternalNormSourceConflictError,
  NormAssignmentValidationError,
  NormLibraryRecordNotFoundError,
  NormVersionPublicationError,
  ProfessionalNormLibraryValidationError,
} from "@/domain/professional-estimates/professional-norm-library.service";
import { getProfessionalNormLibraryService } from "@/server/container";

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
  return { success: "Poziția de lucru a fost actualizată." };
}

function normLibraryErrorState(error: unknown): NormLibraryFormState {
  if (
    error instanceof ProfessionalNormLibraryValidationError ||
    error instanceof DuplicateInternalNormError ||
    error instanceof DuplicateNormResourceError ||
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
  return { success: "Norma a fost alocată poziției." };
}
