"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import {
  ProfessionalTemporaryWorksError,
} from "@/domain/professional-estimates/professional-temporary-works.service";
import { getProfessionalTemporaryWorksService } from "@/server/container";

export type TemporaryWorksFormState =
  | { error: string }
  | { success: string }
  | null;

function refreshGeneralEstimate(generalEstimateId: string): void {
  revalidatePath("/professional-estimates/general-estimates");
  revalidatePath(
    `/professional-estimates/general-estimates/${generalEstimateId}`,
  );
}

function formError(error: unknown): TemporaryWorksFormState {
  if (error instanceof ProfessionalTemporaryWorksError) {
    return { error: error.message };
  }
  throw error;
}

export async function installTemporaryWorksRulePack(
  generalEstimateId: string,
  _previous: TemporaryWorksFormState,
  formData: FormData,
): Promise<TemporaryWorksFormState> {
  const { org } = await requireCurrentOrg();
  try {
    const result = await getProfessionalTemporaryWorksService().installRulePack({
      organizationId: org.id,
      sourceId: String(formData.get("sourceId") ?? ""),
      applicabilityDecisionId: String(
        formData.get("applicabilityDecisionId") ?? "",
      ),
    });
    refreshGeneralEstimate(generalEstimateId);
    return {
      success: `Pachet verificat: ${result.created} reguli create, ${result.reused} reutilizate din ${result.expected}.`,
    };
  } catch (error) {
    return formError(error);
  }
}

export async function saveTemporaryWorksDecision(
  generalEstimateId: string,
  _previous: TemporaryWorksFormState,
  formData: FormData,
): Promise<TemporaryWorksFormState> {
  const { org } = await requireCurrentOrg();
  const mode = String(formData.get("mode") ?? "");

  try {
    if (mode === "normative_rate") {
      await getProfessionalTemporaryWorksService().saveDecision(
        org.id,
        generalEstimateId,
        {
          mode,
          ruleDefinitionId: String(formData.get("ruleDefinitionId") ?? ""),
          projectCondition: String(formData.get("projectCondition") ?? ""),
        },
      );
    } else if (mode === "project_calculation") {
      await getProfessionalTemporaryWorksService().saveDecision(
        org.id,
        generalEstimateId,
        {
          mode,
          projectConstructionAmount: String(
            formData.get("projectConstructionAmount") ?? "",
          ),
          projectInstallationAmount: String(
            formData.get("projectInstallationAmount") ?? "",
          ),
          projectReference: String(formData.get("projectReference") ?? ""),
        },
      );
    } else {
      return { error: "Selectați metoda de calcul." };
    }

    refreshGeneralEstimate(generalEstimateId);
    return { success: "Configurația pentru construcțiile provizorii a fost salvată." };
  } catch (error) {
    return formError(error);
  }
}
