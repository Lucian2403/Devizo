"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProfessionalSdncService } from "@/server/container";
import { ProfessionalSdncError } from "@/domain/professional-estimates/professional-sdnc.service";
import { SdncCalculationError } from "@/domain/professional-estimates/calculation";

export type SdncFormState = { error: string } | { success: string } | null;

export async function saveSdncDecision(
  generalEstimateId: string,
  _previous: SdncFormState,
  formData: FormData,
): Promise<SdncFormState> {
  const { org } = await requireCurrentOrg();
  const text = (field: string) => String(formData.get(field) ?? "");
  try {
    await getProfessionalSdncService().saveDecision(org.id, generalEstimateId, {
      fiscalYear: text("fiscalYear"),
      mode: text("mode"),
      workKind: text("workKind"),
      permitConfirmed: formData.get("permitConfirmed") === "on",
      nonPublicFundingConfirmed: formData.get("nonPublicFundingConfirmed") === "on",
      notExemptHouseConfirmed: formData.get("notExemptHouseConfirmed") === "on",
      annualEligibleInvestmentMdl: text("annualEligibleInvestmentMdl"),
      supportingDocument: text("supportingDocument"),
      exclusionReason: text("exclusionReason"),
      basisNote: text("basisNote"),
    });
    revalidatePath(`/professional-estimates/general-estimates/${generalEstimateId}`);
    return { success: "Decizia SDNC pentru 2026 a fost salvată." };
  } catch (error) {
    if (error instanceof ProfessionalSdncError || error instanceof SdncCalculationError) {
      return { error: error.message };
    }
    throw error;
  }
}
