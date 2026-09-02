"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import {
  getCatalogCategoryService,
  getCatalogItemService,
  syncCatalogEmbeddings,
} from "@/server/container";
import { catalogItemSchema } from "@/schemas/domain/catalogItem";
import { catalogCategorySchema } from "@/schemas/domain/catalogCategory";
import { DuplicateItemCodeError } from "@/domain/catalog/item.repository";

export type CatalogItemFormState = { error: string } | null;

function parseItem(formData: FormData) {
  return catalogItemSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    categoryId: formData.get("categoryId"),
    description: formData.get("description") || undefined,
    unit: formData.get("unit"),
    itemType: formData.get("itemType"),
    sellingPrice: formData.get("sellingPrice"),
    costPrice: formData.get("costPrice"),
    active: formData.get("active"),
  });
}

export async function createItem(
  _prev: CatalogItemFormState,
  formData: FormData,
): Promise<CatalogItemFormState> {
  const { org } = await requireCurrentOrg();

  const parsed = parseItem(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Date invalide." };
  }

  try {
    await getCatalogItemService().createItem(org.id, parsed.data);
  } catch (error) {
    if (error instanceof DuplicateItemCodeError) {
      return { error: error.message };
    }
    throw error;
  }

  // Best-effort: refresh embeddings so the new item is semantically searchable.
  await syncCatalogEmbeddings(org.id);

  revalidatePath("/catalog");
  redirect("/catalog");
}

export async function updateItem(
  itemId: string,
  _prev: CatalogItemFormState,
  formData: FormData,
): Promise<CatalogItemFormState> {
  const { org } = await requireCurrentOrg();

  const parsed = parseItem(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Date invalide." };
  }

  try {
    await getCatalogItemService().updateItem(org.id, itemId, parsed.data);
  } catch (error) {
    if (error instanceof DuplicateItemCodeError) {
      return { error: error.message };
    }
    throw error;
  }

  // Best-effort: re-embed only if semantic fields changed (hash-guarded).
  await syncCatalogEmbeddings(org.id);

  revalidatePath("/catalog");
  redirect("/catalog");
}

export async function setItemActive(formData: FormData): Promise<void> {
  const { org } = await requireCurrentOrg();
  const itemId = String(formData.get("itemId"));
  const active = formData.get("active") === "true";
  await getCatalogItemService().setItemActive(org.id, itemId, active);
  revalidatePath("/catalog");
}

export type CategoryFormState = { error: string } | null;

export async function createCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const { org } = await requireCurrentOrg();

  const parsed = catalogCategorySchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Date invalide." };
  }

  await getCatalogCategoryService().createCategory(org.id, parsed.data.name);
  revalidatePath("/catalog/categories");
  return null;
}

export async function renameCategory(
  categoryId: string,
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const { org } = await requireCurrentOrg();

  const parsed = catalogCategorySchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Date invalide." };
  }

  await getCatalogCategoryService().renameCategory(
    org.id,
    categoryId,
    parsed.data.name,
  );
  revalidatePath("/catalog/categories");
  return null;
}
