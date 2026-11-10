"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import type { SdncView } from "@/domain/professional-estimates/professional-sdnc.service";
import type { SdncFormState } from "./sdnc-actions";

type FormAction = (state: SdncFormState, data: FormData) => Promise<SdncFormState>;
const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function SdncForm({
  action, view, valuationDate, reserveReady,
}: {
  action: FormAction;
  view: SdncView;
  valuationDate: string;
  reserveReady: boolean;
}) {
  const [state, formAction] = useActionState<SdncFormState, FormData>(action, null);
  const [pending, startTransition] = useTransition();
  const saved = view.savedDecision;
  const [mode, setMode] = useState(saved?.mode ?? "");
  const eligible = valuationDate.startsWith("2026-") && reserveReady;

  function submitWithoutReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    startTransition(() => formAction(values));
  }

  return (
    <form action={formAction} onSubmit={submitWithoutReset} className="space-y-4">
      <input type="hidden" name="fiscalYear" value="2026" />
      <p className="text-sm text-muted-foreground">
        Regim fiscal 2026 · cotă 0,5% · baza se justifică separat din
        investițiile anuale eligibile în capital fix (MDL).
      </p>
      <div className="space-y-2">
        <Label htmlFor="sdncMode">Aplicabilitatea contribuției</Label>
        <select id="sdncMode" name="mode" required value={mode}
          onChange={(event) => setMode(event.target.value)}
          className={selectClass} disabled={!eligible}>
          <option value="" disabled>Selectați explicit situația</option>
          <option value="liable">Se aplică — investiție eligibilă</option>
          <option value="not_liable">Nu se aplică — motiv documentat</option>
        </select>
      </div>

      {mode === "liable" && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <Label htmlFor="sdncWork">Tipul lucrărilor</Label>
            <select id="sdncWork" name="workKind" required className={selectClass}
              defaultValue={saved?.workKind ?? ""}>
              <option value="" disabled>Selectați tipul lucrării</option>
              <option value="new_construction">Construcție nouă</option>
              <option value="existing_intervention">Intervenție asupra construcției existente</option>
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="permitConfirmed" required className="mt-1"
              defaultChecked={saved?.permitConfirmed ?? false} />
            Confirm că lucrarea este supusă autorizării și că a fost emisă autorizația de construire.
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="nonPublicFundingConfirmed" required className="mt-1"
              defaultChecked={saved?.nonPublicFundingConfirmed ?? false} />
            Confirm că investiția declarată nu este finanțată din bugetul public național.
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="notExemptHouseConfirmed" required className="mt-1"
              defaultChecked={saved?.notExemptHouseConfirmed ?? false} />
            Confirm că nu este cazul unei case individuale pentru 1–2 familii,
            construite pentru uz personal de un investitor persoană fizică.
          </label>
          <div className="space-y-2">
            <Label htmlFor="sdncAnnualBase">Investiții anuale eligibile în capital fix (MDL, anul 2026)</Label>
            <input id="sdncAnnualBase" name="annualEligibleInvestmentMdl" required
              type="text" inputMode="decimal" className={inputClass}
              defaultValue={saved?.annualEligibleInvestmentMdl ?? ""}
              placeholder="Ex.: 1000000,00" />
            <p className="text-xs text-muted-foreground">
              Introduceți valoarea anuală justificată din evidențele investiției,
              nu totalul Devizului General și nici totalul cu rezervă.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sdncEvidence">Document justificativ pentru baza anuală</Label>
            <textarea id="sdncEvidence" name="supportingDocument" required rows={2}
              maxLength={4000} className={inputClass}
              defaultValue={saved?.supportingDocument ?? ""}
              placeholder="Situații de investiții / evidențe contabile, perioadă și referință" />
          </div>
        </div>
      )}

      {mode === "not_liable" && (
        <div className="space-y-2 rounded-lg border p-4">
          <Label htmlFor="sdncExclusion">Motivul neaplicabilității</Label>
          <select id="sdncExclusion" name="exclusionReason" required className={selectClass}
            defaultValue={saved?.exclusionReason ?? ""}>
            <option value="" disabled>Selectați motivul verificat</option>
            <option value="public_budget">Finanțare din bugetul public național</option>
            <option value="no_building_permit">Lucrare pentru care nu se emite autorizație de construire</option>
            <option value="personal_individual_house">Casă individuală pentru 1–2 familii, uz personal, investitor persoană fizică</option>
            <option value="outside_eligible_works">În afara tipurilor de construcții / intervenții eligibile</option>
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="sdncBasisNote">Justificarea deciziei și documentele consultate</Label>
        <textarea id="sdncBasisNote" name="basisNote" required rows={2} maxLength={4000}
          className={inputClass} defaultValue={saved?.basisNote ?? ""}
          placeholder="Ex.: autorizația, sursa finanțării, situația anuală de investiții..." />
      </div>
      <p className="text-xs text-muted-foreground">
        Calcul fiscal anual orientativ, distinct de Devizul General.
        Nu este o declarație DNTC25, nu modifică niciun capitol și nu
        majorează automat totalul cu rezervă.
      </p>
      {state && ("error" in state
        ? <p role="alert" className="text-sm text-destructive">{state.error}</p>
        : <p role="status" className="text-sm text-emerald-700">{state.success}</p>)}
      <SubmitButton loading={pending} pendingLabel="Se salvează..."
        disabled={pending || !eligible || !mode}>
        {pending ? "Se salvează..." : "Salvează decizia SDNC"}
      </SubmitButton>
    </form>
  );
}
