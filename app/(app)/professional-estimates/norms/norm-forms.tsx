"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import type { NormAssignmentOption } from "@/domain/professional-estimates/professional-norm-library.service";
import type {
  NormLibraryFormState,
  WorkQuantityItemFormState,
} from "../actions";

function FormMessage({
  state,
}: {
  state: NormLibraryFormState | WorkQuantityItemFormState;
}) {
  if (state && "error" in state) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (state && "success" in state) {
    return (
      <p role="status" className="text-sm text-emerald-700">
        {state.success}
      </p>
    );
  }
  return null;
}

export function CreateInternalNormForm({
  action,
}: {
  action: (
    state: NormLibraryFormState,
    formData: FormData,
  ) => Promise<NormLibraryFormState>;
}) {
  const [state, formAction] = useActionState<NormLibraryFormState, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="norm-code">Cod normă</Label>
        <Input id="norm-code" name="code" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="norm-version">Versiune</Label>
        <Input id="norm-version" name="versionLabel" required />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="norm-name">Denumire</Label>
        <Input id="norm-name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="norm-basis-quantity">Cantitatea de bază</Label>
        <Input
          id="norm-basis-quantity"
          name="basisQuantity"
          type="text"
          inputMode="decimal"
          placeholder="ex. 100"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="norm-basis-unit">UM bază</Label>
        <Input id="norm-basis-unit" name="basisUnit" placeholder="ex. m²" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="norm-category">Categorie (opțional)</Label>
        <Input id="norm-category" name="category" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="norm-valid-from">Valabilă de la (opțional)</Label>
        <DateInput id="norm-valid-from" name="validFrom" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="norm-valid-to">Valabilă până la (opțional)</Label>
        <DateInput id="norm-valid-to" name="validTo" />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="norm-description">Descriere (opțional)</Label>
        <textarea
          id="norm-description"
          name="description"
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-3 sm:col-span-2">
        <FormMessage state={state} />
        <SubmitButton pendingLabel="Se creează...">
          Creează norma internă
        </SubmitButton>
      </div>
    </form>
  );
}

export function AddNormResourceForm({
  action,
  basisLabel,
}: {
  action: (
    state: NormLibraryFormState,
    formData: FormData,
  ) => Promise<NormLibraryFormState>;
  basisLabel: string;
}) {
  const [state, formAction] = useActionState<NormLibraryFormState, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="resource-code">Cod resursă (opțional)</Label>
        <Input id="resource-code" name="code" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="resource-name">Resursă</Label>
        <Input id="resource-name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="resource-type">Tip</Label>
        <select
          id="resource-type"
          name="resourceType"
          defaultValue="labor"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="labor">Manoperă</option>
          <option value="material">Material</option>
          <option value="machinery">Utilaj</option>
          <option value="transport">Transport</option>
          <option value="energy">Energie</option>
          <option value="other">Altele</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="resource-unit">UM</Label>
        <Input id="resource-unit" name="unit" required />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="resource-consumption">Consum / {basisLabel}</Label>
        <Input
          id="resource-consumption"
          name="quantityPerNormBasis"
          type="text"
          inputMode="decimal"
          placeholder="ex. 10"
          required
        />
      </div>
      <div className="space-y-3 sm:col-span-2">
        <FormMessage state={state} />
        <SubmitButton pendingLabel="Se adaugă...">Adaugă resursa</SubmitButton>
      </div>
    </form>
  );
}

export function PublishInternalNormForm({
  action,
}: {
  action: (state: NormLibraryFormState) => Promise<NormLibraryFormState>;
}) {
  const [state, formAction] = useActionState<NormLibraryFormState, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Publicarea schimbă versiunea în starea internă „Publicată pentru
        utilizare”. Nu reprezintă aprobare sau validare externă.
      </p>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Se publică...">
        Publică pentru utilizare internă
      </SubmitButton>
    </form>
  );
}

export function AssignNormForm({
  action,
  eligibleNorms,
  workItemId,
}: {
  action: (
    state: WorkQuantityItemFormState,
    formData: FormData,
  ) => Promise<WorkQuantityItemFormState>;
  eligibleNorms: NormAssignmentOption[];
  workItemId: string;
}) {
  const [state, formAction] = useActionState<
    WorkQuantityItemFormState,
    FormData
  >(action, null);

  if (eligibleNorms.length === 0) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        Nu există norme publicate și valabile cu aceeași unitate de bază.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <Label htmlFor={`norm-assignment-${workItemId}`}>
        Alocă normă
      </Label>
      <select
        id={`norm-assignment-${workItemId}`}
        name="estimateNormVersionId"
        defaultValue=""
        required
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="" disabled>
          Selectați o normă
        </option>
        {eligibleNorms.map((norm) => (
          <option key={norm.id} value={norm.id}>
            {norm.code} · {norm.name} · versiunea {norm.versionLabel}
          </option>
        ))}
      </select>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Se alocă..." size="sm">
        Alocă normă
      </SubmitButton>
    </form>
  );
}
