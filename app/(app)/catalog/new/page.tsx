import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getCatalogCategoryService } from "@/server/container";
import { createItem } from "../actions";
import { CatalogItemForm } from "../catalog-item-form";

export default async function NewCatalogItemPage() {
  const { org } = await requireCurrentOrg();
  const categories = await getCatalogCategoryService().listCategories(org.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Articol nou în catalog</h1>
      <CatalogItemForm
        action={createItem}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        currency={org.defaultCurrency}
        submitLabel="Creează articol"
      />
    </div>
  );
}
