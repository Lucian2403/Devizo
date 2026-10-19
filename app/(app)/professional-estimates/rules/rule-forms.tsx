"use client";

import { useActionState } from "react";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import type { PersistedCostComponent } from "@/domain/professional-estimates/professional-cost-component-decisions.repository";
import type { ProfessionalRuleFormState } from "../actions";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function CreateCompanyRuleForm({
  action,
  component,
}: {
  action: (
    state: ProfessionalRuleFormState,
    formData: FormData,
  ) => Promise<ProfessionalRuleFormState>;
  component: PersistedCostComponent;
}) {
  const [state, formAction] = useActionState<ProfessionalRuleFormState, FormData>(
    action,
    null,
  );
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="component" value={component} />
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${component}-name`}>Denumire</Label>
        <Input id={`${component}-name`} name="name" required maxLength={200} />
      </div>
      {component === "material_transport" && (
        <div className="space-y-2">
          <Label htmlFor={`${component}-semantic`}>Tipul valorii</Label>
          <select
            id={`${component}-semantic`}
            name="semantic"
            required
            defaultValue="material_percent"
            className={selectClass}
          >
            <option value="material_percent">Procent din costul materialelor</option>
            <option value="fixed_amount">Sumă fixă</option>
          </select>
        </div>
      )}
      {component === "overhead" && (
        <div className="space-y-2">
          <Label htmlFor={`${component}-semantic`}>Baza procentului</Label>
          <select
            id={`${component}-semantic`}
            name="semantic"
            required
            defaultValue=""
            className={selectClass}
          >
            <option value="" disabled>Selectați baza explicit</option>
            <option value="overhead_direct">Cost direct</option>
            <option value="overhead_labor">Costul manoperei</option>
          </select>
        </div>
      )}
      {(component === "labor_contributions" ||
        component === "estimated_profit") && (
        <input
          type="hidden"
          name="semantic"
          value={
            component === "labor_contributions"
              ? "labor_percent"
              : "profit_percent"
          }
        />
      )}
      <div className="space-y-2">
        <Label htmlFor={`${component}-value`}>
          {component === "material_transport"
            ? "Valoare"
            : "Valoare (%)"}
        </Label>
        <Input
          id={`${component}-value`}
          name="value"
          type="text"
          inputMode="decimal"
          required
        />
      </div>
      {component === "material_transport" && (
        <div className="space-y-2">
          <Label htmlFor={`${component}-currency`}>
            Monedă (obligatorie pentru sumă fixă)
          </Label>
          <select
            id={`${component}-currency`}
            name="currency"
            defaultValue=""
            className={selectClass}
          >
            <option value="">Fără monedă</option>
            {["MDL", "EUR", "RON", "USD", "GBP"].map((currency) => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={`${component}-valid-from`}>Valabilă de la</Label>
        <DateInput id={`${component}-valid-from`} name="validFrom" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${component}-valid-to`}>Valabilă până la (opțional)</Label>
        <DateInput id={`${component}-valid-to`} name="validTo" />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${component}-perspective`}>Perspectivă</Label>
        <select
          id={`${component}-perspective`}
          name="estimatePerspective"
          required
          defaultValue="investor"
          className={selectClass}
        >
          <option value="investor">Deviz investitor</option>
          <option value="contractor">Deviz antreprenor</option>
          <option value="any">Oricare</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${component}-work-kind`}>Tip lucrări</Label>
        <select
          id={`${component}-work-kind`}
          name="workKind"
          required
          defaultValue="construction"
          className={selectClass}
        >
          <option value="construction">Construcții</option>
          <option value="installation">Montaj</option>
          <option value="commissioning">Punere în funcțiune</option>
          <option value="any">Oricare</option>
        </select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${component}-source-reference`}>
          Referință internă (opțional)
        </Label>
        <Input id={`${component}-source-reference`} name="sourceReference" />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${component}-notes`}>Note (opțional)</Label>
        <textarea
          id={`${component}-notes`}
          name="notes"
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        {state && "error" in state && (
          <p role="alert" className="text-sm text-destructive">{state.error}</p>
        )}
        {state && "success" in state && (
          <p role="status" className="text-sm text-emerald-700">{state.success}</p>
        )}
        <SubmitButton pendingLabel="Se salvează...">Salvează regula internă</SubmitButton>
      </div>
    </form>
  );
}
