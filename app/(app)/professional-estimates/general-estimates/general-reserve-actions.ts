"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { ProfessionalGeneralReserveError } from "@/domain/professional-estimates/professional-general-reserve.service";
import { getProfessionalGeneralReserveService } from "@/server/container";
import type { GeneralReserveCategory } from "@/domain/professional-estimates/calculation";

export type GeneralReserveFormState = { error: string } | { success: string } | null;

export async function saveGeneralReserveDecision(
  generalEstimateId: string,
  _previous: GeneralReserveFormState,
  formData: FormData,
): Promise<GeneralReserveFormState> {
  const { org } = await requireCurrentOrg();
  try {
    await getProfessionalGeneralReserveService().saveDecision(
      org.id, generalEstimateId,
      {
        category: String(formData.get("category") ?? "") as GeneralReserveCategory,
        applicabilityDecisionId: String(formData.get("applicabilityDecisionId") ?? ""),
        basisNote: String(formData.get("basisNote") ?? ""),
      },
    );
    revalidatePath(`/professional-estimates/general-estimates/${generalEstimateId}`);
    return { success: "Categoria și temeiul rezervei au fost salvate." };
  } catch (error) {
    if (error instanceof ProfessionalGeneralReserveError) {
      return { error: error.message };
    }
    throw error;
  }
}
