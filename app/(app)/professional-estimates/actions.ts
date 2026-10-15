"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DuplicateWorkPositionError,
} from "@/domain/professional-estimates/professional-estimate-workspace.repository";
import {
  ProfessionalEstimateNotFoundError,
  ProfessionalEstimateValidationError,
} from "@/domain/professional-estimates/professional-estimate-workspace.service";
import { isSupportedCurrency } from "@/domain/shared/types";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProfessionalEstimateWorkspaceService } from "@/server/container";

export type ProfessionalEstimateFormState =
  | { error: string }
  | null;

export type WorkQuantityItemFormState =
  | { error: string }
  | { success: string }
  | null;

function errorState(error: unknown): ProfessionalEstimateFormState {
  if (error instanceof ProfessionalEstimateValidationError) {
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
    throw error;
  }
  revalidatePath(`/professional-estimates/${calculationContextId}`);
  revalidatePath("/professional-estimates");
  return { success: "Poziția de lucru a fost actualizată." };
}
