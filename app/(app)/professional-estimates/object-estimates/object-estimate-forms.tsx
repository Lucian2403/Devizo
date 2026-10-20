"use client";

import { useActionState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import type { SupportedCurrency } from "@/domain/shared/types";
import type { ProfessionalObjectEstimateView } from "@/domain/professional-estimates/professional-object-estimate.service";
import type { ProfessionalObjectEstimateFormState } from "../actions";

export function ObjectEstimateCreateForm({
  action,
  objects,
  currencies,
}: {
  action: (
    state: ProfessionalObjectEstimateFormState,
    formData: FormData,
  ) => Promise<ProfessionalObjectEstimateFormState>;
  objects: Array<{ id: string; name: string; code: string | null }>;
  currencies: readonly SupportedCurrency[];
}) {
  const [state, formAction] = useActionState<ProfessionalObjectEstimateFormState, FormData>(
    action,
    null,
  );
  return (
    <Card>
      <form action={formAction}>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="objectEstimateName">Denumirea devizului pe obiect</Label>
            <Input id="objectEstimateName" name="name" required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="constructionObjectId">Obiect</Label>
            <select
              id="constructionObjectId"
              name="constructionObjectId"
              required
              defaultValue=""
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="" disabled>Selectați obiectul</option>
              {objects.map((object) => (
                <option key={object.id} value={object.id}>
                  {object.code ? `${object.code} · ` : ""}{object.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="objectEstimateCode">Cod (opțional)</Label>
            <Input id="objectEstimateCode" name="code" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="objectEstimateDate">Data evaluării</Label>
            <DateInput id="objectEstimateDate" name="valuationDate" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="objectEstimateCurrency">Monedă</Label>
            <select
              id="objectEstimateCurrency"
              name="currency"
              required
              defaultValue=""
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="" disabled>Selectați moneda</option>
              {currencies.map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="objectEstimateNotes">Note (opțional)</Label>
            <textarea
              id="objectEstimateNotes"
              name="notes"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {state && "error" in state && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {state.error}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <SubmitButton pendingLabel="Se creează...">Creează devizul pe obiect</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}

const categories = [
  ["construction_works", "Lucrări de construcții"],
  ["installation_works", "Lucrări de montaj"],
  ["equipment_furniture_inventory", "Utilaj, mobilier și inventar"],
  ["other_costs", "Alte cheltuieli"],
] as const;

export function AddLocalEstimateForm({
  action,
  candidates,
}: {
  action: (
    state: ProfessionalObjectEstimateFormState,
    formData: FormData,
  ) => Promise<ProfessionalObjectEstimateFormState>;
  candidates: ProfessionalObjectEstimateView["candidates"];
}) {
  const [state, formAction] = useActionState<ProfessionalObjectEstimateFormState, FormData>(
    action,
    null,
  );
  const eligible = candidates.filter((candidate) => !candidate.linked && !candidate.eligibilityError);
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="localCalculationContext">Deviz local</Label>
          <select
            id="localCalculationContext"
            name="calculationContextId"
            required
            defaultValue=""
            disabled={eligible.length === 0}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="" disabled>Selectați devizul local</option>
            {candidates.map((candidate) => (
              <option
                key={candidate.calculationContextId}
                value={candidate.calculationContextId}
                disabled={candidate.linked || Boolean(candidate.eligibilityError)}
              >
                {candidate.name} · {candidate.valuationDate} · {candidate.currency}
                {candidate.linked ? " · deja asociat" : candidate.eligibilityError ? ` · ${candidate.eligibilityError}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="localCostCategory">Categorie de cheltuieli</Label>
          <select
            id="localCostCategory"
            name="costCategory"
            required
            defaultValue=""
            disabled={eligible.length === 0}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="" disabled>Selectați explicit categoria</option>
            {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>
      {candidates
        .filter((candidate) => !candidate.linked && candidate.eligibilityError)
        .map((candidate) => (
          <p
            key={candidate.calculationContextId}
            className="text-xs text-amber-800"
          >
            {candidate.name}: {candidate.eligibilityError}
          </p>
        ))}
      {state && "error" in state && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state && "success" in state && <p role="status" className="text-sm text-emerald-700">{state.success}</p>}
      <SubmitButton pendingLabel="Se adaugă..." disabled={eligible.length === 0}>
        Adaugă devizul local
      </SubmitButton>
    </form>
  );
}

export function ObjectEstimateEntryControls({
  action,
  entry,
}: {
  action: (
    state: ProfessionalObjectEstimateFormState,
    formData: FormData,
  ) => Promise<ProfessionalObjectEstimateFormState>;
  entry: ProfessionalObjectEstimateView["entries"][number];
}) {
  const [state, formAction] = useActionState<ProfessionalObjectEstimateFormState, FormData>(
    action,
    null,
  );
  return (
    <div className="space-y-2">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <select
          name="costCategory"
          aria-label="Categoria de cheltuieli"
          defaultValue={entry.costCategory}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <SubmitButton pendingLabel="Se salvează..." variant="outline" size="sm">
          Salvează categoria
        </SubmitButton>
      </form>
      <form action={formAction}>
        <input type="hidden" name="included" value={String(!entry.included)} />
        <SubmitButton
          pendingLabel="Se actualizează..."
          variant="outline"
          size="sm"
        >
          {entry.included ? "Exclude din devizul pe obiect" : "Include din nou"}
        </SubmitButton>
      </form>
      {state && "error" in state && <p role="alert" className="text-xs text-destructive">{state.error}</p>}
      {state && "success" in state && <p role="status" className="text-xs text-emerald-700">{state.success}</p>}
    </div>
  );
}
