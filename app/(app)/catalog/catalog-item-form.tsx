"use client";

import { useActionState } from "react";
import type { CatalogItem } from "@/domain/catalog/item.repository";
import type { CatalogItemFormState } from "./actions";
import { UNIT_OPTIONS } from "@/lib/i18n/units";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

const selectClasses =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export interface CategoryOption {
  id: string;
  name: string;
}

export function CatalogItemForm({
  action,
  item,
  categories,
  currency,
  submitLabel,
}: {
  action: (
    state: CatalogItemFormState,
    formData: FormData,
  ) => Promise<CatalogItemFormState>;
  item?: CatalogItem;
  categories: CategoryOption[];
  currency: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<CatalogItemFormState, FormData>(
    action,
    null,
  );

  return (
    <Card>
      <form action={formAction}>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="name">Denumire</Label>
            <Input id="name" name="name" defaultValue={item?.name ?? ""} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Cod (opțional, unic)</Label>
              <Input id="code" name="code" defaultValue={item?.code ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryId">Categorie</Label>
              <select
                id="categoryId"
                name="categoryId"
                defaultValue={item?.categoryId ?? ""}
                className={selectClasses}
              >
                <option value="">Fără categorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descriere</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={item?.description ?? ""}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="itemType">Tip</Label>
              <select
                id="itemType"
                name="itemType"
                defaultValue={item?.itemType ?? "labor"}
                className={selectClasses}
              >
                <option value="labor">Manoperă</option>
                <option value="material">Material</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unitate</Label>
              <select
                id="unit"
                name="unit"
                defaultValue={item?.unit ?? "pcs"}
                className={selectClasses}
              >
                {UNIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellingPrice">Preț de vânzare ({currency})</Label>
              <Input
                id="sellingPrice"
                name="sellingPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={item?.sellingPrice ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costPrice">Preț de cost ({currency})</Label>
              <Input
                id="costPrice"
                name="costPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={item?.costPrice ?? ""}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="active"
              name="active"
              type="checkbox"
              defaultChecked={item?.active ?? true}
              className="h-4 w-4"
            />
            <Label htmlFor="active">Activ</Label>
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        <CardFooter>
          <SubmitButton pendingLabel="Se salvează...">{submitLabel}</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
