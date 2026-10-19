"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  RESOURCE_PRICE_SOURCE_TYPES,
  type ResourcePriceSourceType,
} from "@/domain/professional-estimates/professional-resource-prices.service";
import type { SupportedCurrency } from "@/domain/shared/types";
import type { ResourcePriceFormState } from "../actions";
import { PriceSemanticsFields } from "../semantics-forms";

const sourceTypeLabels: Record<ResourcePriceSourceType, string> = {
  manual: "Manual",
  supplier: "Furnizor",
  invoice: "Factură",
  market: "Piață",
  import: "Import",
};

export function CreateResourcePriceForm({
  action,
  currencies,
  defaultDate,
}: {
  action: (
    state: ResourcePriceFormState,
    formData: FormData,
  ) => Promise<ResourcePriceFormState>;
  currencies: readonly SupportedCurrency[];
  defaultDate: string;
}) {
  const [state, formAction] = useActionState<ResourcePriceFormState, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="resource-price">Preț</Label>
        <Input
          id="resource-price"
          name="price"
          type="text"
          inputMode="decimal"
          placeholder="ex. 1200"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="resource-price-basis">Cantitate de bază</Label>
        <Input
          id="resource-price-basis"
          name="basisQuantity"
          type="text"
          inputMode="decimal"
          defaultValue="1"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="resource-price-currency">Monedă</Label>
        <select
          id="resource-price-currency"
          name="currency"
          defaultValue="MDL"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {currencies.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="resource-price-valid-from">Valabil de la</Label>
        <Input
          id="resource-price-valid-from"
          name="validFrom"
          type="date"
          defaultValue={defaultDate}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="resource-price-valid-to">Valabil până la (opțional)</Label>
        <Input
          id="resource-price-valid-to"
          name="validTo"
          type="date"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="resource-price-source-type">Tip sursă</Label>
        <select
          id="resource-price-source-type"
          name="sourceType"
          defaultValue="manual"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {RESOURCE_PRICE_SOURCE_TYPES.map((sourceType) => (
            <option key={sourceType} value={sourceType}>
              {sourceTypeLabels[sourceType]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="resource-price-source-reference">
          Referință sursă (opțional)
        </Label>
        <Input
          id="resource-price-source-reference"
          name="sourceReference"
          maxLength={300}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="resource-price-location">
          Localitate / regiune (opțional)
        </Label>
        <Input id="resource-price-location" name="location" maxLength={300} />
      </div>
      <PriceSemanticsFields id="new-price" />
      <div className="space-y-3 sm:col-span-2">
        {state && "error" in state && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state && "success" in state && (
          <p role="status" className="text-sm text-emerald-700">
            {state.success}
          </p>
        )}
        <SubmitButton pendingLabel="Se salvează...">Adaugă prețul</SubmitButton>
      </div>
    </form>
  );
}
