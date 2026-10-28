"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { GENERAL_RESERVE_RATES, type GeneralReserveCategory } from "@/domain/professional-estimates/calculation";
import type { GeneralReserveView } from "@/domain/professional-estimates/professional-general-reserve.service";
import type { GeneralReserveFormState } from "./general-reserve-actions";

type FormAction = (state: GeneralReserveFormState, data: FormData) => Promise<GeneralReserveFormState>;

export function GeneralReserveForm({
  action, view,
}: { action: FormAction; view: GeneralReserveView }) {
  const [state, formAction] = useActionState<GeneralReserveFormState, FormData>(action, null);
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState(view.savedDecision?.category ?? "");

  function submitWithoutReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    startTransition(() => formAction(values));
  }

  const applicable = view.applicableDecision;
  return (
    <form action={formAction} onSubmit={submitWithoutReset} className="space-y-4">
      {view.source ? (
        <p className="text-sm text-muted-foreground">
          Sursă: {view.source.code}, ediția {view.source.edition}
          {applicable ? ` · decizie Aplicabilă, revizia ${applicable.revision}`
            : " · nu există o decizie normativă curentă Aplicabilă"}
        </p>
      ) : (
        <p className="text-sm text-amber-800">
          CP L.01.01-2012 lipsește din registrul companiei. Adăugați sursa
          în Bază normativă înainte de salvare.
        </p>
      )}
      <input type="hidden" name="applicabilityDecisionId" value={applicable?.id ?? ""} />
      <div className="space-y-2">
        <Label htmlFor="reserveCategory">Categoria investiției — CP L.01.01-2012, pct. 6.11</Label>
        <select id="reserveCategory" name="category" required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={category}
          onChange={(event) => setCategory(event.target.value as GeneralReserveCategory | "")}>
          <option value="" disabled>Selectați categoria, fără procent implicit</option>
          {Object.entries(GENERAL_RESERVE_RATES).map(([key, rule]) => (
            <option key={key} value={key}>{rule.label} — {rule.percent}%</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reserveBasis">Temeiul încadrării investiției</Label>
        <textarea id="reserveBasis" name="basisNote" required maxLength={4000} rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue={view.savedDecision?.basisNote ?? ""}
          placeholder="Ex.: destinația obiectivului și documentul care o confirmă" />
      </div>
      <p className="text-xs text-muted-foreground">
        Rezerva se adaugă după totalul capitolelor 1–12; nu este un cost nou în
        capitolul 9 și nu constituie automat o sumă transmisă antreprenorului.
      </p>
      {state && ("error" in state
        ? <p className="text-sm text-destructive" role="alert">{state.error}</p>
        : <p className="text-sm text-emerald-700" role="status">{state.success}</p>)}
      <SubmitButton loading={pending} pendingLabel="Se salvează..."
        disabled={pending || !applicable || !category}>
        {pending ? "Se salvează..." : "Salvează categoria rezervei"}
      </SubmitButton>
    </form>
  );
}
