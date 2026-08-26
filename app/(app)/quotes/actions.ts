"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import {
  getCatalogItemService,
  getCustomerService,
  getProjectService,
  getQuoteService,
} from "@/server/container";
import { draftUpdateSchema } from "@/schemas/domain/quoteVersion";
import { QuoteNotEditableError } from "@/domain/quotes/quote.service";
import type { SupportedUnit } from "@/domain/shared/types";

// --- Catalog search (for the editor's search-as-you-type picker) ----------

export interface CatalogSearchResult {
  id: string;
  name: string;
  code: string | null;
  unit: SupportedUnit;
  sellingPrice: string;
}

export async function searchCatalog(
  term: string,
): Promise<CatalogSearchResult[]> {
  const { org } = await requireCurrentOrg();
  const items = await getCatalogItemService().searchActiveItems(org.id, term);
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    code: item.code,
    unit: item.unit,
    sellingPrice: item.sellingPrice,
  }));
}

// --- Create a quote from a project ----------------------------------------

export async function createQuoteForProject(formData: FormData): Promise<void> {
  const { org } = await requireCurrentOrg();
  const projectId = String(formData.get("projectId"));

  const project = await getProjectService().getProject(org.id, projectId);

  // Snapshot the customer details, if the project has a customer.
  let customerName: string | null = project.customerName;
  let customerEmail: string | null = null;
  let customerPhone: string | null = null;
  if (project.customerId) {
    const customer = await getCustomerService().getCustomer(
      org.id,
      project.customerId,
    );
    customerName = customer.name;
    customerEmail = customer.email;
    customerPhone = customer.phone;
  }

  const created = await getQuoteService().createQuote(org.id, {
    projectId,
    currency: org.defaultCurrency,
    vatRate: org.vatRate ?? "0",
    snapshot: {
      customerName,
      customerEmail,
      customerPhone,
      projectName: project.name,
      projectAddress: project.address,
    },
  });

  redirect(`/quotes/${created.quote.id}/edit`);
}

// --- Save a draft version --------------------------------------------------

export type SaveDraftState = { error: string } | { ok: true } | null;

// The editor submits items as a JSON string plus the version-level fields.
export async function saveDraft(
  versionId: string,
  _prev: SaveDraftState,
  formData: FormData,
): Promise<SaveDraftState> {
  const { org } = await requireCurrentOrg();

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "Articole invalide." };
  }

  const parsed = draftUpdateSchema.safeParse({
    notes: formData.get("notes") || undefined,
    validityDays: formData.get("validityDays") || undefined,
    discountPct: formData.get("discountPct") || "0",
    items: rawItems,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Date invalide." };
  }

  try {
    await getQuoteService().saveDraft(org.id, versionId, {
      notes: parsed.data.notes ?? null,
      validityDays: parsed.data.validityDays ?? null,
      discountPct: parsed.data.discountPct,
      items: parsed.data.items.map((item) => ({
        catalogItemId: item.catalogItemId ?? null,
        name: item.name,
        description: item.description ?? null,
        unit: item.unit,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        discountPct: item.discountPct,
      })),
    });
  } catch (error) {
    if (error instanceof QuoteNotEditableError) {
      return { error: "Această versiune nu mai poate fi editată." };
    }
    throw error;
  }

  revalidatePath(`/quotes`);
  return { ok: true };
}
