"use client";

import { useActionState } from "react";
import type { CatalogCategory } from "@/domain/catalog/category.repository";
import {
  createCategory,
  renameCategory,
  type CategoryFormState,
} from "../actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

function CreateCategoryForm() {
  const [state, action] = useActionState<CategoryFormState, FormData>(
    createCategory,
    null,
  );

  return (
    <form action={action} className="flex items-start gap-2">
      <div className="flex-1">
        <Input name="name" placeholder="Nume categorie nouă" required />
        {state?.error && (
          <p className="mt-1 text-sm text-destructive">{state.error}</p>
        )}
      </div>
      <SubmitButton pendingLabel="Se adaugă...">Adaugă</SubmitButton>
    </form>
  );
}

function RenameCategoryForm({ category }: { category: CatalogCategory }) {
  const action = renameCategory.bind(null, category.id);
  const [state, formAction] = useActionState<CategoryFormState, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Input name="name" defaultValue={category.name} className="flex-1" />
      <SubmitButton variant="outline" size="sm" pendingLabel="Se salvează...">
        Redenumește
      </SubmitButton>
      {state?.error && (
        <span className="text-sm text-destructive">{state.error}</span>
      )}
    </form>
  );
}

export function CategoriesManager({
  categories,
}: {
  categories: CatalogCategory[];
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <CreateCategoryForm />
        {categories.length === 0 ? (
          <p className="text-muted-foreground">Nicio categorie încă.</p>
        ) : (
          <ul className="space-y-2">
            {categories.map((category) => (
              <li key={category.id}>
                <RenameCategoryForm category={category} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
