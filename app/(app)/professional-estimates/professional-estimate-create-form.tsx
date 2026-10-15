"use client";

import { useActionState } from "react";
import type { SupportedCurrency } from "@/domain/shared/types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ProfessionalEstimateFormState } from "./actions";

export function ProfessionalEstimateCreateForm({
  action,
  currencies,
}: {
  action: (
    state: ProfessionalEstimateFormState,
    formData: FormData,
  ) => Promise<ProfessionalEstimateFormState>;
  currencies: readonly SupportedCurrency[];
}) {
  const [state, formAction] = useActionState<ProfessionalEstimateFormState, FormData>(
    action,
    null,
  );

  return (
    <Card>
      <form action={formAction}>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="name">Denumirea devizului</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="objectName">Denumirea obiectului</Label>
            <Input id="objectName" name="objectName" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="listName">Denumirea listei de cantități</Label>
            <Input id="listName" name="listName" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="valuationDate">Data evaluării</Label>
              <Input id="valuationDate" name="valuationDate" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Moneda</Label>
              <select
                id="currency"
                name="currency"
                required
                defaultValue=""
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Selectați moneda
                </option>
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="border-t pt-4">
            <h2 className="mb-3 text-sm font-semibold text-heading">
              Detalii opționale
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="objectCode">Cod obiect</Label>
                <Input id="objectCode" name="objectCode" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="objectAddress">Adresa obiectului</Label>
                <Input id="objectAddress" name="objectAddress" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="objectDescription">Descriere / note obiect</Label>
                <Input id="objectDescription" name="objectDescription" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sourceReference">
                  Referința sursei listei de cantități
                </Label>
                <Input id="sourceReference" name="sourceReference" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sourceDate">Data sursei</Label>
                <Input id="sourceDate" name="sourceDate" type="date" />
              </div>
            </div>
          </div>
          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <SubmitButton pendingLabel="Se creează...">
            Creează devizul
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
