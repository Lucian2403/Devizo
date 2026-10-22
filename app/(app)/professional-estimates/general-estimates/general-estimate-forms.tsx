"use client";

import { useActionState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatProfessionalResourceMoney } from "@/lib/ui/professional-resource-money";
import type { SupportedCurrency } from "@/domain/shared/types";
import {
  PROFESSIONAL_GENERAL_ESTIMATE_CHAPTERS,
} from "@/domain/professional-estimates/calculation";
import type { ProfessionalGeneralEstimateView } from "@/domain/professional-estimates/professional-general-estimate.service";
import type { ProfessionalObjectEstimateFormState } from "../actions";

export function GeneralEstimateCreateForm({
  action,
  currencies,
}: {
  action: (
    state: ProfessionalObjectEstimateFormState,
    formData: FormData,
  ) => Promise<ProfessionalObjectEstimateFormState>;
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
            <Label htmlFor="generalEstimateName">Denumire</Label>
            <Input id="generalEstimateName" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="generalEstimateCode">Cod (opțional)</Label>
            <Input id="generalEstimateCode" name="code" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="generalEstimateDate">Data evaluării</Label>
            <DateInput id="generalEstimateDate" name="valuationDate" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="generalEstimateCurrency">Monedă</Label>
            <select
              id="generalEstimateCurrency"
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
            <Label htmlFor="generalEstimateNotes">Note (opțional)</Label>
            <textarea
              id="generalEstimateNotes"
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
          <SubmitButton pendingLabel="Se creează...">Creează devizul general</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}

export function AddObjectEstimateForm({
  action,
  candidates,
}: {
  action: (
    state: ProfessionalObjectEstimateFormState,
    formData: FormData,
  ) => Promise<ProfessionalObjectEstimateFormState>;
  candidates: ProfessionalGeneralEstimateView["candidates"];
}) {
  const [state, formAction] = useActionState<ProfessionalObjectEstimateFormState, FormData>(
    action,
    null,
  );
  const eligible = candidates.filter(
    (candidate) => !candidate.linked && !candidate.eligibilityError,
  );
  return (
    <form action={formAction} className="space-y-3">
      {candidates.length > 0 && (
        <div className="space-y-2">
          {candidates.map((candidate) => (
            <div
              key={candidate.id}
              className="flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-md border px-3 py-2 text-xs"
            >
              <span className="font-medium">
                {candidate.name} · {candidate.constructionObjectName}
              </span>
              <span>{candidate.valuationDate} · {candidate.currency}</span>
              <span>
                {candidate.complete ? "Complet" : "Incomplet"}
                {candidate.total !== null
                  ? ` · ${formatProfessionalResourceMoney(candidate.total, candidate.currency)}`
                  : ""}
              </span>
              <span className={candidate.eligibilityError ? "text-destructive" : "text-muted-foreground"}>
                {candidate.linked
                  ? "Deja asociat"
                  : candidate.eligibilityError ?? (candidate.complete
                    ? "Eligibil"
                    : "Incomplet — va face devizul general incomplet")}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="objectEstimateId">Deviz pe obiect</Label>
          <select
            id="objectEstimateId"
            name="objectEstimateId"
            required
            defaultValue=""
            disabled={eligible.length === 0}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="" disabled>Selectați devizul pe obiect</option>
            {candidates.map((candidate) => (
              <option
                key={candidate.id}
                value={candidate.id}
                disabled={candidate.linked || Boolean(candidate.eligibilityError)}
              >
                {candidate.name} · {candidate.constructionObjectName} · {candidate.valuationDate} · {candidate.currency}
                {candidate.linked
                  ? " · deja asociat"
                  : candidate.eligibilityError
                    ? ` · ${candidate.eligibilityError}`
                    : candidate.complete
                      ? ""
                      : " · Incomplet — va face devizul general incomplet"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="generalEstimateChapter">Capitol</Label>
          <select
            id="generalEstimateChapter"
            name="chapterNumber"
            required
            defaultValue=""
            disabled={eligible.length === 0}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="" disabled>Selectați explicit capitolul</option>
            {PROFESSIONAL_GENERAL_ESTIMATE_CHAPTERS.map(({ number, label }) => (
              <option key={number} value={number}>Capitolul {number} — {label}</option>
            ))}
          </select>
        </div>
      </div>
      {candidates
        .filter((candidate) => !candidate.linked && !candidate.eligibilityError && !candidate.complete)
        .map((candidate) => (
          <p key={candidate.id} className="text-xs text-amber-800">
            {candidate.name}: Incomplet — va face devizul general incomplet.
          </p>
        ))}
      {state && "error" in state && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state && "success" in state && <p role="status" className="text-sm text-emerald-700">{state.success}</p>}
      <SubmitButton pendingLabel="Se adaugă..." disabled={eligible.length === 0}>
        Asociază devizul pe obiect
      </SubmitButton>
    </form>
  );
}

export function GeneralEstimateEntryControls({
  action,
  entry,
}: {
  action: (
    state: ProfessionalObjectEstimateFormState,
    formData: FormData,
  ) => Promise<ProfessionalObjectEstimateFormState>;
  entry: ProfessionalGeneralEstimateView["entries"][number];
}) {
  const [state, formAction] = useActionState<ProfessionalObjectEstimateFormState, FormData>(
    action,
    null,
  );
  return (
    <div className="space-y-2">
      <form
        key={`${entry.id}:${entry.chapterNumber}`}
        action={formAction}
        className="flex flex-wrap items-center gap-2"
      >
        <select
          name="chapterNumber"
          aria-label="Capitolul devizului pe obiect"
          required
          defaultValue={String(entry.chapterNumber)}
          className="h-9 max-w-56 rounded-md border border-input bg-background px-2 text-xs"
        >
          {PROFESSIONAL_GENERAL_ESTIMATE_CHAPTERS.map(({ number, label }) => (
            <option key={number} value={number}>Capitolul {number} — {label}</option>
          ))}
        </select>
        <SubmitButton size="sm" variant="outline" pendingLabel="Se salvează...">
          Salvează capitolul
        </SubmitButton>
      </form>
      <form action={formAction}>
        <input
          type="hidden"
          name="included"
          value={entry.included ? "false" : "true"}
        />
        <SubmitButton
          size="sm"
          variant="ghost"
          pendingLabel="Se actualizează..."
        >
          {entry.included ? "Exclude din devizul general" : "Include din nou"}
        </SubmitButton>
      </form>
      {state && "error" in state && <p role="alert" className="text-xs text-destructive">{state.error}</p>}
      {state && "success" in state && <p role="status" className="text-xs text-emerald-700">{state.success}</p>}
    </div>
  );
}
