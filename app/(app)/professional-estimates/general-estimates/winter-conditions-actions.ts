"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { ProfessionalWinterRulesError } from "@/domain/professional-estimates/professional-winter-rules.service";
import { ProfessionalWinterConditionsError } from "@/domain/professional-estimates/professional-winter-conditions.service";
import {
  getProfessionalWinterConditionsService,
  getProfessionalWinterRulesService,
} from "@/server/container";

export type WinterFormState = { error: string } | { success: string } | null;

function refresh(generalEstimateId: string) {
  revalidatePath("/professional-estimates/general-estimates");
  revalidatePath(`/professional-estimates/general-estimates/${generalEstimateId}`);
}

function handleError(error: unknown): WinterFormState {
  if (error instanceof ProfessionalWinterRulesError ||
    error instanceof ProfessionalWinterConditionsError) {
    return { error: error.message };
  }
  throw error;
}

export async function installWinterRulePack(
  generalEstimateId: string, _previous: WinterFormState, data: FormData,
): Promise<WinterFormState> {
  const { org } = await requireCurrentOrg();
  try {
    const result = await getProfessionalWinterRulesService().installRulePack({
      organizationId: org.id,
      sourceId: String(data.get("sourceId") ?? ""),
      applicabilityDecisionId: String(data.get("applicabilityDecisionId") ?? ""),
    });
    refresh(generalEstimateId);
    return {
      success: `Pachet verificat: ${result.created} reguli noi, ${result.reused} reutilizate, ${result.rebound} actualizări de proveniență din ${result.expected}.`,
    };
  } catch (error) {
    return handleError(error);
  }
}

export async function saveWinterDecision(
  generalEstimateId: string, _previous: WinterFormState, data: FormData,
): Promise<WinterFormState> {
  const { org } = await requireCurrentOrg();
  try {
    const mode = String(data.get("mode") ?? "");
    if (mode === "not_applicable") {
      await getProfessionalWinterConditionsService().saveDecision(
        org.id, generalEstimateId,
        { mode: "not_applicable", exclusionReason: "heated_current_repair" },
      );
    } else if (mode === "normative_rate") {
      const periodKind = String(data.get("periodKind") ?? "");
      if (periodKind !== "annual_average" && periodKind !== "short_project") {
        return { error: "Selectați metoda de calcul pentru perioada lucrărilor." };
      }
      await getProfessionalWinterConditionsService().saveDecision(
        org.id, generalEstimateId,
        {
          mode: "normative_rate",
          ruleDefinitionId: String(data.get("ruleDefinitionId") ?? ""),
          buildingScope: String(data.get("buildingScope") ?? "") as "residential_administrative" | "other",
          principalWorkConfirmed: data.get("principalWorkConfirmed") === "on",
          classification: String(data.get("classification") ?? "") as "listed" | "analogous",
          analogyReference: String(data.get("analogyReference") ?? ""),
          period: periodKind === "annual_average"
            ? { kind: "annual_average" }
            : {
                kind: "short_project",
                startDate: String(data.get("startDate") ?? ""),
                endDate: String(data.get("endDate") ?? ""),
                winterDays: String(data.get("winterDays") ?? ""),
                projectReference: String(data.get("projectReference") ?? ""),
              },
        },
      );
    } else {
      return { error: "Selectați explicit metoda pentru timp friguros." };
    }

    refresh(generalEstimateId);
    return { success: "Decizia privind lucrările pe timp friguros a fost salvată." };
  } catch (error) {
    return handleError(error);
  }
}
