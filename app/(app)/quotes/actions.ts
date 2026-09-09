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
import {
  QuoteNotEditableError,
  QuoteNotSendableError,
  QuoteVersionNotCloneableError,
  QuoteVersionNotFoundError,
} from "@/domain/quotes/quote.service";
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

// --- Send a draft version (freeze it as the commercial document) -----------

export type SendQuoteState = { error: string } | null;

// Freezes the exact saved QuoteVersion as 'sent'. Validates against the saved
// snapshot only (never the AI assistant's unresolved state). On success the
// user is redirected to the now-immutable version view.
export async function sendQuoteVersion(
  quoteId: string,
  versionId: string,
  _prev: SendQuoteState,
  _formData: FormData,
): Promise<SendQuoteState> {
  const { userId, org } = await requireCurrentOrg();

  try {
    // Freeze the company/document metadata from the live org NOW, at finalize
    // time. After this the PDF renders only from the frozen version snapshot.
    await getQuoteService().sendQuoteVersion(org.id, versionId, userId, {
      companyName: org.name,
      companyLegalName: org.legalName,
      companyTaxVatId: org.vatNumber,
      companyEmail: org.email,
      companyPhone: org.phone,
      companyAddress: org.address,
      companyCountry: org.country,
      documentLanguage: org.customerDocumentLanguage,
      paymentTerms: org.paymentTerms,
      executionDuration: org.executionDuration,
      inclusions: org.inclusions,
      exclusions: org.exclusions,
      companyTerms: org.legalTerms,
    });
  } catch (error) {
    if (error instanceof QuoteVersionNotFoundError) {
      return { error: "Versiunea nu a fost găsită." };
    }
    if (error instanceof QuoteNotSendableError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(`/quotes`);
  revalidatePath(`/quotes/${quoteId}/versions/${versionId}`);
  redirect(`/quotes/${quoteId}/versions/${versionId}`);
}

// --- Create a new draft version from a sent/rejected version ----------------

// Clones a frozen version into a new draft (version + 1) and opens the editor.
// The source version stays immutable forever.
export async function createNewVersion(
  quoteId: string,
  sourceVersionId: string,
): Promise<void> {
  const { org } = await requireCurrentOrg();

  let newVersionId: string;
  try {
    newVersionId = await getQuoteService().createDraftFromVersion(
      org.id,
      sourceVersionId,
    );
  } catch (error) {
    if (
      error instanceof QuoteVersionNotFoundError ||
      error instanceof QuoteVersionNotCloneableError
    ) {
      redirect(`/quotes/${quoteId}/versions/${sourceVersionId}`);
    }
    throw error;
  }

  revalidatePath(`/quotes`);
  redirect(`/quotes/${quoteId}/edit`);
}

// --- Delete a quote from the project view ---------------------------------

export async function deleteQuoteFromProject(
  quoteId: string,
  projectId: string,
  view: "all" | "confirmed",
): Promise<void> {
  const { org } = await requireCurrentOrg();

  await getQuoteService().deleteQuote(org.id, quoteId);

  const targetPath =
    view === "confirmed" ? `/projects/${projectId}?view=confirmed` : `/projects/${projectId}`;
  revalidatePath(`/projects`);
  revalidatePath(`/quotes`);
  revalidatePath(`/projects/${projectId}`);
  redirect(targetPath);
}
