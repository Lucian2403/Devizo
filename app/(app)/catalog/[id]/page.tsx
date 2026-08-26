import { notFound } from "next/navigation";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import {
  getCatalogCategoryService,
  getCatalogItemService,
} from "@/server/container";
import { CatalogItemNotFoundError } from "@/domain/catalog/item.service";
import { CatalogItemForm } from "../catalog-item-form";
import { updateItem } from "../actions";

export default async function EditCatalogItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { org } = await requireCurrentOrg();

  let item;
  try {
    item = await getCatalogItemService().getItem(org.id, id);
  } catch (error) {
    if (error instanceof CatalogItemNotFoundError) notFound();
    throw error;
  }

  const categories = await getCatalogCategoryService().listCategories(org.id);
  const action = updateItem.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Editează articolul din catalog</h1>
      <CatalogItemForm
        action={action}
        item={item}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        currency={org.defaultCurrency}
        submitLabel="Salvează modificările"
      />
    </div>
  );
}
