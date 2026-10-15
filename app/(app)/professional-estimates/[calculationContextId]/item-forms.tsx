"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import type { WorkQuantityItem } from "@/domain/professional-estimates/professional-estimate-workspace.repository";
import type { WorkQuantityItemFormState } from "../actions";

type ItemAction = (
  state: WorkQuantityItemFormState,
  formData: FormData,
) => Promise<WorkQuantityItemFormState>;

function StatusMessage({ state }: { state: WorkQuantityItemFormState }) {
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

export function AddWorkQuantityItemForm({ action }: { action: ItemAction }) {
  const [state, formAction] = useActionState<WorkQuantityItemFormState, FormData>(
    action,
    null,
  );
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="new-positionNumber">Poziția</Label>
        <Input
          id="new-positionNumber"
          name="positionNumber"
          type="number"
          min="1"
          step="1"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-code">Cod (opțional)</Label>
        <Input id="new-code" name="code" />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="new-description">Denumirea lucrării</Label>
        <Input id="new-description" name="description" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-unit">UM</Label>
        <Input id="new-unit" name="unit" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-quantity">Cantitate</Label>
        <Input
          id="new-quantity"
          name="quantity"
          type="text"
          inputMode="decimal"
          placeholder="ex. 12.5"
          required
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="new-notes">Note (opțional)</Label>
        <Input id="new-notes" name="notes" />
      </div>
      <div className="space-y-3 sm:col-span-2">
        <StatusMessage state={state} />
        <SubmitButton pendingLabel="Se adaugă...">Adaugă poziția</SubmitButton>
      </div>
    </form>
  );
}

export function EditWorkQuantityItemForm({
  action,
  item,
}: {
  action: ItemAction;
  item: WorkQuantityItem;
}) {
  const [state, formAction] = useActionState<WorkQuantityItemFormState, FormData>(
    action,
    null,
  );
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm font-medium text-primary">
        Editează poziția
      </summary>
      <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`code-${item.id}`}>Cod</Label>
          <Input id={`code-${item.id}`} name="code" defaultValue={item.code ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`quantity-${item.id}`}>Cantitate</Label>
          <Input
            id={`quantity-${item.id}`}
            name="quantity"
            type="text"
            inputMode="decimal"
            defaultValue={item.quantity}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`description-${item.id}`}>Denumirea lucrării</Label>
          <Input
            id={`description-${item.id}`}
            name="description"
            defaultValue={item.description}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`unit-${item.id}`}>UM</Label>
          <Input
            id={`unit-${item.id}`}
            name="unit"
            defaultValue={item.unit}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`notes-${item.id}`}>Note</Label>
          <Input
            id={`notes-${item.id}`}
            name="notes"
            defaultValue={item.notes ?? ""}
          />
        </div>
        <div className="space-y-3 sm:col-span-2">
          <StatusMessage state={state} />
          <SubmitButton pendingLabel="Se salvează...">
            Salvează modificările
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}
